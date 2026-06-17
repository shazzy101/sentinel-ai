import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock network ─────────────────────────────────────────────────────────
vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn().mockRejectedValue(new Error('no network in tests')),
  getApiBase: vi.fn(() => ''),
  apiUrl: vi.fn((p) => p),
}));

// ─── Mock motion/react (used by AnimatedCounter, MagneticButton, SentinelLogo) ──
vi.mock('motion/react', () => {
  const noop = () => {};
  const springLike = {
    set: noop,
    on: (_ev, cb) => { cb('0'); return noop; },
    get: () => 0,
  };
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag) =>
          ({ children, ...rest }) => {
            // strip motion-only props that jsdom doesn't understand
            const {
              whileHover, whileTap, whileFocus, initial, animate,
              transition, variants, exit, style, ...htmlRest
            } = rest;
            return React.createElement(tag, htmlRest, children);
          },
      },
    ),
    AnimatePresence: ({ children }) => children,
    useInView: () => true,
    useSpring: () => springLike,
    useMotionValue: () => springLike,
    useTransform: (_spring, fn) => ({
      on: (_ev, cb) => { cb(fn ? fn(0) : '0'); return noop; },
    }),
  };
});

// ─── Mock lucide icons (not under test) ──────────────────────────────────
vi.mock('lucide-react', () => ({
  Download: () => <svg data-testid="icon-download" />,
  ShieldCheck: () => <svg data-testid="icon-shield" />,
}));

// ─── Import after mocks ───────────────────────────────────────────────────
import { applyFilters, computeStats, TAGLINE } from './TrackRecord';
import TrackRecordPage from './TrackRecord';

// ─── Test fixtures ────────────────────────────────────────────────────────

const SIGNALS = [
  {
    id: 's1',
    signal_number: 1,
    asset: 'ETH',
    direction: 'long',
    confidence: 4,
    entry_low: 3000,
    entry_high: 3400,
    target: 4000,
    stop_loss: 2800,
    status: 'win',
    outcome_return: 18,
    created_at: new Date(Date.now() - 1 * 86_400_000).toISOString(), // 1 day ago
  },
  {
    id: 's2',
    signal_number: 2,
    asset: 'BTC',
    direction: 'short',
    confidence: 2,
    entry_low: 65000,
    entry_high: 67000,
    target: 58000,
    stop_loss: 70000,
    status: 'loss',
    outcome_return: -8,
    created_at: new Date(Date.now() - 10 * 86_400_000).toISOString(), // 10 days ago
  },
  {
    id: 's3',
    signal_number: 3,
    asset: 'ETH',
    direction: 'long',
    confidence: 5,
    entry_low: 3100,
    entry_high: 3300,
    target: 4500,
    stop_loss: 2900,
    status: 'active',
    outcome_return: null,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days ago
  },
  {
    id: 's4',
    signal_number: 4,
    asset: 'SOL',
    direction: 'long',
    confidence: 3,
    entry_low: 80,
    entry_high: 85,
    target: 110,
    stop_loss: 72,
    status: 'win',
    outcome_return: 25,
    created_at: new Date(Date.now() - 35 * 86_400_000).toISOString(), // 35 days ago
  },
];

// ─── applyFilters ─────────────────────────────────────────────────────────

