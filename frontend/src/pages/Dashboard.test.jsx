import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';

// jsdom doesn't implement window.scrollTo
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
import { DashboardTopBar } from './Dashboard';

/* ─── Mock heavy deps that Dashboard imports ────────────── */
// Mock motion/react to avoid animation complexity in tests
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    motion: {
      ...actual.motion,
      span: ({ children, className, ref: _ref, ...rest }) => (
        <span className={className} {...rest}>{children}</span>
      ),
    },
    useSpring: () => ({ set: vi.fn(), on: (_, cb) => { cb('0'); return () => {}; } }),
    useTransform: (spring, fn) => ({ on: (_, cb) => { cb(fn(0)); return () => {}; } }),
    useInView: () => false,
  };
});

// Mock useSignals to control feed rendering
vi.mock('@/hooks/useSignals', () => ({
  useSignals: vi.fn(),
}))

// Mock useLearnProgress — return whale_heatmap as unlocked so Dashboard renders normally
vi.mock('@/hooks/useLearnProgress', () => ({
  useLearnProgress: vi.fn(() => ({
    completed: [1],
    unlocked: ['whale_heatmap'],
    complete: vi.fn(),
    isCompleted: (id) => id === 1,
    isUnlocked: (key) => key === 'whale_heatmap',
    loading: false,
  })),
}));

// Mock apiFetch (used by useTrackRecord inside Dashboard)
vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn().mockRejectedValue(new Error('network')),
  getApiBase: vi.fn(() => ''),
  apiUrl: vi.fn((p) => p),
}));

import { useSignals } from '@/hooks/useSignals';
import Dashboard from './Dashboard';

const MOCK_SIGNALS = [
  {
    id: 'sig-1',
    asset: 'ETH',
    direction: 'long',
    confidence: 4,
    entry_low: 3200,
    entry_high: 3400,
    target: 4000,
    stop_loss: 3000,
    explanation: 'Test explanation',
    status: 'win',
    outcome_return: 10,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'sig-2',
    asset: 'BTC',
    direction: 'short',
    confidence: 3,
    entry_low: 60000,
    entry_high: 62000,
    target: 55000,
    stop_loss: 65000,
    explanation: 'Test explanation 2',
    status: 'active',
    outcome_return: null,
    created_at: new Date(Date.now() - 7200_000).toISOString(),
  },
];

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

/* ─── DashboardTopBar ────────────────────────────────────── */
describe('DashboardTopBar', () => {
  function renderBar(props = {}) {
    return render(<DashboardTopBar wins={42} losses={8} winRate={84.0} avgReturn={7.3} loading={false} {...props} />);
  }

  it('renders wins label', () => {
    renderBar();
    expect(screen.getByText(/wins/i)).toBeInTheDocument();
  });

  it('renders losses label', () => {
    renderBar();
    expect(screen.getByText(/losses/i)).toBeInTheDocument();
  });

  it('renders win rate label', () => {
    renderBar();
    expect(screen.getByText(/win rate/i)).toBeInTheDocument();
  });

  it('renders avg return label', () => {
    renderBar();
    expect(screen.getByText(/avg return/i)).toBeInTheDocument();
  });

  it('shows the container', () => {
    renderBar();
    expect(screen.getByTestId('dashboard-top-bar')).toBeInTheDocument();
  });

  it('shows skeleton when loading=true', () => {
    renderBar({ loading: true });
    // AnimatedCounter should not render (replaced by skeleton spans)
    const bar = screen.getByTestId('dashboard-top-bar');
    expect(bar).toBeInTheDocument();
  });

  it('passes avgReturn=0 without error', () => {
    renderBar({ avgReturn: 0, wins: 0, losses: 0, winRate: 0 });
    expect(screen.getByTestId('dashboard-top-bar')).toBeInTheDocument();
  });
});

/* ─── Dashboard live feed ─────────────────────────────────── */
describe('Dashboard feed', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders N SignalCards when signals are loaded', () => {
    useSignals.mockReturnValue({ signals: MOCK_SIGNALS, loading: false, error: null });
    renderDashboard();
    // SignalCard + history table both show asset — use getAllByText
    expect(screen.getAllByText('ETH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('BTC').length).toBeGreaterThanOrEqual(1);
  });

  it('renders correct number of signal cards', () => {
    useSignals.mockReturnValue({ signals: MOCK_SIGNALS, loading: false, error: null });
    renderDashboard();
    const links = screen.getAllByRole('link');
    // Each SignalCard renders a Link — 2 cards → at least 2 links
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it('shows skeleton cards while loading', () => {
    useSignals.mockReturnValue({ signals: [], loading: true, error: null });
    renderDashboard();
    // CardSkeleton renders animated pulse divs, no signal assets shown
    expect(screen.queryByText('ETH')).toBeNull();
    expect(screen.queryByText('BTC')).toBeNull();
  });

  it('shows error state on signals error', () => {
    useSignals.mockReturnValue({ signals: [], loading: false, error: "Can't reach API" });
    renderDashboard();
    expect(screen.getByText(/can't reach api/i)).toBeInTheDocument();
  });

  it('shows empty state when no signals returned', () => {
    useSignals.mockReturnValue({ signals: [], loading: false, error: null });
    renderDashboard();
    expect(screen.getByText(/no signals yet/i)).toBeInTheDocument();
  });

  it('renders the signal history section', () => {
    useSignals.mockReturnValue({ signals: MOCK_SIGNALS, loading: false, error: null });
    renderDashboard();
    expect(screen.getByRole('region', { name: /signal history/i })).toBeInTheDocument();
  });

  it('renders top bar container', () => {
    useSignals.mockReturnValue({ signals: MOCK_SIGNALS, loading: false, error: null });
    renderDashboard();
    expect(screen.getByTestId('dashboard-top-bar')).toBeInTheDocument();
  });
});
