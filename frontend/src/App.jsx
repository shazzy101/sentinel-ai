import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { lazy, Suspense } from 'react';
import Shell from './components/layout/Shell';
import Button from './components/ui/Button';
import MotionPage from './components/primitives/MotionPage';
import AuthGuard from './components/auth/AuthGuard';
import { SkeletonBlock } from './components/primitives/DataState';

// Eagerly loaded (critical path)
import LandingPage from './pages/Landing';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';

// Lazily loaded (code split per route)
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPassword'));
const UpgradePage = lazy(() => import('./pages/Upgrade'));
const AboutPage = lazy(() => import('./pages/About'));
const PrivacyPage = lazy(() => import('./pages/Privacy'));
const TermsPage = lazy(() => import('./pages/Terms'));
const DisclaimerPage = lazy(() => import('./pages/Disclaimer'));
const SignalsLeaderboardPage = lazy(() => import('./pages/SignalsLeaderboard'));
const WatchlistPage = lazy(() => import('./pages/Watchlist'));
const IntelligencePage = lazy(() => import('./pages/Intelligence'));
const AlertsPage = lazy(() => import('./pages/Alerts'));
const InvestPage = lazy(() => import('./pages/Invest'));
const AskSentinelPage = lazy(() => import('./pages/AskSentinel'));
const NewsPage = lazy(() => import('./pages/News'));

// Markets is eagerly loaded because EthPriceBadge is used as a Shell prop
import MarketsPage, { EthPriceBadge } from './pages/Markets';

function PageLoader() {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <SkeletonBlock rows={6} className="max-w-3xl mx-auto py-8" />
    </div>
  );
}

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
    <Shell title="Ask Hadaleum">
      <AskSentinelPage />
    </Shell>
  );
}

function NewsRoute() {
  return (
    <Shell title="News Intelligence">
      <NewsPage />
    </Shell>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/" element={<MotionPage><LandingPage /></MotionPage>} />
        <Route path="/login" element={<MotionPage><LoginPage /></MotionPage>} />
        <Route path="/signup" element={<MotionPage><SignupPage /></MotionPage>} />
        <Route path="/forgot-password" element={<MotionPage><Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense></MotionPage>} />
        <Route path="/upgrade" element={<MotionPage><Suspense fallback={<PageLoader />}><UpgradePage /></Suspense></MotionPage>} />
        <Route path="/about" element={<MotionPage><Suspense fallback={<PageLoader />}><AboutPage /></Suspense></MotionPage>} />
        <Route path="/privacy" element={<MotionPage><Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense></MotionPage>} />
        <Route path="/terms" element={<MotionPage><Suspense fallback={<PageLoader />}><TermsPage /></Suspense></MotionPage>} />
        <Route path="/disclaimer" element={<MotionPage><Suspense fallback={<PageLoader />}><DisclaimerPage /></Suspense></MotionPage>} />
        <Route path="/signals" element={<MotionPage><Suspense fallback={<PageLoader />}><SignalsLeaderboardPage /></Suspense></MotionPage>} />

        {/* Protected app routes */}
        <Route path="/watchlist" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><WatchlistRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/intelligence" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><IntelligenceRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/markets" element={<MotionPage><AuthGuard><MarketsRoute /></AuthGuard></MotionPage>} />
        <Route path="/invest" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><InvestRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/ask" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><AskSentinelRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/news" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><NewsRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/alerts" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><AlertsRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/scoring" element={<Navigate to="/watchlist" replace />} />
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
