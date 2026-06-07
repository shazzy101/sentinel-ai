import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Shell from './components/layout/Shell';
import Button from './components/ui/Button';
import WatchlistPage from './pages/Watchlist';
import IntelligencePage from './pages/Intelligence';
import ScoringPage from './pages/Scoring';
import AlertsPage from './pages/Alerts';

function WatchlistRoute() {
  return (
    <Shell
      title="Watchlist"
      actions={<Button variant="primary" onClick={() => window.dispatchEvent(new Event('open-add-wallet'))}>+ Add wallet</Button>}
    >
      <WatchlistPage />
    </Shell>
  );
}

function IntelligenceRoute() {
  return (
    <Shell
      title="Intelligence"
      actions={<Button variant="ghost" onClick={() => window.dispatchEvent(new Event('regenerate-intelligence'))}>↻ Regenerate</Button>}
    >
      <IntelligencePage />
    </Shell>
  );
}

function ScoringRoute() {
  return (
    <Shell title="Scoring">
      <ScoringPage />
    </Shell>
  );
}

function AlertsRoute() {
  return (
    <Shell title="Alerts">
      <AlertsPage />
    </Shell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WatchlistRoute />} />
        <Route path="/intelligence" element={<IntelligenceRoute />} />
        <Route path="/scoring" element={<ScoringRoute />} />
        <Route path="/alerts" element={<AlertsRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
