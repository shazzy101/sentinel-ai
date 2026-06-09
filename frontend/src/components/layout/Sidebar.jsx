import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  LayoutGrid, Sparkles, BarChart3, MessageSquare,
  LineChart, Bell, ExternalLink, Search, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motionTokens } from '@/design/motion';
import SentinelLogo from '../ui/SentinelLogo';

const API_BASE = import.meta.env.VITE_API_URL || '';

const NAV_ITEMS = [
  { label: 'Watchlist', icon: LayoutGrid, path: '/watchlist' },
  { label: 'Intelligence', icon: Sparkles, path: '/intelligence' },
  { label: 'Markets', icon: BarChart3, path: '/markets' },
  { label: 'Invest', icon: Zap, path: '/invest' },
  { label: 'Ask AI', icon: MessageSquare, path: '/ask' },
  { label: 'Scoring', icon: LineChart, path: '/scoring' },
  { label: 'Alerts', icon: Bell, path: '/alerts' },
];

function useAlertBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const handler = () => setCount((n) => n + 1);
    window.addEventListener('sentinel-alert-fired', handler);
    return () => window.removeEventListener('sentinel-alert-fired', handler);
  }, []);
  useEffect(() => {
    const clear = () => setCount(0);
    window.addEventListener('sentinel-alerts-viewed', clear);
    return () => window.removeEventListener('sentinel-alerts-viewed', clear);
  }, []);
  return count;
}

function useSidebarStats() {
  const [stats, setStats] = useState({ count: null, lastScanned: null, nextScan: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [watchlistRes, cronRes] = await Promise.all([
          fetch(`${API_BASE}/api/watchlist`),
          fetch(`${API_BASE}/api/admin/cron-status`),
        ]);
        if (!watchlistRes.ok) return;
        const body = await watchlistRes.json();
        if (cancelled || !body.success) return;
        const wallets = body.data?.wallets || [];
        let latestMs = 0;
        for (const w of wallets) {
          if (w.last_scanned) {
            const ms = new Date(w.last_scanned).getTime();
            if (ms > latestMs) latestMs = ms;
          }
        }
        let nextScan = null;
        if (cronRes.ok) {
          const cronBody = await cronRes.json();
          const nextRun = cronBody.data?.top_cron?.next_run;
          if (nextRun) nextScan = new Date(nextRun);
        }
        setStats({ count: wallets.length, lastScanned: latestMs > 0 ? new Date(latestMs) : null, nextScan });
      } catch { /* ignore */ }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return stats;
}

function useCountdown(targetDate) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!targetDate) { setLabel(''); return; }
    function compute() {
      const ms = targetDate.getTime() - Date.now();
      if (ms <= 0) { setLabel('now'); return; }
      const totalMins = Math.ceil(ms / 60_000);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      if (h === 0) setLabel(`${m}m`);
      else if (m === 0) setLabel(`${h}h`);
      else setLabel(`${h}h ${m}m`);
    }
    compute();
    const t = setInterval(compute, 60_000);
    return () => clearInterval(t);
  }, [targetDate]);
  return label;
}

function relativeLastScan(date) {
  if (!date) return '—';
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NavItem({ item, isActive, badge }) {
  const Icon = item.icon;
  return (
    <div className="relative">
      {isActive && (
        <motion.div
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl bg-white/[0.06] border border-white/[0.08] shadow-card"
          transition={motionTokens.springSoft}
        />
      )}
      <div
        className={cn(
          'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200',
          isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
        <span className="font-medium">{item.label}</span>
        {badge ? (
          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green px-1 text-[9px] font-bold text-text-inverse">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function Sidebar({ onOpenCommand }) {
  const { count, lastScanned, nextScan } = useSidebarStats();
  const alertCount = useAlertBadge();
  const nextScanLabel = useCountdown(nextScan);
  const location = useLocation();

  return (
    <aside className="relative z-30 flex w-[240px] flex-shrink-0 flex-col p-3">
      <div className="glass-surface flex h-full flex-col overflow-hidden rounded-2xl shadow-card">
        {/* Logo → landing page */}
        <div className="border-b border-white/[0.06] px-4 py-4">
          <SentinelLogo size={24} showWordmark />
        </div>

        {/* Command shortcut (mobile-visible) */}
        <div className="px-3 pt-3 md:hidden">
          <button
            type="button"
            onClick={onOpenCommand}
            className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-text-muted"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
            Search...
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const badge = item.label === 'Alerts' && alertCount > 0 ? alertCount : null;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={item.label === 'Alerts' ? () => window.dispatchEvent(new Event('sentinel-alerts-viewed')) : undefined}
              >
                {({ isActive }) => (
                  <NavItem item={item} isActive={isActive || location.pathname === item.path} badge={badge} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Live stats */}
        <div className="space-y-2 border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="relative h-1.5 w-1.5 rounded-full bg-green pulse-dot" />
            <span className="text-[11px] text-text-muted">
              {count !== null ? `${count} wallet${count !== 1 ? 's' : ''} tracked` : 'Loading...'}
            </span>
          </div>
          <div className="text-[11px] text-text-secondary">
            Last scan · {relativeLastScan(lastScanned)}
          </div>
          <div className="text-[11px] text-text-muted">
            {nextScanLabel ? `Next · ${nextScanLabel}` : 'Auto-scan · 6h'}
          </div>
        </div>

        {/* Landing link */}
        <div className="border-t border-white/[0.06] px-4 py-3">
          <a
            href="/"
            className="flex items-center gap-2 text-[11px] text-text-muted transition-colors hover:text-text-secondary"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
            View landing page
          </a>
        </div>

        {/* User */}
        <div className="flex items-center gap-2.5 border-t border-white/[0.06] px-4 py-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue/30 bg-blue/10 text-[11px] font-medium text-blue">
            SA
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-text-primary">Shazaib</div>
            <div className="text-[10px] text-text-muted">Beta</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
