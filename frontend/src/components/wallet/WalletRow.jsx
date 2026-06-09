import { memo, useMemo } from 'react';
import { motion } from 'motion/react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Tooltip from '../ui/Tooltip';
import { ChainBadge, SignalPill } from '../ui/Badge';
import Sparkline from '../ui/Sparkline';
import { buildBalanceSparkline } from '../../lib/chartUtils';

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
  const n = Number(value ?? 0);
  if (n >= 100_000) return `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K ETH`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K ETH`;
  if (n >= 1_000) return `${(n / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K ETH`;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ETH`;
}

function scoreTextClass(score) {
  if (score >= 80) return 'text-score-high';
  if (score >= 60) return 'text-score-mid';
  return 'text-score-low';
}

const EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Kraken', 'KuCoin', 'OKX', 'Crypto.com', 'Gemini', 'Bitstamp', 'Coinone', 'MEV Bot'];

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
  const balanceClass = Number(wallet.balance) > 1000 ? 'text-text-primary font-semibold' : 'text-text-secondary';
  const isExchange = EXCHANGE_NAMES.some((n) => wallet.label?.includes(n));

  const sparkData = useMemo(() => {
    if (wallet.transactions?.length) {
      return buildBalanceSparkline(wallet.transactions, wallet.balance);
    }
    if (wallet.ytd_growth_pct != null && wallet.balance != null) {
      const start = wallet.ytd_start_balance ?? wallet.balance * 0.9;
      return [{ balance: start }, { balance: wallet.balance }];
    }
    return [];
  }, [wallet.transactions, wallet.balance, wallet.ytd_growth_pct, wallet.ytd_start_balance]);

  const ytdPct = wallet.ytd_growth_pct;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      whileHover={{ backgroundColor: 'rgba(26, 26, 32, 0.8)' }}
      className={`group grid grid-cols-[36px_minmax(0,1fr)_70px_100px_150px_90px_130px_100px_70px] gap-x-3 px-4 py-3.5 border-b border-border-subtle last:border-0 transition-colors duration-100 cursor-pointer ${
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
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-[13px] font-medium text-text-primary">{name}</span>
            {isExchange && (
              <span className="flex-shrink-0 text-[9px] px-1 py-0.5 bg-bg-overlay border border-border-subtle rounded text-text-muted uppercase tracking-wide">
                Exchange
              </span>
            )}
          </div>
        </Tooltip>
        <div className="font-mono text-[10px] text-text-muted mt-0.5">{truncateAddress(wallet.address)}</div>
      </div>
      <div><ChainBadge chain={wallet.chain} /></div>
      <div className="overflow-hidden">
        <div className="w-full h-[2px] bg-bg-elevated rounded-full mb-1.5" style={{ maxWidth: '56px' }}>
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              score >= 80 ? 'bg-score-high' : score >= 60 ? 'bg-score-mid' : 'bg-score-low'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className={`text-[12px] font-mono font-bold ${scoreTextClass(score)}`}>
          {score}
        </div>
      </div>
      <div className={`font-mono text-[12px] ${balanceClass}`.trim()}>
        {formatBalance(wallet.balance)}
      </div>
      {/* Trend sparkline */}
      <div className="flex flex-col items-end gap-0.5">
        <Sparkline data={sparkData} width={80} height={28} />
        {sparkData.length >= 2 && (
          <span className={`text-[9px] font-mono ${
            (ytdPct ?? 0) >= 0 ? 'text-green' : 'text-red'
          }`}>
            {ytdPct != null
              ? `${ytdPct >= 0 ? '+' : ''}${ytdPct.toFixed(1)}% YTD`
              : (sparkData[sparkData.length - 1]?.balance ?? 0) >= (sparkData[0]?.balance ?? 0) ? '▲ YTD' : '▼ YTD'}
          </span>
        )}
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
    </motion.div>
  );
}

export default memo(WalletRow);
