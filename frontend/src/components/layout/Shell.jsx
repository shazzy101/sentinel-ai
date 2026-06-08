import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AppBackground from '../primitives/AppBackground';
import CommandPalette from '../primitives/CommandPalette';

export default function Shell({ title, actions, children }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="flex flex-row h-screen overflow-hidden bg-bg-base relative">
      <AppBackground variant="app" />
      <Sidebar onOpenCommand={() => setPaletteOpen(true)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          title={title}
          actions={actions}
          onOpenCommand={() => setPaletteOpen(true)}
        />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
