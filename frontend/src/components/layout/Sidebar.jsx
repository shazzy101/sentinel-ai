import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

function Icon({ name }) {
  if (name === 'grid') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
        <rect x="2" y="2" width="4" height="4" rx="1" strokeWidth="1.2" />
        <rect x="10" y="2" width="4" height="4" rx="1" strokeWidth="1.2" />
        <rect x="2" y="10" width="4" height="4" rx="1" strokeWidth="1.2" />
        <rect x="10" y="10" width="4" height="4" rx="1" strokeWidth="1.2" />
      </svg>
    );
  }
  if (name === 'sparkles') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
        <path d="M8 1.8L8.9 4.4L11.5 5.3L8.9 6.2L8 8.8L7.1 6.2L4.5 5.3L7.1 4.4L8 1.8Z" strokeWidth="1.1" />
        <path d="M12.5 8.8L13 10.1L14.3 10.6L13 11.1L12.5 12.4L12 11.1L10.7 10.6L12 10.1L12.5 8.8Z" strokeWidth="1.1" />
        <path d="M3.5 9.4L4 10.5L5.1 11L4 11.5L3.5 12.6L3 11.5L1.9 11L3 10.5L3.5 9.4Z" strokeWidth="1.1" />
      </svg>
    );
  }
  if (name === 'bell') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
        <path d="M8 2.3C6.1 2.3 4.8 3.7 4.8 5.7V7.1C4.8 8.1 4.4 9 3.8 9.7L3.1 10.5H12.9L12.2 9.7C11.6 9 11.2 8.1 11.2 7.1V5.7C11.2 3.7 9.9 2.3 8 2.3Z" strokeWidth="1.2" />
        <path d="M6.5 12.1C6.7 12.9 7.3 13.3 8 13.3C8.7 13.3 9.3 12.9 9.5 12.1" strokeWidth="1.2" />
      </svg>
    );
  }
  if (name === 'chart-line') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
        <path d="M2.2 11.6L5.9 7.9L8.1 10.1L13.8 4.4" strokeWidth="1.2" />
        <path d="M11 4.4H13.8V7.2" strokeWidth="1.2" />
      </svg>
    );
  }
  return null;
}

const NAV_ITEMS = [
  { label: 'Watchlist',    icon: 'grid',       path: '/' },
  { label: 'Intelligence', icon: 'sparkles',   path: '/intelligence' },
  { label: 'Scoring',      icon: 'chart-line', path: '/scoring' },
  { label: 'Alerts',       icon: 'bell',       path: '/alerts' },
];

function useAlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handler = () => setCount((n) => n + 1);
    window.addEventListener('sentinel-alert-fired', handler);
    return () => window.removeEventListener('sentinel-alert-fired', handler);
  }, []);

  // Clear badge when user visits /alerts
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
        const count = wallets.length;

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

        setStats({ count, lastScanned: latestMs > 0 ? new Date(latestMs) : null, nextScan });
      } catch {
        // silently ignore
      }
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

export default function Sidebar() {
  const { count, lastScanned, nextScan } = useSidebarStats();
  const alertCount = useAlertBadge();
  const nextScanLabel = useCountdown(nextScan);

  return (
    <aside className="w-[220px] flex-shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col">

      {/* Logo */}
      <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" className="flex-shrink-0">
          <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
        </svg>
        <span className="font-display text-[15px] font-bold tracking-[-0.5px] text-text-primary">SENTINEL</span>
        <span className="text-[9px] font-bold text-green tracking-[2px] uppercase bg-green/10 px-1.5 py-0.5 rounded">AI</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.soon) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2 text-[13px] relative select-none text-text-muted rounded-lg"
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-bg-overlay border border-border-default rounded text-text-muted uppercase tracking-[1px]">
                  Soon
                </span>
              </div>
            );
          }

          const badge = item.label === 'Alerts' && alertCount > 0 ? alertCount : null;

          return (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === '/'}
              onClick={item.label === 'Alerts' ? () => window.dispatchEvent(new Event('sentinel-alerts-viewed')) : undefined}
            >
              {({ isActive }) => (
                <div className={`flex items-center gap-3 py-2 text-[13px] relative select-none rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-bg-elevated text-text-primary pl-[10px] pr-3 border-l-2 border-green'
                    : 'px-3 text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
                }`.trim()}>
                  {isActive ? null : null}
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {badge ? (
                    <span className="ml-auto text-[9px] min-w-[18px] h-[18px] rounded-full bg-green text-text-inverse font-bold flex items-center justify-center px-1">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Live stats */}
      <div className="px-4 py-3 border-t border-border-subtle space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-[6px] w-[6px] rounded-full bg-green relative pulse-dot flex-shrink-0" />
          <span className="text-[11px] text-text-muted">
            {count !== null ? `${count} wallet${count !== 1 ? 's' : ''} tracked` : 'Loading...'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b7280" strokeWidth="1.1" className="flex-shrink-0">
            <circle cx="6" cy="6" r="4.2" />
            <path d="M6 3.7V6L7.6 7.1" strokeLinecap="round" />
          </svg>
          <span className="text-[11px] text-text-secondary">
            Last: {relativeLastScan(lastScanned)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b7280" strokeWidth="1.1" className="flex-shrink-0">
            <path d="M6 2v4l2.5 2.5" strokeLinecap="round" />
            <circle cx="6" cy="6" r="4.5" />
          </svg>
          <span className="text-[11px] text-text-secondary">
            {nextScanLabel ? `Next scan in ${nextScanLabel}` : 'Auto-scan: 6h cycle'}
          </span>
        </div>
      </div>

      {/* Landing page link */}
      <div className="px-4 pb-2">
        <a
          href="/landing"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-[11px] text-text-muted hover:text-text-secondary transition-colors py-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1">
            <path d="M6 1.5h4.5V6M5 7L10.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 2.5H2A.5.5 0 001.5 3v7a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V6.5" strokeLinecap="round" />
          </svg>
          View Landing Page
        </a>
      </div>

      {/* User */}
      <div className="px-4 py-3 border-t border-border-subtle flex items-center gap-2">
        <span className="h-7 w-7 rounded-full bg-blue-dim border border-blue-border flex items-center justify-center text-[11px] text-blue font-medium flex-shrink-0">
          SA
        </span>
        <span className="text-[11px] text-text-secondary truncate">Shazaib</span>
        <span className="text-[9px] bg-green-dim text-green px-1.5 rounded uppercase tracking-wide ml-auto flex-shrink-0">
          Pro
        </span>
      </div>
    </aside>
  );
}
