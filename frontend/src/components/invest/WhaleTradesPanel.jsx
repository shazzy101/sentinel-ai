import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, ExternalLink, TrendingUp, Fish, Loader2 } from 'lucide-react';
import GlassCard from '../primitives/GlassCard';
import { api } from '../../lib/api';
import { SignalPill } from '../ui/Badge';

function relativeTime(ts) {
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function WhaleTradeCard({ trade, onCopy, isActive }) {
  return (
    <motion.button
      type="button"
      onClick={() => onCopy(trade)}
      whileHover={{ y: -2 }}
      className={`flex-shrink-0 w-[280px] text-left rounded-2xl border p-4 transition-colors ${
        isActive
          ? 'border-green/40 bg-green/5 shadow-glow'
          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">{trade.whaleLabel}</div>
          <div className="text-[10px] font-mono text-text-muted mt-0.5">
            Score {trade.whaleScore} · {relativeTime(trade.timestamp)}
          </div>
        </div>
        {trade.signal && <SignalPill signal={trade.signal} />}
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 mb-3">
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Whale moved</div>
        <div className="text-sm font-mono text-text-primary">{trade.whaleAction}</div>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-secondary mb-3">
        <TrendingUp className="h-3.5 w-3.5 text-green shrink-0" />
        <span>
          Copy as <span className="font-mono font-medium text-green">{trade.suggestedAmount} {trade.suggestedFrom}</span>
          {' → '}
          <span className="font-mono font-medium text-text-primary">{trade.suggestedTo}</span>
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green">
          <Copy className="h-3 w-3" /> Copy trade
        </span>
        {trade.txHash && (
          <a
            href={`https://etherscan.io/tx/${trade.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-text-muted hover:text-blue flex items-center gap-0.5"
          >
            Etherscan <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </motion.button>
  );
}

export default function WhaleTradesPanel({ onCopyTrade, activeTradeId }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getWhaleTrades()
      .then((data) => {
        if (!cancelled) setTrades(Array.isArray(data) ? data : data?.trades || []);
      })
      .catch(() => { if (!cancelled) setTrades([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    const iv = setInterval(() => {
      api.getWhaleTrades()
        .then((data) => setTrades(Array.isArray(data) ? data : data?.trades || []))
        .catch(() => {});
    }, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return (
    <GlassCard padding={false} className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Fish className="h-4 w-4 text-green" strokeWidth={1.75} />
          <div>
            <div className="text-sm font-semibold text-text-primary">Copy Whale Trades</div>
            <div className="text-[11px] text-text-muted">Mirror smart-money moves in one click</div>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-text-muted">On-chain</span>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading whale activity…
          </div>
        ) : trades.length === 0 ? (
          <p className="text-sm text-text-muted py-6 text-center">
            No recent whale moves yet. Trades appear here when tracked wallets make significant on-chain moves.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
            {trades.map((trade) => (
              <div key={trade.id} className="snap-start">
                <WhaleTradeCard
                  trade={trade}
                  onCopy={onCopyTrade}
                  isActive={activeTradeId === trade.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
