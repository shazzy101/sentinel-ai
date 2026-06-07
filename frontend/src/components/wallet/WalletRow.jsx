import { memo } from 'react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Tooltip from '../ui/Tooltip';
import { ChainBadge, SignalPill } from '../ui/Badge';

function truncateAddress(address) {
  if (!address) return '—';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function relativeTime(timestamp) {
  if (!timestamp) return '—';
  const ms = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatBalance(value) {
  return `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`;
}

function scoreTextClass(score) {
  if (score >= 80) return 'text-score-high';
  if (score >= 60) return 'text-score-mid';
  return 'text-score-low';
}

function WalletRow({
  wallet,
  index,
  isSelected,
  isScanning,
  onSelect,
  onScan,
}) {
  const name = wallet.label || 'Unnamed wallet';
  const score = Math.round(Number(wallet.score ?? 0));
  const balanceClass = Number(wallet.balance) > 10000 ? 'text-text-primary font-semibold' : 'text-text-secondary';

  return (
    <div
      className={`grid grid-cols-[28px_minmax(0,1fr)_80px_100px_120px_130px_90px_70px] px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors duration-100 cursor-pointer ${
        isSelected ? 'bg-bg-elevated border-l-2 border-l-green' : ''
      }`.trim()}
      onClick={() => onSelect(wallet)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect(wallet);
      }}
    >
      <div className="text-[11px] text-text-muted font-mono">{index + 1}</div>
      <div className="min-w-0">
        <Tooltip content={name}>
          <div className="truncate text-[13px] font-medium text-text-primary">{name}</div>
        </Tooltip>
        <div className="font-mono text-[10px] text-text-muted mt-0.5">{truncateAddress(wallet.address)}</div>
      </div>
      <div><ChainBadge chain={wallet.chain} /></div>
      <div>
        <div className="w-full h-[2px] bg-bg-elevated rounded-full mb-1">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background: score >= 80 ? '#00D992' : score >= 60 ? '#F59E0B' : '#FF4D4D',
            }}
          />
        </div>
        <div className={`text-right text-[12px] font-mono font-medium ${scoreTextClass(score)}`.trim()}>
          {score}
        </div>
      </div>
      <div className={`font-mono text-[12px] ${balanceClass}`.trim()}>
        {formatBalance(wallet.balance)}
      </div>
      <div>
        {wallet.signal ? <SignalPill signal={wallet.signal} /> : <span className="text-text-muted">—</span>}
      </div>
      <div className="text-[11px] text-text-muted font-mono">{relativeTime(wallet.last_scanned)}</div>
      <div onClick={(event) => event.stopPropagation()}>
        <Button
          variant="ghost"
          className="text-[11px] px-2.5 py-1"
          disabled={isScanning}
          onClick={() => onScan(wallet)}
        >
          {isScanning ? <Spinner size="sm" /> : 'Scan'}
        </Button>
      </div>
    </div>
  );
}

export default memo(WalletRow);
