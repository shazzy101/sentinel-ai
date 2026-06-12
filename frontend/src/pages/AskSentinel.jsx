import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { streamAskAi } from '@/lib/authHeaders';
import { api } from '@/lib/api';

const SUGGESTED_PROMPTS = [
  'Most active whales in the last 24h',
  'Wallets with BULLISH signals, ranked by activity',
  'Which tracked whales hold the largest ETH balances?',
  'Whales that flipped signal recently',
];

function HexIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" className="flex-shrink-0">
      <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
    </svg>
  );
}

function SignalChip({ signal }) {
  const cls = {
    BULLISH: 'bg-green-dim border-green-border text-green',
    BEARISH: 'bg-red-dim border-red-border text-red',
    NEUTRAL: 'bg-amber-dim border-amber-border text-amber',
  }[signal] || 'bg-amber-dim border-amber-border text-amber';
  const dot = { BULLISH: 'bg-green', BEARISH: 'bg-red', NEUTRAL: 'bg-amber' }[signal] || 'bg-amber';
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>
      <span className={`w-1 h-1 rounded-full ${dot}`} />
      {signal}
    </span>
  );
}

function WalletMiniCard({ wallet }) {
  if (!wallet) return null;
  const score = Number(wallet.score ?? 0);
  return (
    <div className="mt-2 bg-bg-elevated border border-border-default rounded-lg px-3 py-2 flex items-center gap-3">
      <div className="relative w-8 h-8 flex-shrink-0">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" stroke="#1A1A20" strokeWidth="3" fill="none" />
          <circle
            cx="16" cy="16" r="12"
            stroke={score >= 80 ? '#00D992' : score >= 60 ? '#F59E0B' : '#FF4D4D'}
            strokeWidth="3" fill="none"
            strokeDasharray={`${2 * Math.PI * 12}`}
            strokeDashoffset={`${2 * Math.PI * 12 * (1 - score / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 16 16)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text-primary">{score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-text-primary truncate">{wallet.label || wallet.name || 'Wallet'}</div>
        {wallet.signal && <SignalChip signal={wallet.signal} />}
      </div>
      {wallet.key_insight && (
        <p className="text-[10px] text-text-muted max-w-[120px] line-clamp-2 leading-tight">{wallet.key_insight}</p>
      )}
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="ml-auto max-w-[80%] bg-bg-elevated border border-border-default rounded-2xl rounded-tr-sm px-4 py-3 text-[14px] text-text-primary">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ text, wallets, streaming }) {
  return (
    <div className="flex flex-col items-start mb-4 gap-1.5">
      <div className="flex items-center gap-1.5">
        <HexIcon size={16} />
        <span className="text-[12px] text-text-muted font-medium">Hadaleum</span>
        {streaming && (
          <span className="text-[10px] text-green animate-pulse">streaming…</span>
        )}
      </div>
      <div className="mr-auto max-w-[80%] bg-bg-surface border border-border-default rounded-2xl rounded-tl-sm px-4 py-3 text-[14px] text-text-secondary leading-relaxed whitespace-pre-wrap">
        {text || (streaming ? ' ' : '')}
        {streaming && !text && (
          <span className="inline-block w-2 h-4 bg-green/60 animate-pulse align-middle ml-0.5" />
        )}
        {wallets && wallets.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {wallets.slice(0, 3).map((w) => <WalletMiniCard key={w.address || w.label} wallet={w} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AskSentinelPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [quota, setQuota] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    document.title = 'Screener — Hadaleum';
  }, []);

  // Abort any in-flight stream when the page unmounts so the reader/connection
  // is released and no state updates fire after teardown.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    api.getQuota().then(setQuota).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingText]);

  const submit = useCallback(async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = '';
    let streamDone = false;

    try {
      await streamAskAi({
        message: question,
        history,
        signal: controller.signal,
        onDelta: (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
        },
        onDone: (payload) => {
          streamDone = true;
          setMessages((prev) => [...prev, { role: 'assistant', content: payload.text || accumulated, wallets: null }]);
          setStreamingText('');
          if (payload.quota) {
            setQuota((q) => ({ ...q, ask_remaining: payload.quota.ask_remaining, tokens_remaining: payload.quota.tokens_remaining }));
          } else {
            api.getQuota().then(setQuota).catch(() => {});
          }
        },
        onError: (msg) => {
          streamDone = true;
          setMessages((prev) => [...prev, { role: 'assistant', content: msg, wallets: null, isError: true }]);
          setStreamingText('');
        },
      });
      if (!streamDone && accumulated) {
        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated, wallets: null }]);
        setStreamingText('');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const content = err.message || 'Could not reach Hadaleum backend.';
        const upgradeHint = err.message?.includes('Upgrade') || err.message?.includes('Pro');
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: upgradeHint ? `${content} Visit /upgrade for higher limits.` : content,
          wallets: null,
          isError: true,
        }]);
      }
      setStreamingText('');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, messages]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const handleTextareaChange = useCallback((e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  }, []);

  const handlePromptClick = useCallback((prompt) => {
    submit(prompt);
  }, [submit]);

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="h-full min-h-0 flex flex-col">
      {quota && (
        <div className="flex-shrink-0 px-8 py-2 border-b border-border-subtle bg-bg-surface/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between text-[11px] text-text-muted">
            <span>
              {quota.plan === 'pro' ? 'Pro' : quota.plan === 'free' ? 'Free' : 'Guest'} ·{' '}
              {quota.ask_remaining ?? '—'} Ask messages left this hour
            </span>
            {quota.plan !== 'pro' && (
              <Link to="/upgrade" className="text-green hover:underline">Upgrade for more</Link>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 w-full">
          {isEmpty ? (
            <div className="flex flex-col items-center pt-16">
              <HexIcon size={48} />
              <h2 className="font-display text-[24px] font-bold text-text-primary text-center mt-8 mb-2">
                Screen the watchlist in plain English.
              </h2>
              <p className="text-[14px] text-text-muted text-center mb-12">
                Ask for a filter — get a ranked list of real tracked wallets. Behavioral scores, not profitability · for P&amp;L, see Copy.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full mx-auto">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePromptClick(p)}
                    className="bg-bg-surface border border-border-default rounded-xl p-4 cursor-pointer hover:border-border-strong hover:bg-bg-elevated transition-all text-left text-[13px] text-text-secondary"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-4">
              {messages.map((msg, i) =>
                msg.role === 'user'
                  ? <UserMessage key={i} text={msg.content} />
                  : (
                    <AssistantMessage
                      key={i}
                      text={msg.content}
                      wallets={msg.wallets}
                      streaming={false}
                    />
                  ),
              )}
              {loading && (
                <AssistantMessage text={streamingText} streaming={loading} />
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-bg-base border-t border-border-subtle px-8 py-4">
        <div className="max-w-3xl mx-auto w-full">
          <div className="bg-bg-surface border border-border-default rounded-2xl flex items-end gap-3 px-4 py-3 focus-within:border-border-focus transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Screen wallets — e.g. 'most active whales with bullish signals'"
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-[14px] text-text-primary placeholder:text-text-muted overflow-y-auto leading-relaxed"
              style={{ maxHeight: '128px', minHeight: '24px' }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => submit()}
              disabled={!input.trim() || loading}
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 self-end mb-0.5 transition-all ${
                input.trim() && !loading
                  ? 'bg-green hover:opacity-90 active:scale-95'
                  : 'bg-bg-elevated cursor-not-allowed'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 11V3M3 7l4-4 4 4" stroke={input.trim() && !loading ? '#09090B' : '#6b7280'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
