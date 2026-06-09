import { memo, useMemo } from 'react';
import Sparkline from '../ui/Sparkline';
import { resolveSparklineData, sparklineReturnPct } from '../../lib/chartUtils';

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';
}

function fmtMetric(v, suffix = '') {
  if (v == null || v === '') return '—';
  return `${v}${suffix}`;
}

function CopyTraderRow({ wallet, index, isSelected, isTracked, onSelect }) {
  const m = wallet.metrics || {};
  const oc = wallet.on_chain_data || {};
  const sparkData = useMemo(() => resolveSparklineData(wallet), [wallet]);
  const returnPct = sparklineReturnPct(wallet);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(wallet)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(wallet)}
      className={`grid items-center gap-x-3 px-4 py-3 border-b border-border-subtle last:border-0 cursor-pointer transition-colors min-w-[900px] ${
        isSelected ? 'bg-bg-elevated border-l-2 border-l-green' : 'hover:bg-bg-elevated/60'
      }`}
      style={{ gridTemplateColumns: '36px minmax(140px,1.2fr) 72px 80px 80px 80px 88px 100px 90px' }}
    >
      <span className="text-[11px] text-text-muted font-mono">{wallet.rank ?? index + 1}</span>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-medium text-text-primary truncate">
            {wallet.label || `DEX Trader #${wallet.rank ?? index + 1}`}
          </span>
          {isTracked && (
            <span className="flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded bg-blue/15 text-blue border border-blue/25 uppercase tracking-wide font-semibold">
              Tracked
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-text-muted mt-0.5">{shortAddr(wallet.address)}</div>
      </div>

      <span className={`font-mono text-[12px] font-bold text-right ${
        (m.win_rate_pct ?? 0) >= 60 ? 'text-green' : 'text-text-secondary'
      }`}>
        {fmtMetric(m.win_rate_pct, '%')}
      </span>

      <span className={`font-mono text-[12px] font-bold text-right ${
        (m.profit_factor ?? 0) >= 2 ? 'text-green' : 'text-text-secondary'
      }`}>
        {m.profit_factor != null ? Number(m.profit_factor).toFixed(1) : '—'}
      </span>

      <span className="font-mono text-[12px] text-text-secondary text-right">
        {m.max_drawdown_pct != null ? `${m.max_drawdown_pct}%` : '—'}
      </span>

      <span className="font-mono text-[12px] text-text-secondary text-right">
        {m.avg_trade_duration_hrs != null
          ? `${Number(m.avg_trade_duration_hrs).toFixed(0)}h`
          : '—'}
      </span>

      <span className="font-mono text-[12px] text-text-secondary text-right">
        {fmtMetric(m.track_record_days, 'd')}
      </span>

      <div className="flex flex-col items-end gap-0.5">
        <Sparkline data={sparkData} width={88} height={28} />
        {returnPct != null && (
          <span className={`text-[9px] font-mono ${returnPct >= 0 ? 'text-green' : 'text-red'}`}>
            {returnPct >= 0 ? '+' : ''}{Number(returnPct).toFixed(1)}% est.
          </span>
        )}
      </div>

      <span className="font-mono text-[12px] font-bold text-green text-right">
        {wallet.copy_trading_score != null ? Number(wallet.copy_trading_score).toFixed(0) : '—'}
      </span>
    </div>
  );
}

export default memo(CopyTraderRow);
