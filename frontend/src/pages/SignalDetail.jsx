import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { Share2, ExternalLink } from 'lucide-react';
import ConfidenceDots from '../components/signals/ConfidenceDots';
import OutcomeBadge from '../components/signals/OutcomeBadge';
import { useSignal } from '../hooks/useSignal';
import { formatSignalTweet } from '../lib/signalTweet';
import { apiFetch } from '../lib/apiClient';

// ─── Helpers ────────────────────────────────────────────────────

function fmtPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const num = Number(n);
  if (num < 1) return `$${num.toFixed(6).replace(/\.?0+$/, '')}`;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtPct(from, to) {
  if (from == null || to == null || Number(from) === 0) return null;
  const pct = ((Number(to) - Number(from)) / Math.abs(Number(from))) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

function truncAddr(addr, len = 8) {
  if (!addr) return '';
  if (addr.length <= len * 2 + 3) return addr;
  return `${addr.slice(0, len)}…${addr.slice(-4)}`;
}

// ─── Skeleton ───────────────────────────────────────────────────

function SignalSkeleton() {
  return (
    <div className="animate-pulse space-y-4 max-w-3xl mx-auto px-4 py-8">
      <div className="h-8 bg-bg-surface rounded-lg w-2/5" />
      <div className="h-4 bg-bg-surface rounded w-1/3" />
      <div className="h-40 bg-bg-surface rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-bg-surface rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Not-found ──────────────────────────────────────────────────

function SignalNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <span className="text-4xl" aria-hidden="true">🔍</span>
      <h2 className="font-display text-xl text-text-primary">Signal not found</h2>
      <p className="text-text-muted text-sm max-w-xs">
        This signal may have been removed or the link is incorrect.
      </p>
      <a
        href="/signals"
        className="text-signal text-sm underline underline-offset-2"
      >
        Browse all signals
      </a>
    </div>
  );
}

// ─── Price Chart ────────────────────────────────────────────────

function SignalPriceChart({ signal }) {
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    if (!signal?.asset) return;
    let cancelled = false;

    apiFetch('/api/market/eth', { timeoutMs: 8000 })
      .then((body) => {
        if (cancelled) return;
        const raw = body.data?.prices ?? body.prices ?? [];
        // Take last 30 points for concise chart
        const pts = raw
          .slice(-30)
          .map(([ts, price], i) => ({
            i,
            price,
            label: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          }));
        if (!cancelled) setPrices(pts);
      })
      .catch(() => {
        if (!cancelled) setPrices([]);
      });

    return () => { cancelled = true; };
  }, [signal?.asset]);

  const entry =
    signal.entry_low != null && signal.entry_high != null
      ? (Number(signal.entry_low) + Number(signal.entry_high)) / 2
      : signal.entry_low ?? signal.entry_high;
  const target = signal.target;
  const stop = signal.stop_loss;

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="font-display text-[13px] font-medium text-text-primary">
          {signal.asset} Price + Signal Levels
        </span>
        <span className="text-[10px] text-text-muted">entry / target / stop</span>
      </div>
      <div className="px-2 py-3" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={prices.length ? prices : [{ i: 0, price: entry ?? 0 }, { i: 1, price: entry ?? 0 }]}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="signalPriceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00D992" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00D992" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#6B6B7B' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 9, fill: '#6B6B7B' }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#00D992"
              strokeWidth={1.5}
              fill="url(#signalPriceGrad)"
              dot={false}
            />
            {entry != null && (
              <ReferenceLine
                y={entry}
                stroke="#F59E0B"
                strokeDasharray="4 2"
                label={{ value: 'Entry', fill: '#F59E0B', fontSize: 9, position: 'insideTopRight' }}
              />
            )}
            {target != null && (
              <ReferenceLine
                y={target}
                stroke="#00D992"
                strokeDasharray="4 2"
                label={{ value: 'Target', fill: '#00D992', fontSize: 9, position: 'insideTopRight' }}
              />
            )}
            {stop != null && (
              <ReferenceLine
                y={stop}
                stroke="#FF4D4D"
                strokeDasharray="4 2"
                label={{ value: 'Stop', fill: '#FF4D4D', fontSize: 9, position: 'insideTopRight' }}
              />
            )}
            <Tooltip
              contentStyle={{
                background: '#141418',
                border: '1px solid #28283A',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              formatter={(v) => [`$${Number(v).toLocaleString()}`, signal.asset]}
              labelFormatter={(l) => l}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Share Button ───────────────────────────────────────────────

function ShareButton({ signal }) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const text = formatSignalTweet(signal);
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

    // Copy to clipboard (best-effort)
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    // Open X intent link
    window.open(url, '_blank', 'noopener,noreferrer');

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={handleShare}
      data-testid="share-button"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-default
                 text-text-muted hover:text-text-primary hover:border-signal/40 text-[12px]
                 transition-colors"
      aria-label="Share signal on X"
    >
      <Share2 size={13} />
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}

// ─── Main page ──────────────────────────────────────────────────

export default function SignalDetail() {
  const { id } = useParams();
  const { signal, loading, error } = useSignal(id);

  if (loading) return <SignalSkeleton />;
  if (!signal || error) return <SignalNotFound />;

  const entry =
    signal.entry_low != null && signal.entry_high != null
      ? (Number(signal.entry_low) + Number(signal.entry_high)) / 2
      : signal.entry_low ?? signal.entry_high;

  const targetPct = fmtPct(entry, signal.target);
  const isWin = signal.status === 'win';
  const isLoss = signal.status === 'loss';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {signal.signal_number != null && (
              <span className="text-[10px] uppercase tracking-widest text-text-muted font-mono">
                Signal #{signal.signal_number}
              </span>
            )}
            <OutcomeBadge status={signal.status} />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary mt-1">
            {signal.asset}
            <span
              className={`ml-2 text-base font-semibold ${
                signal.direction === 'long' ? 'text-signal' : 'text-loss'
              }`}
            >
              {signal.direction === 'long' ? 'Long' : signal.direction === 'short' ? 'Short' : signal.direction}
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <ConfidenceDots score={signal.confidence ?? 1} />
            <span className="text-[11px] text-text-muted">
              Confidence {signal.confidence ?? '?'}/5
            </span>
          </div>
        </div>
        <ShareButton signal={signal} />
      </div>

      {/* Key levels */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Entry',
            value: fmtPrice(entry),
            sub: signal.entry_low != null && signal.entry_high != null
              ? `${fmtPrice(signal.entry_low)} – ${fmtPrice(signal.entry_high)}`
              : null,
            cls: 'text-text-primary',
          },
          {
            label: 'Target',
            value: fmtPrice(signal.target),
            sub: targetPct,
            cls: isWin ? 'text-signal shadow-glow-signal' : 'text-signal',
          },
          {
            label: 'Stop',
            value: fmtPrice(signal.stop_loss),
            sub: null,
            cls: isLoss ? 'text-loss shadow-glow-loss' : 'text-loss',
          },
        ].map(({ label, value, sub, cls }) => (
          <div
            key={label}
            className="rounded-xl border border-border-default bg-bg-surface px-4 py-3 space-y-0.5"
          >
            <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
            <div className={`font-mono text-lg font-bold ${cls}`}>{value}</div>
            {sub && <div className="font-mono text-[11px] text-text-muted">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Pattern type */}
      {signal.pattern_type && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">Pattern</span>
          <span className="text-[12px] text-text-primary font-mono">{signal.pattern_type}</span>
        </div>
      )}

      {/* Explanation */}
      {signal.explanation && (
        <div className="rounded-xl border border-border-default bg-bg-surface px-5 py-4">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">
            AI Explanation
          </div>
          <p className="text-[13px] text-text-primary leading-relaxed whitespace-pre-line">
            {signal.explanation}
          </p>
        </div>
      )}

      {/* Price chart */}
      <SignalPriceChart signal={signal} />

      {/* On-chain evidence */}
      {((signal.whale_wallets?.length > 0) || (signal.tx_hashes?.length > 0)) && (
        <div className="rounded-xl border border-border-default bg-bg-surface px-5 py-4 space-y-4">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">
            On-Chain Evidence
          </div>

          {signal.whale_wallets?.length > 0 && (
            <div>
              <div className="text-[11px] text-text-muted mb-2">Whale Wallets</div>
              <ul className="space-y-1">
                {signal.whale_wallets.map((addr) => (
                  <li key={addr}>
                    <a
                      href={`https://etherscan.io/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12px] font-mono text-signal
                                 hover:underline underline-offset-2"
                      aria-label={`View wallet ${addr} on Etherscan`}
                    >
                      {truncAddr(addr)}
                      <ExternalLink size={10} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {signal.tx_hashes?.length > 0 && (
            <div>
              <div className="text-[11px] text-text-muted mb-2">Transactions</div>
              <ul className="space-y-1">
                {signal.tx_hashes.map((hash) => (
                  <li key={hash}>
                    <a
                      href={`https://etherscan.io/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12px] font-mono text-text-muted
                                 hover:text-text-primary hover:underline underline-offset-2"
                      aria-label={`View transaction ${hash} on Etherscan`}
                    >
                      {truncAddr(hash, 10)}
                      <ExternalLink size={10} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Metadata footer */}
      <div className="text-[11px] text-text-muted font-mono border-t border-border-subtle pt-4 flex flex-wrap gap-4">
        {signal.created_at && (
          <span>Issued: {new Date(signal.created_at).toLocaleString()}</span>
        )}
        {signal.outcome_return != null && (
          <span className={signal.outcome_return >= 0 ? 'text-signal' : 'text-loss'}>
            Return: {signal.outcome_return >= 0 ? '+' : ''}{signal.outcome_return}%
          </span>
        )}
      </div>
    </div>
  );
}
