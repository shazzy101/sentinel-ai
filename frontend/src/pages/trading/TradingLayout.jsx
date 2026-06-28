import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

// Minimal shell for the APEX trading module. Sidebar + content.
// Top bar (ticker, portfolio summary, engine dot) lands in Step 13.
export default function TradingLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#060810] text-text-primary">
      <aside className="w-56 shrink-0 border-r border-white/[0.06] p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-sm font-bold tracking-wide">APEX</span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
            PAPER
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {TRADING_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/trading'}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-white/[0.06] text-text-primary'
                    : 'text-text-muted hover:text-text-secondary',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
