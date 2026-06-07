import { useState } from 'react';

export default function Tooltip({ content, children }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap bg-bg-overlay border border-border-default rounded px-2 py-1 text-[11px] text-text-secondary">
          {content}
        </span>
      ) : null}
    </span>
  );
}
