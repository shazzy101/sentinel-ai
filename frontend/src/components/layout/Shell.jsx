import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AppBackground from '../primitives/AppBackground';
import CommandPalette from '../primitives/CommandPalette';
import TrialBanner from '../auth/TrialBanner';
import OnboardingModal from '../onboarding/OnboardingModal';

export default function Shell({ title, actions, children }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-base relative">
      <AppBackground variant="app" />
      <TrialBanner />
      <div className="flex flex-row flex-1 overflow-hidden min-h-0">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar onOpenCommand={() => setPaletteOpen(true)} />
        </div>

        {/* Mobile sidebar drawer */}
        {mobileSidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 md:hidden">
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