describe('applyFilters', () => {
  it('returns all signals when no filters are active', () => {
    expect(applyFilters(SIGNALS, {})).toHaveLength(SIGNALS.length);
  });

  it('filters by outcome = win', () => {
    const result = applyFilters(SIGNALS, { outcome: 'win' });
    expect(result.every((s) => s.status === 'win')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters by outcome = loss', () => {
    const result = applyFilters(SIGNALS, { outcome: 'loss' });
    expect(result.every((s) => s.status === 'loss')).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('filters by outcome = pending (non-win, non-loss)', () => {
    const result = applyFilters(SIGNALS, { outcome: 'pending' });
    result.forEach((s) => {
      expect(s.status).not.toBe('win');
      expect(s.status).not.toBe('loss');
    });
    expect(result).toHaveLength(1);
  });

  it('filters by outcome = all returns everything', () => {
    expect(applyFilters(SIGNALS, { outcome: 'all' })).toHaveLength(SIGNALS.length);
  });

  it('filters by asset = ETH', () => {
    const result = applyFilters(SIGNALS, { asset: 'ETH' });
    expect(result.every((s) => s.asset === 'ETH')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters by asset = all returns everything', () => {
    expect(applyFilters(SIGNALS, { asset: 'all' })).toHaveLength(SIGNALS.length);
  });

  it('filters by confidence', () => {
    const result = applyFilters(SIGNALS, { confidence: 4 });
    expect(result.every((s) => s.confidence === 4)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('filters by period = 7d (excludes 10-day and 35-day signals)', () => {
    const result = applyFilters(SIGNALS, { period: '7d' });
    // Only s1 (1d) and s3 (2d) are within 7 days
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toContain('s1');
    expect(result.map((s) => s.id)).toContain('s3');
  });

  it('filters by period = 30d (excludes 35-day signal)', () => {
    const result = applyFilters(SIGNALS, { period: '30d' });
    expect(result.map((s) => s.id)).not.toContain('s4');
  });

  it('combines asset and outcome filters', () => {
    const result = applyFilters(SIGNALS, { asset: 'ETH', outcome: 'win' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });
});

// ─── computeStats ─────────────────────────────────────────────────────────

describe('computeStats', () => {
  it('computes win rate correctly', () => {
    const { winRate } = computeStats(SIGNALS);
    // decisive: s1 (win), s2 (loss), s4 (win) = 3 decisive; 2 wins
    expect(winRate).toBeCloseTo((2 / 3) * 100, 1);
  });

  it('returns null winRate when no decisive signals', () => {
    const pending = [{ ...SIGNALS[2], status: 'active' }];
    const { winRate } = computeStats(pending);
    expect(winRate).toBeNull();
  });

  it('identifies the best signal (highest outcome_return)', () => {
    const { bestSignal } = computeStats(SIGNALS);
    // s4 has outcome_return: 25 (highest)
    expect(bestSignal.id).toBe('s4');
    expect(Number(bestSignal.outcome_return)).toBe(25);
  });

  it('identifies the worst signal (lowest outcome_return)', () => {
    const { worstSignal } = computeStats(SIGNALS);
    // s2 has outcome_return: -8 (lowest)
    expect(worstSignal.id).toBe('s2');
    expect(Number(worstSignal.outcome_return)).toBe(-8);
  });

  it('returns null for best/worst when no signals have outcome_return', () => {
    const noReturns = SIGNALS.map((s) => ({ ...s, outcome_return: null }));
    const { bestSignal, worstSignal } = computeStats(noReturns);
    expect(bestSignal).toBeNull();
    expect(worstSignal).toBeNull();
  });

  it('computes per-tier averages correctly', () => {
    const { avgByTier } = computeStats(SIGNALS);
    // tier 2: only s2 → -8; tier 3: only s4 → 25; tier 4: only s1 → 18; tier 5: s3 null → null
    expect(avgByTier[2]).toBeCloseTo(-8, 4);
    expect(avgByTier[3]).toBeCloseTo(25, 4);
    expect(avgByTier[4]).toBeCloseTo(18, 4);
    // s3 has confidence 5 but null outcome_return → tier 5 is null
    expect(avgByTier[5]).toBeNull();
    // tier 1: no signals
    expect(avgByTier[1]).toBeNull();
  });

  it('returns all null tiers for empty signal array', () => {
    const { winRate, bestSignal, worstSignal, avgByTier } = computeStats([]);
    expect(winRate).toBeNull();
    expect(bestSignal).toBeNull();
    expect(worstSignal).toBeNull();
    [1, 2, 3, 4, 5].forEach((t) => expect(avgByTier[t]).toBeNull());
  });
});

// ─── TrackRecord page rendering ───────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <TrackRecordPage />
    </MemoryRouter>,
  );
}

describe('TrackRecord page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the exact required tagline', () => {
    renderPage();
    // Should be present in the DOM (data-testid or as text content)
    const el = screen.getByTestId('tagline');
    expect(el.textContent).toBe(TAGLINE);
  });

  it('TAGLINE constant matches the required string', () => {
    expect(TAGLINE).toBe('Every signal was posted publicly before the move. Blockchain verified.');
  });

  it('renders the export button', () => {
    renderPage();
    const btn = screen.getByTestId('export-csv-button');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toMatch(/export to csv/i);
  });

  it('renders the page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /track record/i })).toBeInTheDocument();
  });

  it('renders SignalFilters', () => {
    renderPage();
    expect(screen.getByTestId('signal-filters')).toBeInTheDocument();
  });

  it('export button is a button element', () => {
    renderPage();
    const btn = screen.getByTestId('export-csv-button');
    expect(btn.tagName.toLowerCase()).toBe('button');
  });
});
