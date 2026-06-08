import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Shell({ title, actions, children }) {
  return (
    <div className="flex flex-row h-screen overflow-hidden bg-bg-base relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(0,217,146,0.04)_0%,_transparent_50%)]" aria-hidden="true" />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} actions={actions} />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
