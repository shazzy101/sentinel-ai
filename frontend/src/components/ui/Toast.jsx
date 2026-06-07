import { useEffect, useState } from 'react';

const TYPE_CLASS = {
  success: 'border-green-border bg-bg-overlay text-text-primary',
  error: 'border-red-border bg-bg-overlay text-text-primary',
  info: 'border-border-default bg-bg-overlay text-text-primary',
};

function Icon({ type }) {
  if (type === 'success') return <span className="text-green">✓</span>;
  if (type === 'error') return <span className="text-red">✕</span>;
  return <span className="text-text-secondary">i</span>;
}

export default function Toast({ message, type = 'info', onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const inTimer = setTimeout(() => setVisible(true), 10);
    const outTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss?.(), 150);
    }, 3000);
    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className={`pointer-events-auto border rounded-lg px-3 py-2 text-[12px] flex items-center gap-2 min-w-[260px] transition-all duration-150 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${TYPE_CLASS[type] || TYPE_CLASS.info}`.trim()}
      role="status"
    >
      <Icon type={type} />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => onDismiss?.()}
        className="text-text-muted hover:text-text-primary"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastStack({ items, onDismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}
