import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ content, children, placement = 'top' }) {
  const triggerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    if (placement === 'bottom') {
      setPos({
        top: r.bottom + gap,
        left: r.left + r.width / 2,
        transform: 'translate(-50%, 0)',
      });
    } else {
      setPos({
        top: r.top - gap,
        left: r.left + r.width / 2,
        transform: 'translate(-50%, -100%)',
      });
    }
  }, [placement]);

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
      <span
        ref={triggerRef}
        className="inline-flex max-w-full"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {visible && pos && createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: pos.transform,
            zIndex: 9999,
          }}
          className="pointer-events-none max-w-xs rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1.5 text-[11px] text-text-secondary shadow-card whitespace-normal break-words"
        >
          {content}
        </span>,
        document.body,
      )}
    </>
  );
}
