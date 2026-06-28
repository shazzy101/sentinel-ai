import { useState } from 'react';
import { useTradingData } from '@/hooks/useTradingData';
import { getApiBase } from '@/lib/apiClient';

const ADMIN_KEY_SESSION = 'hadaleum_admin_key';

async function adminPost(path, key, body) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export default function TradingAdmin() {
  const { data: health, refresh } = useTradingData('/api/trading/health', { intervalMs: 15000 });
  const { data: pf } = useTradingData('/api/trading/portfolio', { intervalMs: 30000 });
  const [key, setKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_SESSION) || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  function saveKey(v) { setKey(v); sessionStorage.setItem(ADMIN_KEY_SESSION, v); }

  async function run(label, path, body) {
    setBusy(label); setMsg('');
    try {
      const res = await adminPost(path, key, body);
      setMsg(`${label}: ${JSON.stringify(res)}`);
      refresh();
    } catch (e) {
      setMsg(`${label} failed: ${e.message}`);
    } finally {
      setBusy('');
    }
  }

  const ok = health?.status === 'ok';
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin · Engine Health</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-sm font-semibold">Engine</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{ok ? 'Running (paper)' : 'Unknown'}</span>
          </div>
          <div className="mt-2 text-xs text-text-muted">Market: {health?.market_open ? 'open' : 'closed'}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-sm font-semibold">Activity</div>
          <div className="mt-2 text-sm text-text-muted">Open positions: <span className="text-text-primary">{health?.open_positions ?? '—'}</span></div>
          <div className="text-sm text-text-muted">Signals today: <span className="text-text-primary">{health?.today_signals ?? '—'}</span></div>
          <div className="text-sm text-text-muted">Last signal: <span className="text-text-primary">{health?.last_signal_at ? new Date(health.last_signal_at).toLocaleString() : '—'}</span></div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-sm font-semibold">Capital</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">
            {pf?.current_capital != null ? `$${pf.current_capital.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 text-sm font-semibold">Controls</div>
        <input type="password" value={key} onChange={(e) => saveKey(e.target.value)} placeholder="Admin key (X-Admin-Key)"
               className="mb-3 w-full max-w-sm rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none" />
        <div className="flex flex-wrap gap-2">
          <button disabled={!key || busy} onClick={() => run('Scan', '/api/trading/admin/run-signals')}
                  className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
            {busy === 'Scan' ? '…' : 'Force Scan'}
          </button>
          <button disabled={!key || busy} onClick={() => run('Monitor', '/api/trading/admin/run-monitor')}
                  className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy === 'Monitor' ? '…' : 'Force Monitor'}
          </button>
          <button disabled={!key || busy}
                  onClick={() => { if (window.prompt('Type RESET to wipe paper data') === 'RESET') run('Reset', '/api/trading/admin/reset', { confirm: 'RESET' }); }}
                  className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Reset Paper
          </button>
        </div>
        {msg && <pre className="mt-3 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-text-muted">{msg}</pre>}
      </div>
    </div>
  );
}
