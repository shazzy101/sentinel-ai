import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import Shell from './components/layout/Shell';
import Button from './components/ui/Button';
import MotionPage from './components/primitives/MotionPage';
import LandingPage from './pages/Landing';
import WatchlistPage from './pages/Watchlist';
import IntelligencePage from './pages/Intelligence';
import MarketsPage, { EthPriceBadge } from './pages/Markets';
import AlertsPage from './pages/Alerts';
import InvestPage from './pages/Invest';
import AskSentinelPage from './pages/AskSentinel';

function WatchlistRoute() {
  return (
    <Shell
      title="Watchlist"
      actions={
        <Button variant="primary" magnetic onClick={() => window.dispatchEvent(new Event('open-add-wallet'))}>
          + Add wallet
        </Button>
      }
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
          Regenerate
        </Button>
      }
    >
      <IntelligencePage />
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

function MarketsRoute() {
  return (
    <Shell title="Markets" actions={<EthPriceBadge />}>
      <MarketsPage />
    </Shell>
  );
}

function InvestRoute() {
  return (
    <Shell title="Invest">
      <InvestPage />
    </Shell>
  );
}

function AskSentinelRoute() {
  return (
    <Shell title="Ask Sentinel">
      <AskSentinelPage />
    </Shell>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <MotionPage>
              <LandingPage />
            </MotionPage>
          }
        />
        <Route path="/watchlist" element={<MotionPage><WatchlistRoute /></MotionPage>} />
        <Route path="/intelligence" element={<MotionPage><IntelligenceRoute /></MotionPage>} />
        <Route path="/markets" element={<MotionPage><MarketsRoute /></MotionPage>} />
        <Route path="/invest" element={<MotionPage><InvestRoute /></MotionPage>} />
        <Route path="/ask" element={<MotionPage><AskSentinelRoute /></MotionPage>} />
        <Route path="/scoring" element={<Navigate to="/watchlist" replace />} />
        <Route path="/alerts" element={<MotionPage><AlertsRoute /></MotionPage>} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
