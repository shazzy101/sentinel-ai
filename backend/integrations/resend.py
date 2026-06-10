"""
Sentinel AI — Resend email integration (transactional waitlist emails).

Reads RESEND_API_KEY from the environment. The sending address is set via
RESEND_FROM — until you verify a domain in Resend you can only send from
'onboarding@resend.dev' (and only to your own Resend account email). Once a
domain is verified, set RESEND_FROM='Sentinel AI <hello@yourdomain.com>'.
"""

import os

import httpx

RESEND_API = "https://api.resend.com/emails"
DEFAULT_FROM = "Sentinel AI <onboarding@resend.dev>"


def is_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))


async def send_email(to, subject: str, html: str, *, reply_to: str | None = None) -> bool:
    """Send one email via Resend. Returns True on success, False otherwise.
    Best-effort: never raises, so callers can fire-and-forget."""
    key = os.getenv("RESEND_API_KEY")
    if not key:
        return False
    payload = {
        "from": os.getenv("RESEND_FROM", DEFAULT_FROM),
        "to": [to] if isinstance(to, str) else to,
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_API,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            )
            return resp.status_code in (200, 201)
    except Exception:
        return False


def waitlist_welcome_html() -> str:
    """Branded welcome email for new Pro waitlist signups (inline CSS for email clients)."""
    return """\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#09090B;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090B;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141418;border:1px solid #28283A;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:32px 32px 8px;">
            <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#00D992;font-weight:600;">Sentinel AI · Pro</div>
            <h1 style="margin:12px 0 0;font-size:24px;line-height:1.25;color:#FFFFFF;">You're on the list 🎉</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#A1A1AA;">
              Thanks for joining the Sentinel Pro waitlist. You'll be first to know the moment it opens —
              and early members get launch pricing.
            </p>
          </td></tr>
          <tr><td style="padding:20px 32px 8px;">
            <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#71717A;font-weight:600;margin-bottom:10px;">What Pro unlocks</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#D4D4D8;line-height:1.9;">
              <tr><td style="color:#00D992;padding-right:8px;">✓</td><td>Real-time AI signals on 800+ whale wallets</td></tr>
              <tr><td style="color:#00D992;padding-right:8px;">✓</td><td>Unlimited one-click copy-trading</td></tr>
              <tr><td style="color:#00D992;padding-right:8px;">✓</td><td>Instant alerts — email &amp; push</td></tr>
              <tr><td style="color:#00D992;padding-right:8px;">✓</td><td>Full network intelligence &amp; whale moves</td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:20px 32px 32px;">
            <a href="https://sentinel-ai-905.pages.dev/" style="display:inline-block;background:#00D992;color:#09090B;font-weight:600;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:12px;">Explore Sentinel →</a>
            <p style="margin:18px 0 0;font-size:12px;color:#52525B;">You're receiving this because you joined the Sentinel AI Pro waitlist.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
