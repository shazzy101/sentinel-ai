import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Shell({ title, actions, children }) {
  return (
    <div className="flex flex-row h-screen overflow-hidden bg-bg-base">
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
