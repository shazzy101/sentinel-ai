import { Menu } from 'lucide-react';
import CommandPalette, { CommandTrigger } from '../primitives/CommandPalette';

export default function Topbar({ title, actions = null, onOpenCommand, onOpenMobileSidebar }) {
  return (
    <header className="relative z-20 flex-shrink-0 px-3 py-3 md:px-5">
      <div className="glass-surface flex h-12 items-center gap-3 rounded-2xl px-3 md:px-4 shadow-card">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/[0.05] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <h1 className="font-display text-sm font-semibold tracking-tight text-text-primary truncate">
            {title}
          </h1>
        </div>
        <div className="flex-1" />
        <CommandTrigger onClick={onOpenCommand} />
        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>
    </header>
  );
}
