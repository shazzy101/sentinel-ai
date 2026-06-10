import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Column header tooltip rendered in a portal so it isn't clipped by overflow containers.
 */
export default function ColumnTooltip({ label, tip, align = 'right', className = '' }) {
  const triggerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    let left = r.left + r.width / 2;
    let transform = 'translate(-50%, -100%)';
    if (align === 'right') {
      left = r.right;
      transform = 'translate(-100%, -100%)';
    } else if (align === 'left') {
      left = r.left;
      transform = 'translate(0, -100%)';
    }
    setPos({ top: r.top - gap, left, transform });
  }, [align]);

  const show = () => {
    updatePosition();
    setVisible(true);
  };

  const hide = () => setVisible(false);

  useEffect(() => {
    if (!visible) return undefined;
    const onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', hide);
    };
  }, [visible]);

  return (
    <>
      <div
        ref={triggerRef}
        className={`flex items-center gap-1 cursor-default ${align === 'right' ? 'justify-end' : ''} ${className}`.trim()}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        aria-describedby={visible ? `tip-${label}` : undefined}
      >
        <span>{label}</span>
        <span
          className="text-[8px] text-text-muted border border-border-subtle rounded-full w-3 h-3 flex items-center justify-center flex-shrink-0"
          aria-hidden
        >
          ?
        </span>
      </div>
      {visible && pos && createPortal(
        <div
          id={`tip-${label}`}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: pos.transform,
            zIndex: 9999,
          }}
          className="w-56 max-w-[min(16rem,calc(100vw-1.5rem))] rounded-xl border border-border-default bg-bg-overlay px-3 py-2.5 shadow-card text-[11px] text-text-secondary leading-relaxed text-left pointer-events-none"
        >
          {tip}
        </div>,
        document.body,
      )}
    </>
  );
}
