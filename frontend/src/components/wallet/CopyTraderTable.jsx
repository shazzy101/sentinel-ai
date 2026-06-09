import GlassCard from '../primitives/GlassCard';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import CopyTraderRow from './CopyTraderRow';

function HeaderRow() {
  return (
    <div
      className="grid gap-x-3 px-4 py-3 bg-bg-surface border-b border-border-default text-[10px] uppercase tracking-[1.2px] text-text-muted min-w-[900px] sticky top-0 z-10"
      style={{ gridTemplateColumns: '36px minmax(140px,1.2fr) 72px 80px 80px 80px 88px 100px 90px' }}
    >
      <div>#</div>
      <div>Trader</div>
      <div className="text-right">Win%</div>
      <div className="text-right">PF</div>
      <div className="text-right">Max DD</div>
      <div className="text-right">Duration</div>
      <div className="text-right">Track</div>
      <div className="text-right">P&L Trend</div>
      <div className="text-right">Score</div>
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
        <span className="text-[11px] text-text-muted">
          {totalQualified?.toLocaleString() ?? wallets.length} real DEX traders · bots filtered · ranked by copy-trading score
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
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
