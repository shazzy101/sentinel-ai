import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTradingData } from '@/hooks/useTradingData';

const TRADING_NAV = [
  { label: 'Dashboard', path: '/trading' },
  { label: 'Paper Terminal', path: '/trading/paper' },
  { label: 'Backtest', path: '/trading/backtest' },
  { label: 'Signals', path: '/trading/signals' },
  { label: 'Strategies', path: '/trading/strategies' },
  { label: 'Journal', path: '/trading/journal' },
  { label: 'Track Record', path: '/trading/track-record' },
  { label: 'Admin', path: '/trading/admin' },
];

function TopBar() {
  const { data, stale } = useTradingData('/api/trading/portfolio', { intervalMs: 60000 });
  const { data: health } = useTradingData('/api/trading/health', { intervalMs: 60000 });
  const cap = data?.current_capital;
  const ret = data?.stats?.total_return_pct;
  const wr = data?.stats?.win_rate;
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] px-6 py-3 text-sm">
      <div>
        <span className="text-text-muted">Capital </span>
        <span className="font-semibold tabular-nums">
          {cap != null ? `$${cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
        </span>
      </div>
      <div>
        <span className="text-text-muted">Return </span>
        <span className={cn('font-semibold tabular-nums', ret >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {ret != null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : '—'}
        </span>
      </div>
      <div>
        <span className="text-text-muted">Win rate </span>
        <span className="font-semibold tabular-nums">{wr != null ? `${wr.toFixed(0)}%` : '—'}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 text-xs">
        <span className={cn('h-2 w-2 rounded-full', stale ? 'bg-red-500' : 'bg-emerald-500')} />
        <span className="text-text-muted">{stale ? 'STALE' : 'LIVE'}</span>
        {health?.market_open != null && (
          <span className="text-text-muted">· market {health.market_open ? 'open' : 'closed'}</span>
        )}
      </div>
    </div>
  );
}

export default function TradingLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#060810] text-text-primary">
      <aside className="w-56 shrink-0 border-r border-white/[0.06] p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-sm font-bold tracking-wide">APEX</span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">PAPER</span>
        </div>
        <nav className="flex flex-col gap-1">
          {TRADING_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/trading'}
              className={({ isActive }) =>
                cn('rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                  isActive ? 'bg-white/[0.06] text-text-primary' : 'text-text-muted hover:text-text-secondary')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
