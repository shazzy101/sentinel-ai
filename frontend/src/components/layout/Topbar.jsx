import CommandPalette, { CommandTrigger } from '../primitives/CommandPalette';

export default function Topbar({ title, actions = null, onOpenCommand }) {
  return (
    <header className="relative z-20 flex-shrink-0 px-4 py-3 md:px-5">
      <div className="glass-surface flex h-12 items-center gap-4 rounded-2xl px-4 shadow-card">
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
