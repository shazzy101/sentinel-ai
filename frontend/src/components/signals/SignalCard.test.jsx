import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import ConfidenceDots from './ConfidenceDots';
import OutcomeBadge from './OutcomeBadge';
import SignalCard from './SignalCard';

/* ─── ConfidenceDots ─────────────────────────────────────── */
describe('ConfidenceDots', () => {
  it('renders 3 filled and 2 hollow dots for score 3', () => {
    render(<ConfidenceDots score={3} />);

    const filledDots = screen.getAllByText('●');
    const hollowDots = screen.getAllByText('○');

    expect(filledDots).toHaveLength(3);
    expect(hollowDots).toHaveLength(2);
  });

  it('filled dots carry text-signal class', () => {
    render(<ConfidenceDots score={2} />);

    const filledDots = screen.getAllByText('●');
    filledDots.forEach((dot) => {
      expect(dot.className).toMatch(/text-signal/);
    });
  });

  it('has correct aria-label', () => {
    render(<ConfidenceDots score={4} />);
    expect(screen.getByRole('img', { name: 'Confidence 4 of 5' })).toBeInTheDocument();
  });

  it('renders 5 filled dots for score 5', () => {
    render(<ConfidenceDots score={5} />);
    expect(screen.getAllByText('●')).toHaveLength(5);
    expect(screen.queryByText('○')).toBeNull();
  });

  it('renders 1 filled dot for score 1', () => {
    render(<ConfidenceDots score={1} />);
    expect(screen.getAllByText('●')).toHaveLength(1);
    expect(screen.getAllByText('○')).toHaveLength(4);
  });
});

/* ─── OutcomeBadge ───────────────────────────────────────── */
describe('OutcomeBadge', () => {
  it('win badge has signal glow class and shows "Win"', () => {
    render(<OutcomeBadge status="win" />);
    const badge = screen.getByText('Win');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/text-signal/);
    expect(badge.className).toMatch(/shadow-glow-signal/);
  });

  it('loss badge has loss class and shows "Loss"', () => {
    render(<OutcomeBadge status="loss" />);
    const badge = screen.getByText('Loss');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/text-loss/);
    expect(badge.className).toMatch(/shadow-glow-loss/);
  });

  it('pending_review shows "Pending" with muted class', () => {
    render(<OutcomeBadge status="pending_review" />);
    const badge = screen.getByText('Pending');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/text-text-muted/);
  });

  it('pending shows "Pending"', () => {
    render(<OutcomeBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('active shows "Active"', () => {
    render(<OutcomeBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('unknown status falls back to Pending', () => {
    render(<OutcomeBadge status="unknown_status" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

/* ─── SignalCard ─────────────────────────────────────────── */
const WIN_SIGNAL = {
  id: 'sig-001',
  asset: 'ETH',
  direction: 'long',
  confidence: 4,
  entry_low: 3200,
  entry_high: 3400,
  target: 4000,
  stop_loss: 3000,
  explanation:
    'ETH broke above key resistance. Momentum indicators confirm bullish continuation toward the 4k level.',
  status: 'win',
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
};

const LOSS_SIGNAL = {
  id: 'sig-002',
  asset: 'BTC',
  direction: 'short',
  confidence: 3,
  entry_low: 65000,
  entry_high: 67000,
  target: 58000,
  stop_loss: 70000,
  explanation: 'BTC rejected at all-time high with bearish divergence. Short-term pullback expected.',
  status: 'loss',
  created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5d ago
};

const PENDING_SIGNAL = {
  id: 'sig-003',
  asset: 'SOL',
  direction: 'long',
  confidence: 2,
  entry_low: null,
  entry_high: null,
  target: null,
  stop_loss: null,
  explanation: null,
  status: 'pending_review',
  created_at: null,
};

function renderCard(signal) {
  return render(
    <MemoryRouter>
      <SignalCard signal={signal} />
    </MemoryRouter>,
  );
}

describe('SignalCard', () => {
  it('renders asset name', () => {
    renderCard(WIN_SIGNAL);
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('renders direction label "Long" for long direction', () => {
    renderCard(WIN_SIGNAL);
    expect(screen.getByText('Long')).toBeInTheDocument();
  });

  it('renders direction label "Short" for short direction', () => {
    renderCard(LOSS_SIGNAL);
    expect(screen.getByText('Short')).toBeInTheDocument();
  });

  it('renders entry values in font-mono', () => {
    renderCard(WIN_SIGNAL);
    // Entry low and high values should be present
    expect(screen.getByText('3200')).toBeInTheDocument();
    expect(screen.getByText('3400')).toBeInTheDocument();
  });

  it('renders target value', () => {
    renderCard(WIN_SIGNAL);
    expect(screen.getByText('4000')).toBeInTheDocument();
  });

  it('renders stop_loss value', () => {
    renderCard(WIN_SIGNAL);
    expect(screen.getByText('3000')).toBeInTheDocument();
  });

  it('renders the explanation text', () => {
    renderCard(WIN_SIGNAL);
    expect(
      screen.getByText(/ETH broke above key resistance/),
    ).toBeInTheDocument();
  });

  it('win signal card has shadow-glow-signal class on link', () => {
    renderCard(WIN_SIGNAL);
    const link = screen.getByRole('link');
    expect(link.className).toMatch(/shadow-glow-signal/);
  });

  it('loss signal card has shadow-glow-loss class on link', () => {
    renderCard(LOSS_SIGNAL);
    const link = screen.getByRole('link');
    expect(link.className).toMatch(/shadow-glow-loss/);
  });

  it('links to the correct /signal/:id path', () => {
    renderCard(WIN_SIGNAL);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/signal/sig-001');
  });

  it('handles null fields gracefully by showing "—"', () => {
    renderCard(PENDING_SIGNAL);
    // Multiple "—" markers for null entry/target/stop/timestamp
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows "Pending" badge for pending_review status', () => {
    renderCard(PENDING_SIGNAL);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('neutral/pending card does not have win or loss glow', () => {
    renderCard(PENDING_SIGNAL);
    const link = screen.getByRole('link');
    expect(link.className).not.toMatch(/shadow-glow-signal/);
    expect(link.className).not.toMatch(/shadow-glow-loss/);
  });

  it('renders ConfidenceDots with correct score', () => {
    renderCard(WIN_SIGNAL);
    // WIN_SIGNAL has confidence 4 → 4 filled, 1 hollow
    expect(screen.getAllByText('●')).toHaveLength(4);
    expect(screen.getAllByText('○')).toHaveLength(1);
  });
});
