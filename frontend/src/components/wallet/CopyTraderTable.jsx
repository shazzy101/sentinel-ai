import GlassCard from '../primitives/GlassCard';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import ColumnTooltip from '../ui/ColumnTooltip';
import CopyTraderRow from './CopyTraderRow';

const TOOLTIPS = {
  Trader: 'Ranked DEX wallet. ENS name when resolved; otherwise a shortened address. Click a row for full metrics and chart.',
  'Win%': 'Unrealized win rate — share of all positions (closed + still-held, marked to current market price) that are in profit. The honest number: it cannot be gamed by selling winners and holding losers the way a realized rate can. Falls back to realized until the on-chain figure is computed.',
  PF: 'Profit factor — gross wins ÷ gross losses. 2.0+ means $2 gained for every $1 lost. Very high values often mean selective, low-frequency trading.',
  'Max DD': 'Maximum drawdown — largest peak-to-trough decline in cumulative P&L. Under 15% is ideal for copy-trading. Shown as ~ when estimated from win rate and profit factor.',
  Duration: 'Average hours each position is held before closing. Longer holds (8h+) suggest conviction; very short holds may indicate scalping. Shown as ~ when estimated from trade frequency.',
  Track: 'Days of verified on-chain DEX activity between first and last trade. 90+ days filters out one-hit wonders.',
  'P&L Trend': 'Backtested year-to-date return from win rate and profit factor, plus a dashed 90-day forward outlook. Modelled — not a guarantee of future results.',
  Score: 'Hadaleum copy-trading score (0–100) weighting win rate, profit factor, drawdown, average hold time, and track record.',
};

function HeaderRow() {
  return (
    <div
      className="grid gap-x-3 px-4 py-3 bg-bg-surface border-b border-border-default text-[10px] uppercase tracking-[1.2px] text-text-muted min-w-[900px] sticky top-0 z-10"
      style={{ gridTemplateColumns: '36px minmax(140px,1.2fr) 72px 80px 80px 80px 88px 100px 90px' }}
    >
      <div>#</div>
      <div><ColumnTooltip label="Trader" tip={TOOLTIPS.Trader} align="left" /></div>
      <div className="text-right"><ColumnTooltip label="Win%" tip={TOOLTIPS['Win%']} align="right" /></div>
      <div className="text-right"><ColumnTooltip label="PF" tip={TOOLTIPS.PF} align="right" /></div>
      <div className="text-right"><ColumnTooltip label="Max DD" tip={TOOLTIPS['Max DD']} align="right" /></div>
      <div className="text-right"><ColumnTooltip label="Duration" tip={TOOLTIPS.Duration} align="right" /></div>
      <div className="text-right"><ColumnTooltip label="Track" tip={TOOLTIPS.Track} align="right" /></div>
      <div className="text-right"><ColumnTooltip label="P&L Trend" tip={TOOLTIPS['P&L Trend']} align="right" /></div>
      <div className="text-right"><ColumnTooltip label="Score" tip={TOOLTIPS.Score} align="right" /></div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-12 rounded-lg" />
      ))}
    </div>
  );
}

export default function CopyTraderTable({
  wallets,
  loading,
  error,
  selectedWallet,
  onSelectWallet,
  onRetry,
  totalQualified,
  trackedAddresses = new Set(),
}) {
  if (loading && !wallets.length) {
    return (
      <GlassCard padding={false} className="h-full min-h-0 overflow-hidden">
        <LoadingRows />
      </GlassCard>
    );
  }

  if (error && !wallets.length) {
    return (
      <GlassCard className="h-full min-h-0">
        <div className="px-5 py-8 text-center">
          <div className="text-red text-[14px] font-medium mb-2">Could not load copy traders</div>
          <div className="text-[12px] text-text-muted mb-4 max-w-md mx-auto">{error}</div>
          <p className="text-[11px] text-text-muted mb-4">
            Make sure the backend is running: <code className="font-mono text-green">uvicorn main:app --port 8000</code>
          </p>
          <Button variant="primary" onClick={onRetry}>Retry</Button>
        </div>
      </GlassCard>
    );
  }

  if (!loading && !wallets.length) {
    return (
      <GlassCard className="h-full min-h-0">
        <div className="px-5 py-12 text-center text-[13px] text-text-muted">
          No copy traders matched your filters. Try turning off Strict filters.
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding={false} className="h-full min-h-0 overflow-hidden" innerClassName="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-4 py-2 border-b border-border-subtle flex items-center justify-between">
        <span className="text-[11px] text-text-muted leading-relaxed">
          {totalQualified?.toLocaleString() ?? wallets.length} DEX traders ranked by edge, not ETH balance · low native ETH is normal
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto" aria-live="polite">
        <HeaderRow />
        {wallets.map((wallet, index) => (
          <CopyTraderRow
            key={wallet.address}
            wallet={wallet}
            index={index}
            isSelected={selectedWallet?.address === wallet.address}
            isTracked={trackedAddresses.has((wallet.address || '').toLowerCase())}
            onSelect={onSelectWallet}
          />
        ))}
      </div>
    </GlassCard>
  );
}
