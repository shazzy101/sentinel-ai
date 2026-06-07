export default function Topbar({ title, actions = null }) {
  return (
    <header className="h-12 px-5 border-b border-border-subtle bg-bg-base flex items-center">
      <div className="font-display text-[13px] font-medium text-text-secondary uppercase tracking-[1px]">
        {title}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {actions}
      </div>
    </header>
  );
}
