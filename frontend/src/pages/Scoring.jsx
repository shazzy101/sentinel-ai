import { useCallback, useEffect, useState } from 'react';
import { useWatchlist, useScanWallet } from '../hooks/useWatchlist';
import ScoreRing from '../components/ui/ScoreRing';
import { GradeBadge, SignalPill } from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import PremiumStatCard from '../components/ui/premium-stat-card';
import { TextureCard, TextureCardContent } from '../components/ui/texture-card';
import WalletDetailPanel from '../components/wallet/WalletDetailPanel';
import { useCountUp } from '../hooks/useCountUp';

function gradeFromScore(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

function scoreTextClass(score) {
  if (score >= 80) return 'text-score-high';
  if (score >= 60) return 'text-score-mid';
  return 'text-score-low';
}

// Scale raw points → 0-100 for bar rendering (v4 alpha maxes)
function scaleBreakdown(bd, score) {
  if (!bd) {
    const b = score;
    return { recency: b, activity: b, defi: b, success_rate: b, balance: b };
  }
  return {
    recency:      Math.round(((bd.recency      ?? 0) / 25) * 100),
    activity:     Math.round(((bd.activity     ?? 0) / 25) * 100),
    defi:         Math.round(((bd.defi         ?? 0) / 25) * 100),
    success_rate: Math.round(((bd.success_rate ?? 0) / 15) * 100),
    balance:      Math.round(((bd.balance      ?? 0) / 10) * 100),
  };
}

function MiniBar({ value, maxColor = 'bg-score-high' }) {
  const pct = Math.max(0, Math.min(100, value));
  const colorClass = pct >= 80 ? 'bg-score-high' : pct >= 60 ? 'bg-score-mid' : 'bg-score-low';
  return (
    <div className="h-1 w-full bg-bg-elevated rounded overflow-hidden">
      <div className={`h-full rounded ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, colorClass = 'text-text-primary' }) {
  return <PremiumStatCard label={label} value={value} sub={sub} valueClassName={colorClass} />;
}

function ScoreRow({ wallet, rank, onSelect }) {
  const score = Number(wallet.score ?? 0);
  const grade = gradeFromScore(score);
  const bd = scaleBreakdown(wallet.score_breakdown, score);

  return (
    <div
      className="grid grid-cols-[32px_minmax(0,1fr)_56px_240px_80px_100px] items-center px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors duration-100 cursor-pointer"
      onClick={() => onSelect?.(wallet)}
    >
      {/* Rank */}
      <div className="text-[11px] text-text-muted font-mono">{rank}</div>

      {/* Identity */}
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-text-primary truncate">{wallet.label || 'Unnamed'}</div>
        <div className="font-mono text-[10px] text-text-muted mt-0.5">
          {wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : '—'}
        </div>
      </div>

      {/* Grade */}
      <div className="flex justify-center"><GradeBadge grade={grade} /></div>

      {/* Breakdown bars — show raw points then visual bar (v4: Rec/Act/DeFi/Suc/Bal) */}
      <div className="px-2 grid grid-cols-5 gap-1 items-end">
        {[
          { key: 'recency', val: bd.recency, raw: wallet.score_breakdown?.recency ?? 0 },
          { key: 'activity', val: bd.activity, raw: wallet.score_breakdown?.activity ?? 0 },
          { key: 'defi', val: bd.defi, raw: wallet.score_breakdown?.defi ?? 0 },
          { key: 'success_rate', val: bd.success_rate, raw: wallet.score_breakdown?.success_rate ?? 0 },
          { key: 'balance', val: bd.balance, raw: wallet.score_breakdown?.balance ?? 0 },
        ].map(({ key, val, raw }) => (
          <div key={key}>
            <div className="font-mono text-[12px] text-right text-text-secondary px-2 mb-0.5">{raw}</div>
            <MiniBar value={val} />
          </div>
        ))}
      </div>

      {/* Score ring */}
      <div className="flex justify-center">
        <ScoreRing score={score} size={40} strokeWidth={3} />
      </div>

      {/* Signal */}
      <div className="flex justify-center">
        {wallet.signal
          ? <SignalPill signal={wallet.signal} />
          : <span className="text-text-muted text-[11px]">—</span>}
      </div>
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`stroke-current transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <path d="M3 4.5L6 7.5L9 4.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GradeSection({ grade, wallets, defaultOpen = false, onSelectWallet }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!wallets.length) return null;
  const gradeMeta = {
    S: { label: 'S — Elite', color: 'text-score-high', border: 'border-score-high/30' },
    A: { label: 'A — Strong', color: 'text-score-high', border: 'border-score-high/20' },
    B: { label: 'B — Solid', color: 'text-amber', border: 'border-amber/30' },
    C: { label: 'C — Average', color: 'text-score-mid', border: 'border-amber-border' },
    D: { label: 'D — Weak', color: 'text-score-low', border: 'border-red-border' },
    F: { label: 'F — Inactive', color: 'text-text-muted', border: 'border-border-subtle' },
  };
  const meta = gradeMeta[grade] || gradeMeta.F;

  return (
    <div className={`border ${meta.border} rounded-xl overflow-hidden mb-4`}>
      <button
        type="button"
        className="w-full px-5 py-2.5 bg-bg-surface/80 border-b border-border-subtle flex items-center gap-2 hover:bg-bg-elevated transition-colors backdrop-blur-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`font-display text-[13px] font-bold ${meta.color}`}>{meta.label}</span>
        <span className="text-[11px] text-text-muted ml-1">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</span>
        <span className={`ml-auto text-text-muted`}><ChevronIcon open={open} /></span>
      </button>
      {open && (
        <div className="bg-bg-card">
          {/* Sub-header */}
          <div className="grid grid-cols-[32px_minmax(0,1fr)_56px_240px_80px_100px] px-5 py-2 text-[9px] uppercase tracking-[1.2px] text-text-muted border-b border-border-subtle">
            <div>#</div>
            <div>Wallet</div>
            <div className="text-center">Grade</div>
            <div className="px-2 grid grid-cols-5 gap-1 text-center">
              <div title="Recency — how recently active">Rec</div>
              <div title="Activity — recent transaction frequency">Act</div>
              <div title="DeFi engagement — contract calls + token diversity">DeFi</div>
              <div title="Success rate — % of transactions that succeeded">Suc</div>
              <div title="Balance — mild confidence factor">Bal</div>
            </div>
            <div className="text-center">Score</div>
            <div className="text-center">Signal</div>
          </div>
          {wallets.map((w, i) => (
            <ScoreRow key={w.address} wallet={w} rank={i + 1} onSelect={onSelectWallet} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScoringPage() {
  const { wallets, loading, refetch } = useWatchlist();
  const { scan } = useScanWallet();
  const [selectedWallet, setSelectedWallet] = useState(null);

  useEffect(() => { document.title = 'Scoring — Sentinel AI'; }, []);

  const handleScan = useCallback(async (wallet) => {
    if (!wallet?.address) return;
    await scan(wallet.address, wallet.label);
    await refetch();
  }, [scan, refetch]);

  // All derived values and hooks must be called unconditionally before any early return
  const sorted = [...wallets].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const scored = sorted.filter((w) => (w.score ?? 0) > 0);
  const unscored = sorted.filter((w) => !(w.score ?? 0));

  const avgScore = scored.length
    ? Math.round(scored.reduce((s, w) => s + (w.score ?? 0), 0) / scored.length)
    : 0;
  const highConviction = scored.filter((w) => (w.score ?? 0) >= 80).length;
  const topWallet = scored[0];
  const bullish = wallets.filter((w) => w.signal === 'BULLISH').length;

  const animAvgScore = useCountUp(avgScore);
  const animHighConviction = useCountUp(highConviction);
  const animBullish = useCountUp(bullish);

  // Group by grade
  const byGrade = { S: [], A: [], B: [], C: [], D: [], F: [] };
  for (const w of sorted) {
    const g = gradeFromScore(w.score ?? 0);
    byGrade[g]?.push(w);
  }

  if (loading) {
    return (
      <div className="h-full min-h-0 overflow-y-auto flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted text-[13px]">
          <Spinner size="md" />
          Loading scoring data...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex overflow-hidden">
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-6">

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Avg Score"
            value={animAvgScore}
            sub={`across ${scored.length} scored wallets`}
            colorClass={scoreTextClass(avgScore)}
          />
          <StatCard
            label="High Conviction"
            value={animHighConviction}
            sub="score ≥ 80"
            colorClass="text-score-high"
          />
          <StatCard
            label="Bullish Signal"
            value={animBullish}
            sub="active wallets"
            colorClass="text-green"
          />
          <StatCard
            label="Top Wallet"
            value={topWallet ? `${topWallet.score}` : '—'}
            sub={topWallet?.label || ''}
            colorClass="text-text-primary"
          />
        </div>

        {/* Methodology card */}
        <TextureCard className="mb-6">
          <TextureCardContent className="p-4">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-muted mb-3">Score methodology — v4 “find the alpha”</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Recency', pts: '25pts', desc: 'How recently active. Dormant whales sink hard.' },
              { label: 'Activity', pts: '25pts', desc: 'Recent transaction frequency. ~50 txns = max.' },
              { label: 'DeFi Engagement', pts: '25pts', desc: 'Contract calls + token diversity = real trading.' },
              { label: 'Success Rate', pts: '15pts', desc: '% of transactions that succeeded.' },
              { label: 'Balance', pts: '10pts', desc: 'Mild confidence factor. Never the driver.' },
            ].map(({ label, pts, desc }) => (
              <div key={label}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-medium text-text-primary">{label}</span>
                  <span className="text-[10px] font-mono text-green">{pts}</span>
                </div>
                <div className="text-[11px] text-text-muted leading-[1.5]">{desc}</div>
              </div>
            ))}
          </div>
          </TextureCardContent>
        </TextureCard>

        {/* Grade sections */}
        {['S', 'A', 'B', 'C', 'D', 'F'].map((g) => (
          <GradeSection key={g} grade={g} wallets={byGrade[g]} defaultOpen={g === 'S' || g === 'A'} onSelectWallet={setSelectedWallet} />
        ))}

        {unscored.length > 0 && (
          <div className="text-[11px] text-text-muted text-center py-4">
            {unscored.length} wallet{unscored.length !== 1 ? 's' : ''} not yet scored — run a scan to generate scores.
          </div>
        )}
      </div>
    </div>
    {/* Detail panel */}
    <div className={`flex-shrink-0 h-full transition-all duration-200 ease-out ${selectedWallet ? 'w-[400px]' : 'w-0'} overflow-hidden border-l border-border-subtle`}>
      {selectedWallet && (
        <WalletDetailPanel
          wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
          onRescan={() => handleScan(selectedWallet)}
          onRemove={() => { setSelectedWallet(null); refetch(); }}
        />
      )}
    </div>
    </div>
  );
}
