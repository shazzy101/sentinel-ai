import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { TextureCard } from '../ui/texture-card';
import WalletRow from './WalletRow';

function HeaderRow() {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)_64px_108px_150px_120px_100px_72px] gap-x-3 px-4 py-3 bg-bg-surface border-b border-border-default text-[10px] uppercase tracking-[1.2px] text-text-muted">
      <div>#</div>
      <div>Wallet</div>
      <div>Chain</div>
      <div>Score</div>
      <div>Balance</div>
      <div>Signal</div>
      <div>Last Active</div>
      <div>Actions</div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="p-5">
      <div className="skeleton h-8 rounded mb-3" />
      {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="grid grid-cols-[36px_minmax(0,1fr)_64px_108px_150px_120px_100px_72px] gap-x-3 px-4 items-center py-3.5 border-b border-border-subtle">
          <div className="skeleton rounded h-3 w-4" />
          <div className="space-y-2">
            <div className="skeleton rounded h-3 w-24" />
            <div className="skeleton rounded h-3 w-20" />
          </div>
          <div className="skeleton rounded h-3 w-12" />
          <div className="skeleton rounded h-3 w-16" />
          <div className="skeleton rounded h-3 w-20" />
          <div className="skeleton rounded h-3 w-16" />
          <div className="skeleton rounded h-3 w-12" />
          <div className="skeleton rounded h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="py-20 flex flex-col items-center text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-text-muted mb-3">
        <path d="M12 2.5L20 7V17L12 21.5L4 17V7L12 2.5Z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <div className="text-[15px] text-text-secondary font-display">No wallets tracked yet</div>
      <div className="text-[13px] text-text-muted mt-1 mb-4">Add your first whale wallet to get started</div>
      <Button variant="primary" onClick={onAdd}>+ Add wallet</Button>
    </div>
  );
}

export default function WalletTable({
  wallets,
  loading,
  error,
  selectedWallet,
  scanningIds,
  onSelectWallet,
  onScanWallet,
  onRetry,
  onOpenAddModal,
}) {
  if (loading) {
    return (
      <TextureCard className="h-full min-h-0 overflow-hidden">
        <LoadingRows />
      </TextureCard>
    );
  }

  if (error) {
    return (
      <TextureCard className="h-full min-h-0">
        <div className="px-5 py-4">
          <div className="text-red text-[13px] mb-3">{error}</div>
          <Button variant="ghost" onClick={onRetry}>
            <Spinner size="sm" />
            Retry
          </Button>
        </div>
      </TextureCard>
    );
  }

  if (!wallets.length) {
    return (
      <TextureCard className="h-full min-h-0">
        <EmptyState onAdd={onOpenAddModal} />
      </TextureCard>
    );
  }

  return (
    <TextureCard className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <HeaderRow />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {wallets.map((wallet, index) => (
          <WalletRow
            key={wallet.address}
            wallet={wallet}
            index={index}
            isSelected={selectedWallet?.address === wallet.address}
            isScanning={scanningIds.has(wallet.address)}
            onSelect={onSelectWallet}
            onScan={onScanWallet}
          />
        ))}
      </div>
    </TextureCard>
  );
}
