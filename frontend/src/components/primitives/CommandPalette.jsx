import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutGrid, Sparkles, BarChart3, MessageSquare,
  LineChart, Bell, Search, Command, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motionTokens, scaleIn } from '@/design/motion';

const NAV = [
  { label: 'Watchlist', path: '/watchlist', icon: LayoutGrid, kbd: 'W' },
  { label: 'AI Signals', path: '/intelligence', icon: Sparkles, kbd: 'I' },
  { label: 'Markets', path: '/markets', icon: BarChart3, kbd: 'M' },
  { label: 'Invest', path: '/invest', icon: Zap, kbd: 'T' },
  { label: 'Ask AI', path: '/ask', icon: MessageSquare, kbd: 'A' },
  { label: 'Scoring', path: '/scoring', icon: LineChart, kbd: 'S' },
  { label: 'Alerts', path: '/alerts', icon: Bell, kbd: 'L' },
];

export default function CommandPalette({ open, onOpenChange }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const setOpen = useCallback((v) => {
    onOpenChange?.(v);
    if (!v) setQuery('');
  }, [onOpenChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  const go = useCallback((path) => {
    setOpen(false);
    navigate(path);
  }, [navigate, setOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange?.(!open);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close command palette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={scaleIn.initial}
            animate={scaleIn.animate}
            exit={scaleIn.exit}
            transition={motionTokens.springSoft}
            className="fixed left-1/2 top-[18%] z-[101] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-overlay/95 shadow-elevated backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
              <Search className="h-4 w-4 text-text-muted shrink-0" strokeWidth={1.75} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages and actions..."
                className="flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-muted outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                esc
              </kbd>
            </div>
            <ul className="max-h-[320px] overflow-y-auto p-2">
              {filtered.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <button
                      type="button"
                      onClick={() => go(item.path)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
                        'text-[13px] text-text-secondary transition-colors',
                        'hover:bg-white/[0.05] hover:text-text-primary',
                        i === 0 && 'bg-white/[0.04] text-text-primary',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
                      <span className="flex-1 font-medium">{item.label}</span>
                      <kbd className="text-[10px] font-mono text-text-muted">{item.kbd}</kbd>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-3 py-8 text-center text-[13px] text-text-muted">No results</li>
              )}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CommandTrigger({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden md:flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-text-secondary"
    >
      <Command className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span>Search</span>
      <kbd className="ml-2 rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[10px] font-mono">⌘K</kbd>
    </button>
  );
}
