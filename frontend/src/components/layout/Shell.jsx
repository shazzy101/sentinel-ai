import { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AppBackground from '../primitives/AppBackground';
import CommandPalette from '../primitives/CommandPalette';
import TrialBanner from '../auth/TrialBanner';
import OnboardingModal from '../onboarding/OnboardingModal';

export default function Shell({ title, actions, children }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const drawerRef = useRef(null);

  // Mobile drawer: close on Escape, and move focus into the drawer when it opens
  // (basic focus trap — keeps keyboard focus within the dialog while open).
  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { setMobileSidebarOpen(false); return; }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    drawerRef.current?.querySelector('a[href], button:not([disabled])')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileSidebarOpen]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-bg-base relative">
      <AppBackground variant="app" />
      <TrialBanner />
      <div className="flex flex-row flex-1 overflow-hidden min-h-0">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:flex">
          <Sidebar onOpenCommand={() => setPaletteOpen(true)} />
        </div>

        {/* Mobile sidebar drawer */}
        {mobileSidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div
              id="mobile-sidebar"
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="fixed inset-y-0 left-0 z-50 flex md:hidden"
            >
              <Sidebar
                onOpenCommand={() => { setPaletteOpen(true); setMobileSidebarOpen(false); }}
                onClose={() => setMobileSidebarOpen(false)}
              />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Topbar
            title={title}
            actions={actions}
            onOpenCommand={() => setPaletteOpen(true)}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            mobileSidebarOpen={mobileSidebarOpen}
          />
          <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <OnboardingModal />
    </div>
  );
}
