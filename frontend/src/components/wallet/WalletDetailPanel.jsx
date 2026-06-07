import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import ScoreRing from '../ui/ScoreRing';
import { ChainBadge, GradeBadge, RiskBadge, SignalPill } from '../ui/Badge';

const EXCHANGE_ADDRESSES = new Set([
  '0x28c6c06298d514db089934071355e5743bf21d60',
  '0x21a31ee1afc51d94c2efccaa1486ffa9c4a2a28',
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f',
  '0x4634d53b02f8329a07f5f60e9ac0b35843be9a72',
  '0x0dfd5e9a5e0d5b8a8d5e8a4a8f3b0e7c1e8b3a2e',
  '0x9696c1b0e96eea04dcef3d8d0d9c2e6f4c7a1b3',
  '0x4976c1b0e96eea04dcef3d8d0d9c2e6f4c7a2327',
  '0xcffa43e5e01c0ae7b09e7d5e8a4a8f3b0e7c0703',
  '0x6262c1b0e96eea04dcef3d8d0d9c2e6f4c7a2a23',
]);

function getAutoTags(wallet, score) {
  const tags = [];
  const addrLower = (wallet.address || '').toLowerCase();
  const isExchange = EXCHANGE_ADDRESSES.has(addrLower);
  if (isExchange) tags.push('Exchange');
  if (!isExchange && score > 90) tags.push('High Conviction');
  if (!isExchange && score > 80) tags.push('Smart Money');
  return tags;
}

function getUserTags(address) {
  try {
    return JSON.parse(localStorage.getItem(`sentinel-tags-${address}`) || '[]');
  } catch { return []; }
}

function saveUserTags(address, tags) {
  localStorage.setItem(`sentinel-tags-${address}`, JSON.stringify(tags));
}

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
  const [userTags, setUserTags] = useState(() => getUserTags(wallet?.address));
  const [newTag, setNewTag] = useState('');
  const scrollRef = useRef(null);

  const score = Number(wallet?.score || 0);
  const grade = gradeFromScore(score);
  const risk = wallet?.analysis?.risk_level || (score >= 80 ? 'LOW' : score >= 60 ? 'MEDIUM' : 'HIGH');
  const analysisTags = (wallet?.analysis?.tags?.length ? wallet.analysis.tags : wallet?.tags) || [];
  const autoTags = getAutoTags(wallet || {}, score);
  const allTags = [...new Set([...autoTags, ...analysisTags, ...userTags])];
  const analysis = wallet?.analysis || {};
  const breakdown = scaleBreakdown(wallet?.score_breakdown, score);

  useEffect(() => {
    setUserTags(getUserTags(wallet?.address));
  }, [wallet?.address]);

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

      {/* Address + Tags */}
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
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-green stroke-current">
                <path d="M2.5 7L5.5 10L11.5 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
                <rect x="5" y="1" width="8" height="10" rx="1.5" strokeWidth="1.2" />
                <path d="M9 11v1.5A1.5 1.5 0 017.5 14H2A1.5 1.5 0 01.5 12.5V4A1.5 1.5 0 012 2.5h1.5" strokeWidth="1.2" />
              </svg>
            )}
          </Button>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {allTags.map((tag) => (
              <span key={tag} className="bg-bg-elevated border border-border-default rounded-full px-2 py-0.5 text-[10px] text-text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}
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

        {analysisTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pb-2">
            {analysisTags.map((tag) => (
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
