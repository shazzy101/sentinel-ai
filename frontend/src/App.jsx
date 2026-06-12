import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { lazy, Suspense } from 'react';
import Shell from './components/layout/Shell';
import Button from './components/ui/Button';
import MotionPage from './components/primitives/MotionPage';
import AuthGuard from './components/auth/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonBlock } from './components/primitives/DataState';

// Eagerly loaded (critical path)
import LandingPage from './pages/Landing';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';

// Lazily loaded (code split per route)
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPassword'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallback'));
const UpgradePage = lazy(() => import('./pages/Upgrade'));
const AboutPage = lazy(() => import('./pages/About'));
const PrivacyPage = lazy(() => import('./pages/Privacy'));
const TermsPage = lazy(() => import('./pages/Terms'));
const DisclaimerPage = lazy(() => import('./pages/Disclaimer'));
const SignalsLeaderboardPage = lazy(() => import('./pages/SignalsLeaderboard'));
const InstitutionalPage = lazy(() => import('./pages/Institutional'));
const SignalPerformancePage = lazy(() => import('./pages/SignalPerformance'));
const DetectedWinsPage = lazy(() => import('./pages/DetectedWins'));
const WatchlistPage = lazy(() => import('./pages/Watchlist'));
const IntelligencePage = lazy(() => import('./pages/Intelligence'));
const AlertsPage = lazy(() => import('./pages/Alerts'));
const InvestPage = lazy(() => import('./pages/Invest'));
const AskSentinelPage = lazy(() => import('./pages/AskSentinel'));
const NewsPage = lazy(() => import('./pages/News'));
const SettingsPage = lazy(() => import('./pages/Settings'));

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
      title="AI Signals"
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
    <Shell title="Copy" actions={<EthPriceBadge />}>
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
    <Shell title="Screener">
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

function SettingsRoute() {
  return (
    <Shell title="Settings">
      <SettingsPage />
    </Shell>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      {/* Keyed by path so a crash in one route shows the fallback and recovers
          automatically when the user navigates elsewhere. */}
      <ErrorBoundary key={location.pathname}>
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/" element={<MotionPage><LandingPage /></MotionPage>} />
        <Route path="/login" element={<MotionPage><LoginPage /></MotionPage>} />
        <Route path="/signup" element={<MotionPage><SignupPage /></MotionPage>} />
        <Route path="/auth/callback" element={<MotionPage><Suspense fallback={<PageLoader />}><AuthCallbackPage /></Suspense></MotionPage>} />
        <Route path="/forgot-password" element={<MotionPage><Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense></MotionPage>} />
        <Route path="/reset-password" element={<MotionPage><Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense></MotionPage>} />
        <Route path="/upgrade" element={<MotionPage><Suspense fallback={<PageLoader />}><UpgradePage /></Suspense></MotionPage>} />
        <Route path="/about" element={<MotionPage><Suspense fallback={<PageLoader />}><AboutPage /></Suspense></MotionPage>} />
        <Route path="/privacy" element={<MotionPage><Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense></MotionPage>} />
        <Route path="/terms" element={<MotionPage><Suspense fallback={<PageLoader />}><TermsPage /></Suspense></MotionPage>} />
        <Route path="/disclaimer" element={<MotionPage><Suspense fallback={<PageLoader />}><DisclaimerPage /></Suspense></MotionPage>} />
        <Route path="/signals" element={<MotionPage><Suspense fallback={<PageLoader />}><SignalsLeaderboardPage /></Suspense></MotionPage>} />
        <Route path="/signals/performance" element={<MotionPage><Suspense fallback={<PageLoader />}><SignalPerformancePage /></Suspense></MotionPage>} />
        <Route path="/wins" element={<MotionPage><Suspense fallback={<PageLoader />}><DetectedWinsPage /></Suspense></MotionPage>} />
        <Route path="/institutional" element={<MotionPage><Suspense fallback={<PageLoader />}><InstitutionalPage /></Suspense></MotionPage>} />

        {/* Protected app routes */}
        <Route path="/watchlist" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><WatchlistRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/intelligence" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><IntelligenceRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/markets" element={<MotionPage><AuthGuard><MarketsRoute /></AuthGuard></MotionPage>} />
        <Route path="/copy" element={<Navigate to="/markets" replace />} />
        <Route path="/invest" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><InvestRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/ask" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><AskSentinelRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/news" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><NewsRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/alerts" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><AlertsRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/settings" element={<MotionPage><AuthGuard><Suspense fallback={<PageLoader />}><SettingsRoute /></Suspense></AuthGuard></MotionPage>} />
        <Route path="/scoring" element={<Navigate to="/watchlist" replace />} />
        <Route path="/enterprise" element={<Navigate to="/institutional" replace />} />
        {/* Catch-all: unknown URLs rendered a blank root div. Send them home. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
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
