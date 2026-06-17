import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SignalTickerDisplay } from './SignalTicker';

const MOCK_SIGNALS = [
  { id: '1', asset: 'ETH',  direction: 'long',  status: 'win' },
  { id: '2', asset: 'BTC',  direction: 'short', status: 'loss' },
  { id: '3', asset: 'SOL',  direction: 'long',  status: 'active' },
  { id: '4', asset: 'LINK', direction: 'neutral', status: 'pending_review' },
  { id: '5', asset: 'UNI',  direction: 'long',  status: 'win' },
];

describe('SignalTickerDisplay', () => {
  it('renders 5 items (×2 for marquee loop) given 5 mock signals', () => {
    render(<SignalTickerDisplay signals={MOCK_SIGNALS} loading={false} />);

    // Each asset appears twice (original + duplicate for seamless scroll)
    const ethItems = screen.getAllByText('ETH');
    expect(ethItems).toHaveLength(2);

    // All 5 distinct assets appear
    expect(screen.getAllByText('BTC')).toHaveLength(2);
    expect(screen.getAllByText('SOL')).toHaveLength(2);
    expect(screen.getAllByText('LINK')).toHaveLength(2);
    expect(screen.getAllByText('UNI')).toHaveLength(2);
  });

  it('applies win (signal) class for a win status badge', () => {
    render(<SignalTickerDisplay signals={MOCK_SIGNALS} loading={false} />);

    // WIN badges exist and carry the signal color token
    const winBadges = screen.getAllByText('WIN');
    expect(winBadges.length).toBeGreaterThan(0);
    winBadges.forEach((badge) => {
      expect(badge).toHaveAttribute('data-status', 'win');
      expect(badge.className).toMatch(/text-signal/);
    });
  });

  it('applies loss class for a loss status badge', () => {
    render(<SignalTickerDisplay signals={MOCK_SIGNALS} loading={false} />);

    const lossBadges = screen.getAllByText('LOSS');
    expect(lossBadges.length).toBeGreaterThan(0);
    lossBadges.forEach((badge) => {
      expect(badge).toHaveAttribute('data-status', 'loss');
      expect(badge.className).toMatch(/text-loss/);
    });
  });

  it('renders skeleton placeholders while loading, no real signal text', () => {
    render(<SignalTickerDisplay signals={[]} loading={true} />);

    // Skeletons present
    const skeletons = screen.getAllByTestId('signal-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);

    // No real asset text rendered
    expect(screen.queryByText('ETH')).toBeNull();
    expect(screen.queryByText('WIN')).toBeNull();
    expect(screen.queryByText('LOSS')).toBeNull();
  });

  it('shows direction arrows for long (↑) and short (↓) signals', () => {
    render(<SignalTickerDisplay signals={MOCK_SIGNALS} loading={false} />);

    // ETH is long → ↑ arrows appear (×2 for doubled marquee)
    const upArrows = screen.getAllByLabelText('long');
    expect(upArrows.length).toBeGreaterThan(0);

    // BTC is short → ↓ arrows appear
    const downArrows = screen.getAllByLabelText('short');
    expect(downArrows.length).toBeGreaterThan(0);
  });
});
