import { useEffect, useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import ScoreRing from '../components/ui/ScoreRing';
import { GradeBadge, SignalPill } from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';

function gradeFromScore(score) {
  if (score >= 92) return 'S';
  if (score >= 82) return 'A';
  if (score >= 68) return 'B';
  if (score >= 52) return 'C';
  if (score >= 36) return 'D';
  return 'F';
}

function scoreTextClass(score) {
  if (score >= 80) return 'text-score-high';
  if (score >= 60) return 'text-score-mid';
  return 'text-score-low';
}

// Scale raw points → 0-100 for bar rendering
function scaleBreakdown(bd, score) {
  if (!bd) {
    const b = score;
    return { activity: b, success_rate: b, balance: b, recency: b };
  }
  return {
    activity:     Math.round(((bd.activity     ?? 0) / 35) * 100),
    success_rate: Math.round(((bd.success_rate ?? 0) / 30) * 100),
    balance:      Math.round(((bd.balance      ?? 0) / 25) * 100),
    recency:      Math.round(((bd.recency      ?? 0) / 10) * 100),
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
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-4 rounded-xl">
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-muted mb-2">{label}</div>
      <div className={`font-display text-[22px] font-bold ${colorClass}`}>{value}</div>
      {sub ? <div className="text-[11px] text-text-muted mt-1">{sub}</div> : null}
    </div>
  );
}

function ScoreRow({ wallet, rank }) {
  const score = Number(wallet.score ?? 0);
  const grade = gradeFromScore(score);
  const bd = scaleBreakdown(wallet.score_breakdown, score);
  const rawBd = wallet.score_breakdown || {};

  return (
    <div
      className="grid grid-cols-[32px_minmax(0,1fr)_56px_200px_80px_100px] items-center px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors duration-100 cursor-pointer"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('scoring-select-wallet', { detail: { wallet } }));
      }}
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

      {/* Breakdown bars — show raw points then visual bar */}
      <div className="px-2 grid grid-cols-4 gap-1 items-end">
        {[
          { key: 'activity',     val: bd.activity },
          { key: 'success_rate', val: bd.success_rate },
          { key: 'balance',      val: bd.balance },
          { key: 'recency',      val: bd.recency },
        ].map(({ key, val }) => (
          <div key={key}>
            <div className="text-[10px] font-mono text-text-secondary text-center mb-0.5">
              {rawBd[key] !== undefined && rawBd[key] !== null ? rawBd[key] : '—'}
            </div>
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

function GradeSection({ grade, wallets, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!wallets.length) return null;
  const gradeMeta = {
    S: { label: 'S — Elite', color: 'text-score-high', border: 'border-score-high/30' },
    A: { label: 'A — Strong', color: 'text-score-high', border: 'border-score-high/20' },
    B: { label: 'B — Solid', color: 'text-blue', border: 'border-blue-border' },
    C: { label: 'C — Average', color: 'text-score-mid', border: 'border-amber-border' },
    D: { label: 'D — Weak', color: 'text-score-low', border: 'border-red-border' },
    F: { label: 'F — Inactive', color: 'text-text-muted', border: 'border-border-subtle' },
  };
  const meta = gradeMeta[grade] || gradeMeta.F;

  return (
    <div className={`border ${meta.border} rounded-xl overflow-hidden mb-4`}>
      <button
        type="button"
        className="w-full px-5 py-2.5 bg-bg-surface border-b border-border-subtle flex items-center gap-2 hover:bg-bg-elevated transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`font-display text-[13px] font-bold ${meta.color}`}>{meta.label}</span>
        <span className="text-[11px] text-text-muted ml-1">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</span>
        <span className={`ml-auto text-text-muted`}><ChevronIcon open={open} /></span>
      </button>
      {open && (
        <div className="bg-bg-card">
          {/* Sub-header */}
          <div className="grid grid-cols-[32px_minmax(0,1fr)_56px_200px_80px_100px] px-5 py-2 text-[9px] uppercase tracking-[1.2px] text-text-muted border-b border-border-subtle">
            <div>#</div>
            <div>Wallet</div>
            <div className="text-center">Grade</div>
            <div className="px-2 grid grid-cols-4 gap-1 text-center">
              <div>Act</div><div>Suc</div><div>Bal</div><div>Rec</div>
            </div>
            <div className="text-center">Score</div>
            <div className="text-center">Signal</div>
          </div>
          {wallets.map((w, i) => (
            <ScoreRow key={w.address} wallet={w} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScoringPage() {
  const { wallets, loading } = useWatchlist();

  useEffect(() => { document.title = 'Scoring — Sentinel AI'; }, []);

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

  const sorted = [...wallets].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const scored = sorted.filter((w) => (w.score ?? 0) > 0);
  const unscored = sorted.filter((w) => !(w.score ?? 0));

  const avgScore = scored.length
    ? Math.round(scored.reduce((s, w) => s + (w.score ?? 0), 0) / scored.length)
    : 0;
  const highConviction = scored.filter((w) => (w.score ?? 0) >= 80).length;
  const topWallet = scored[0];
  const bullish = wallets.filter((w) => w.signal === 'BULLISH').length;

  // Group by grade
  const byGrade = { S: [], A: [], B: [], C: [], D: [], F: [] };
  for (const w of sorted) {
    const g = gradeFromScore(w.score ?? 0);
    byGrade[g]?.push(w);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-6">

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Avg Score"
            value={avgScore}
            sub={`across ${scored.length} scored wallets`}
            colorClass={scoreTextClass(avgScore)}
          />
          <StatCard
            label="High Conviction"
            value={highConviction}
            sub="score ≥ 80"
            colorClass="text-score-high"
          />
          <StatCard
            label="Bullish Signal"
            value={bullish}
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
        <div className="bg-bg-card border border-border-subtle rounded-xl p-4 mb-6">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-muted mb-3">Score methodology — v2</div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Activity', pts: '35pts', desc: 'Volume, recency, consistency of transactions' },
              { label: 'Success Rate', pts: '30pts', desc: 'Non-failed transactions vs total tx count' },
              { label: 'Balance Weight', pts: '25pts', desc: 'ETH held — proxy for whale status' },
              { label: 'Recency Bonus', pts: '10pts', desc: 'Active in last 7 days = full bonus' },
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
        </div>

        {/* Grade sections */}
        {['S', 'A', 'B', 'C', 'D', 'F'].map((g) => (
          <GradeSection key={g} grade={g} wallets={byGrade[g]} defaultOpen={g === 'S' || g === 'A'} />
        ))}

        {unscored.length > 0 && (
          <div className="text-[11px] text-text-muted text-center py-4">
            {unscored.length} wallet{unscored.length !== 1 ? 's' : ''} not yet scored — run a scan to generate scores.
          </div>
        )}
      </div>
    </div>
  );
}
