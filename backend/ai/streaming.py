"""SSE streaming helpers for Claude responses."""

from __future__ import annotations

import asyncio
import threading
from typing import AsyncIterator, Any

import anthropic

from ai.analyst import get_client
from observability import log_error, log_info


async def stream_claude_text(
    *,
    system: str,
    messages: list[dict],
    model: str,
    max_tokens: int,
) -> AsyncIterator[tuple[str, Any]]:
    """
    Yield ("delta", text_chunk) then ("done", usage_dict).
    Runs sync Anthropic stream in a background thread.
    """
    client = get_client()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[str, Any] | None] = asyncio.Queue()
    sentinel = object()

    def worker() -> None:
        try:
            with client.messages.stream(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    asyncio.run_coroutine_threadsafe(queue.put(("delta", text)), loop)
                final = stream.get_final_message()
                usage = final.usage
                asyncio.run_coroutine_threadsafe(
                    queue.put(
                        (
                            "done",
                            {
                                "input_tokens": getattr(usage, "input_tokens", 0),
                                "output_tokens": getattr(usage, "output_tokens", 0),
                            },
                        )
                    ),
                    loop,
                )
        except anthropic.APIError as exc:
            asyncio.run_coroutine_threadsafe(queue.put(("error", str(exc))), loop)
        except Exception as exc:
            asyncio.run_coroutine_threadsafe(queue.put(("error", str(exc))), loop)
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(sentinel), loop)  # type: ignore[arg-type]

    threading.Thread(target=worker, daemon=True).start()
    log_info("claude_stream_started", model=model, max_tokens=max_tokens)

    # Contract: this generator yields ("delta", str) chunks, then ("done", usage)
    # on success, or ("error", message: str) if the worker fails OR stalls. Every
    # caller MUST handle the ("error", message) tuple. A hung worker (no item
    # within the timeout) yields an error and ends the stream instead of blocking
    # the connection forever.
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=120)
        except asyncio.TimeoutError:
            log_error("claude_stream_timeout", model=model)
            yield ("error", "The AI response timed out. Please try again.")
            break
        if item is sentinel:
            break
        if item[0] == "error":
            log_error("claude_stream_failed", error=item[1])
        yield item
