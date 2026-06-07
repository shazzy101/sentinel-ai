import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Shell from './components/layout/Shell';
import Button from './components/ui/Button';
import WatchlistPage from './pages/Watchlist';
import IntelligencePage from './pages/Intelligence';
import ScoringPage from './pages/Scoring';
import AlertsPage from './pages/Alerts';
import LandingPage from './pages/Landing';

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
      actions={
        <Button variant="ghost" className="flex items-center gap-1.5" onClick={() => window.dispatchEvent(new Event('regenerate-intelligence'))}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="stroke-current">
            <path d="M10.8 4A4.5 4.5 0 1 0 11.5 6.5" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M11.5 1.5v3h-3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Regenerate
        </Button>
      }
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
        <Route path="/landing" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
