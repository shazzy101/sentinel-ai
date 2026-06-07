import { useEffect } from 'react';

export default function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-overlay border border-border-default rounded-xl w-[420px] z-50 shadow-none transition-all duration-150 scale-100 opacity-100">
        {children}
      </div>
    </>
  );
}
