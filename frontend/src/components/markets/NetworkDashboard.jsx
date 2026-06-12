import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

/* ── formatting helpers ─────────────────────────────── */
function compact(n) {
  const x = Number(n ?? 0);
  if (x >= 1e9) return `${(x / 1e9).toFixed(2)}B`;
  if (x >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
  return x.toLocaleString('en-US');
}
function usd(n) { return `$${compact(n)}`; }
function relTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

/* ── Network pulse vitals strip ─────────────────────── */
function PulseStrip({ pulse }) {
  const tiles = [
    { label: '24h Transactions', value: compact(pulse?.txns_24h), accent: 'text-text-primary' },
    { label: 'Active Addresses', value: compact(pulse?.active_senders), accent: 'text-text-primary' },
    { label: 'Median Gas', value: `${pulse?.median_gas_gwei ?? '—'}`, suffix: 'gwei', accent: 'text-green' },
    { label: '24h Fees', value: usd(pulse?.total_fees_usd), accent: 'text-text-primary' },
    { label: 'Fees in ETH', value: compact(pulse?.total_fees_eth), suffix: 'ETH', accent: 'text-text-secondary' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="bg-bg-surface border border-border-default rounded-xl px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">{t.label}</div>
          <div className="flex items-baseline gap-1">
            <span className={`font-mono font-bold text-[18px] ${t.accent}`}>{t.value}</span>
            {t.suffix && <span className="text-[10px] text-text-muted">{t.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Top tokens by 24h DEX volume ───────────────────── */
function TopTokens({ tokens }) {
  const max = Math.max(...tokens.map((t) => Number(t.volume_usd) || 0), 1);
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="font-display text-[14px] font-medium text-text-primary">
          Top Tokens · 24h DEX Volume
        </span>
        <span className="text-[10px] text-text-muted">What smart money is trading · Dune</span>
      </div>
      <div className="grid px-5 py-2 bg-bg-overlay border-b border-border-subtle text-[10px] uppercase tracking-widest text-text-muted"
        style={{ gridTemplateColumns: '28px 1fr 110px 90px 100px' }}>
        <div>#</div><div>Token</div><div className="text-right">Volume</div>
        <div className="text-right">Buyers</div><div className="text-right">Trades</div>
      </div>
      {tokens.length === 0 ? (
        <div className="py-10 text-center text-[12px] text-text-muted">No data yet — refreshing from Dune.</div>
      ) : tokens.map((t, i) => (
        <a
          key={`${t.symbol}-${t.address}`}
          href={`https://etherscan.io/token/${t.address}`}
          target="_blank" rel="noreferrer"
          className="group grid items-center px-5 py-3 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors relative"
          style={{ gridTemplateColumns: '28px 1fr 110px 90px 100px' }}
        >
          {/* volume bar background */}
          <div className="absolute left-0 top-0 bottom-0 bg-green/[0.04] pointer-events-none"
            style={{ width: `${(Number(t.volume_usd) / max) * 100}%` }} />
          <span className="text-[11px] text-text-muted font-mono relative">{i + 1}</span>
          <div className="flex items-center gap-2 relative min-w-0">
            <span className="text-[13px] font-medium text-text-primary truncate">{t.symbol}</span>
            {t.is_major && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted border border-border-subtle">major</span>
            )}
          </div>
          <span className="font-mono text-[13px] text-green text-right relative font-medium">{usd(t.volume_usd)}</span>
          <span className="font-mono text-[12px] text-text-secondary text-right relative">{compact(t.buyers)}</span>
          <span className="font-mono text-[12px] text-text-muted text-right relative">{compact(t.trades)}</span>
        </a>
      ))}
    </div>
  );
}

/* ── Large whale trades feed ────────────────────────── */
function LargeTrades({ trades }) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="font-display text-[14px] font-medium text-text-primary">
          Whale Moves · Last 24h
        </span>
        <span className="text-[10px] text-text-muted">Largest DEX trades &gt; $250k · Dune</span>
      </div>
      {trades.length === 0 ? (
        <div className="py-10 text-center text-[12px] text-text-muted">No large trades yet — refreshing from Dune.</div>
      ) : trades.map((t, i) => (
        <a
          key={`${t.tx_hash}-${i}`}
          href={`https://etherscan.io/tx/${t.tx_hash}`}
          target="_blank" rel="noreferrer"
          className={`flex items-center gap-3 px-5 py-3 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors ${
            t.is_tracked ? 'border-l-2 border-l-green bg-green/[0.03]' : ''
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-text-primary">
                <span className="text-red">{t.sold}</span>
                <span className="text-text-muted mx-1">→</span>
                <span className="text-green">{t.bought}</span>
              </span>
              {t.is_tracked && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green/15 text-green border border-green/30 font-medium">
                  {t.trader_label || 'Tracked'}{t.trader_score ? ` · ${t.trader_score}` : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[10px] text-text-muted">{shortAddr(t.trader)}</span>
              <span className="text-[10px] text-text-muted">· {t.project}</span>
              <span className="text-[10px] text-text-muted">· {relTime(t.time)}</span>
            </div>
          </div>
          <span className="font-mono text-[14px] font-bold text-text-primary flex-shrink-0">{usd(t.amount_usd)}</span>
        </a>
      ))}
    </div>
  );
}

/* ── Container ──────────────────────────────────────── */
export default function NetworkDashboard() {
  const [pulse, setPulse] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getNetworkPulse().catch(() => ({ available: false })),
      api.getNetworkTopTokens().catch(() => []),
      api.getNetworkLargeTrades().catch(() => []),
    ]).then(([p, tk, tr]) => {
      if (cancelled) return;
      setPulse(p?.pulse || null);
      setTokens(tk || []);
      setTrades(tr || []);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // If Dune isn't configured / no data at all, render nothing (graceful).
  if (loaded && !pulse && tokens.length === 0 && trades.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green/70" />
        <span className="font-display text-[15px] font-semibold text-text-primary">Network Intelligence</span>
        <span className="text-[10px] text-text-muted ml-1">Ethereum · on-chain</span>
      </div>
      <PulseStrip pulse={pulse} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopTokens tokens={tokens} />
        <LargeTrades trades={trades} />
      </div>
    </div>
  );
}
