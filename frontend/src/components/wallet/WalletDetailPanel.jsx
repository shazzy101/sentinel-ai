import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import ScoreRing from '../ui/ScoreRing';
import { ChainBadge, GradeBadge, RiskBadge, SignalPill } from '../ui/Badge';

const API_BASE = import.meta.env.VITE_API_URL || '';

function gradeFromScore(score) {
  if (score >= 92) return 'S';
  if (score >= 82) return 'A';
  if (score >= 68) return 'B';
  if (score >= 52) return 'C';
  if (score >= 36) return 'D';
  return 'F';
}

// Scale raw breakdown points to 0-100 percentages for visual bars.
// API returns: activity (0-35), success_rate (0-30), balance (0-25), recency (0-10).
function scaleBreakdown(breakdown, score) {
  if (!breakdown) {
    const base = score;
    return {
      activity: Math.max(20, Math.min(100, base - 6)),
      success_rate: Math.max(20, Math.min(100, base + 4)),
      balance: Math.max(20, Math.min(100, base - 2)),
      recency: Math.max(20, Math.min(100, base + 8)),
    };
  }
  return {
    activity: Math.round(((breakdown.activity ?? 0) / 35) * 100),
    success_rate: Math.round(((breakdown.success_rate ?? 0) / 30) * 100),
    balance: Math.round(((breakdown.balance ?? 0) / 25) * 100),
    recency: Math.round(((breakdown.recency ?? 0) / 10) * 100),
  };
}

function BreakdownBar({ label, value, max = 100 }) {
  const pct = Math.round((value / max) * 100);
  const colorClass = pct >= 80 ? 'fill-score-high' : pct >= 60 ? 'fill-score-mid' : 'fill-score-low';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-text-muted">{label}</span>
        <span className="text-[11px] font-mono text-text-secondary">{value}</span>
      </div>
      <svg className="h-[2px] w-full overflow-visible" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="100" height="2" className="fill-bg-elevated" rx="1" />
        <rect x="0" y="0" width={pct} height="2" className={colorClass} rx="1" />
      </svg>
    </div>
  );
}

export default function WalletDetailPanel({ wallet, onClose, onRescan, onRemove }) {
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(false);
  const scrollRef = useRef(null);

  const score = Number(wallet?.score || 0);
  const grade = gradeFromScore(score);
  const risk = wallet?.analysis?.risk_level || (score >= 80 ? 'LOW' : score >= 60 ? 'MEDIUM' : 'HIGH');
  const tags = (wallet?.analysis?.tags?.length ? wallet.analysis.tags : wallet?.tags) || [];
  const analysis = wallet?.analysis || {};
  const breakdown = scaleBreakdown(wallet?.score_breakdown, score);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [wallet?.address]);

  if (!wallet) return null;

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await fetch(`${API_BASE}/api/watchlist/${wallet.address}`, { method: 'DELETE' });
    } finally {
      setRemoving(false);
      onRemove?.();
    }
  };

  return (
    <aside className="w-[340px] flex-shrink-0 h-full min-h-0 bg-bg-surface border-l border-border-subtle flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle relative">
        <div className="font-display text-[15px] font-bold text-text-primary pr-8 leading-tight">
          {wallet.label || 'Unnamed wallet'}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ChainBadge chain={wallet.chain} />
          {wallet.balance != null && (
            <span className="text-[11px] font-mono text-text-secondary">
              {Number(wallet.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH
            </span>
          )}
        </div>
        <Button variant="icon" className="absolute right-4 top-3" onClick={onClose} aria-label="Close panel">
          ✕
        </Button>
      </div>

      {/* Address */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-border-subtle">
        <div className="flex items-start gap-2">
          <div className="font-mono text-[11px] text-text-secondary break-all flex-1 leading-relaxed">
            {wallet.address}
          </div>
          <Button
            variant="icon"
            aria-label="Copy address"
            onClick={async () => {
              if (!wallet.address) return;
              await navigator.clipboard.writeText(wallet.address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <span className="text-green text-[13px]">✓</span> : '⧉'}
          </Button>
        </div>
      </div>

      {/* Score + breakdown */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle">
        <div className="flex items-start gap-1 mb-3">
          <span className="flex-1 text-[10px] uppercase tracking-[1px] text-text-muted">Score</span>
          <GradeBadge grade={grade} />
        </div>
        <div className="flex gap-4">
          <ScoreRing score={score} size={64} />
          <div className="flex-1 flex flex-col gap-2">
            <BreakdownBar label="Activity" value={breakdown.activity} />
            <BreakdownBar label="Success Rate" value={breakdown.success_rate} />
            <BreakdownBar label="Balance" value={breakdown.balance} />
            <BreakdownBar label="Recency" value={breakdown.recency} />
          </div>
        </div>
      </div>

      {/* Scrollable AI analysis */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-3">AI Analysis</div>

        <div className="flex items-center gap-2 flex-wrap">
          <SignalPill signal={wallet.signal || 'NEUTRAL'} />
          {wallet.last_scanned && (
            <span className="text-[10px] text-text-muted font-mono">
              Updated {new Date(wallet.last_scanned).toLocaleDateString()}
            </span>
          )}
        </div>

        <p className="text-[12px] text-text-secondary mt-2 leading-[1.6]">
          {analysis.signal_reason || wallet.signal_reason || 'Awaiting AI analysis. Run a scan to generate insights.'}
        </p>

        {analysis.activity_summary && (
          <p className="text-[12px] text-text-secondary leading-[1.6] mt-3">
            {analysis.activity_summary}
          </p>
        )}

        {analysis.key_insight && (
          <div className="bg-green-dim border border-green-border rounded-lg p-3 mt-3">
            <div className="text-[10px] text-green uppercase tracking-[1px] mb-1.5">💡 Key insight</div>
            <p className="text-[12px] text-text-secondary leading-[1.6]">
              {analysis.key_insight}
            </p>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <RiskBadge level={risk} />
          </div>
          <span className="text-[11px] text-text-muted leading-[1.5]">
            {analysis.risk_reason || 'Risk profile inferred from transaction patterns.'}
          </span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pb-2">
            {tags.map((tag) => (
              <span key={tag} className="text-[10px] bg-bg-elevated border border-border-default rounded px-1.5 py-0.5 text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 px-5 py-4 bg-bg-surface border-t border-border-subtle">
        <Button variant="ghost" fullWidth onClick={onRescan}>Rescan wallet</Button>
        <Button
          variant="danger"
          fullWidth
          className="mt-2"
          disabled={removing}
          onClick={handleRemove}
        >
          {removing ? <><Spinner size="sm" /> Removing...</> : 'Remove from watchlist'}
        </Button>
      </div>
    </aside>
  );
}
