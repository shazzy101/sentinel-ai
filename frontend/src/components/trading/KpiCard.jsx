export default function KpiCard({ label, value, sub, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'text-text-primary',
    good: 'text-emerald-400',
    bad: 'text-red-400',
  }[tone] || 'text-text-primary';
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}
