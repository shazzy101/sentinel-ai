import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Copy, ExternalLink, TrendingUp, Loader2 } from 'lucide-react';
import GlassCard from '../primitives/GlassCard';
import { api } from '../../lib/api';

function relTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(String(ts).replace(' ', 'T')).getTime();
  if (Number.isNaN(ms)) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function scoreTone(s) {
  if (s >= 80) return 'text-green border-green/30 bg-green/10';
  if (s >= 60) return 'text-amber border-amber/30 bg-amber/10';
  return 'text-text-secondary border-border-default bg-bg-elevated/40';
}

function PickCard({ pick, onCopy, isActive }) {
  return (
    <motion.button
      type="button"
      onClick={() => onCopy(pick)}
      whileHover={{ y: -2 }}
      className={`flex-shrink-0 w-[300px] text-left rounded-2xl border p-4 transition-colors ${
        isActive ? 'border-green/40 bg-green/5 shadow-glow' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">{pick.whaleLabel}</div>
          <div className="text-[10px] font-mono text-text-muted mt-0.5">{relTime(pick.timestamp)}</div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2 py-1 rounded-lg border ${scoreTone(pick.ai_score)}`}>
          <Sparkles className="h-3 w-3" /> {pick.ai_score}
        </span>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 mb-2.5">
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Trade</div>
        <div className="text-sm font-mono text-text-primary">{pick.whaleAction}</div>
      </div>

      {Array.isArray(pick.ai_rationale) && pick.ai_rationale.length > 0 && (
        <ul className="space-y-1 mb-3">
          {pick.ai_rationale.slice(0, 3).map((r) => (
            <li key={r} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="w-1 h-1 rounded-full bg-green shrink-0" /> {r}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green">
          <Copy className="h-3 w-3" /> Copy as {pick.suggestedAmount} {pick.suggestedFrom}
        </span>
        {pick.txHash && (
          <a
            href={`https://etherscan.io/tx/${pick.txHash}`}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-text-muted hover:text-blue flex items-center gap-0.5"
          >
            Verify <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </motion.button>
  );
}

export default function AiCopyPicks({ onCopyTrade, activeTradeId }) {
  const [picks, setPicks] = useState([]);
  const [market, setMarket] = useState('NEUTRAL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getAiPicks(8)
        .then(({ picks: p, marketSignal }) => {
          if (cancelled) return;
          setPicks(p);
          setMarket(marketSignal);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 90_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const marketTone = market.includes('BULL') || market === 'ACCUMULATION' ? 'text-green'
    : market.includes('BEAR') || market === 'DISTRIBUTION' ? 'text-red' : 'text-amber';

  return (
    <GlassCard padding={false} className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-green" strokeWidth={1.75} />
          <div>
            <div className="text-sm font-semibold text-text-primary">AI's Top Trades to Copy</div>
            <div className="text-[11px] text-text-muted">Ranked by trader edge, ETH market fit &amp; recency</div>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-text-muted">
          ETH flow: <span className={`font-bold ${marketTone}`}>{market}</span>
        </span>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Scoring fresh moves…
          </div>
        ) : picks.length === 0 ? (
          <div className="py-6 text-center">
            <TrendingUp className="h-7 w-7 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-sm text-text-muted">No fresh picks right now — checking for new smart-money moves every 90s.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
            {picks.map((pick) => (
              <div key={pick.id} className="snap-start">
                <PickCard pick={pick} onCopy={onCopyTrade} isActive={activeTradeId === pick.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
