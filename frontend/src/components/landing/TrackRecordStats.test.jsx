import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock AnimatedCounter so we don't need IntersectionObserver in jsdom.
// The counter animates via motion springs; the unit test only cares about
// structure (3 stats render, skeletons show, values are present).
vi.mock('../primitives/AnimatedCounter', () => ({
  default: ({ value, suffix, decimals }) => (
    <span data-testid="animated-counter">
      {Number(value).toFixed(decimals ?? 0)}
      {suffix}
    </span>
  ),
}));

import { TrackRecordStatsDisplay } from './TrackRecordStats';

const DEFAULT_PROPS = {
  totalSignals: 142,
  winRate: 68.4,
  avgReturn: 12.7,
  loading: false,
};

describe('TrackRecordStatsDisplay', () => {
  it('renders all three stat containers', () => {
    render(<TrackRecordStatsDisplay {...DEFAULT_PROPS} />);

    expect(screen.getByTestId('stat-total-signals')).toBeInTheDocument();
    expect(screen.getByTestId('stat-win-rate')).toBeInTheDocument();
    expect(screen.getByTestId('stat-avg-return')).toBeInTheDocument();
  });

  it('renders the total signals value via AnimatedCounter', () => {
    render(<TrackRecordStatsDisplay {...DEFAULT_PROPS} />);

    const container = screen.getByTestId('stat-value-total-signals');
    expect(container).toBeInTheDocument();
    // Our mock renders the raw value
    expect(container.textContent).toContain('142');
    expect(screen.getByText('Total Signals')).toBeInTheDocument();
  });

  it('renders the win rate with a percentage suffix', () => {
    render(<TrackRecordStatsDisplay {...DEFAULT_PROPS} />);

    expect(screen.getByText('Win Rate')).toBeInTheDocument();

    const container = screen.getByTestId('stat-value-win-rate');
    expect(container).toBeInTheDocument();
    // The AnimatedCounter mock renders value + suffix → "68.4%"
    expect(container.textContent).toContain('%');
    expect(container.textContent).toContain('68.4');
  });

  it('renders average return stat', () => {
    render(<TrackRecordStatsDisplay {...DEFAULT_PROPS} />);

    expect(screen.getByText('Avg Win Return')).toBeInTheDocument();
    const container = screen.getByTestId('stat-value-avg-return');
    expect(container).toBeInTheDocument();
    expect(container.textContent).toContain('12.7');
    expect(container.textContent).toContain('%');
  });

  it('shows skeleton placeholders while loading', () => {
    render(
      <TrackRecordStatsDisplay
        totalSignals={null}
        winRate={null}
        avgReturn={null}
        loading={true}
      />,
    );

    const skeletons = screen.getAllByTestId('stat-skeleton');
    // Each of the 3 stats renders multiple skeleton divs
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('does NOT show stat value wrappers while loading', () => {
    render(
      <TrackRecordStatsDisplay
        totalSignals={null}
        winRate={null}
        avgReturn={null}
        loading={true}
      />,
    );

    expect(screen.queryByTestId('stat-value-total-signals')).toBeNull();
    expect(screen.queryByTestId('stat-value-win-rate')).toBeNull();
    expect(screen.queryByTestId('stat-value-avg-return')).toBeNull();
  });

  it('does NOT show skeletons when not loading', () => {
    render(<TrackRecordStatsDisplay {...DEFAULT_PROPS} />);

    expect(screen.queryByTestId('stat-skeleton')).toBeNull();
  });

  it('renders descriptive sublabels when not loading', () => {
    render(<TrackRecordStatsDisplay {...DEFAULT_PROPS} />);

    expect(screen.getByText('all-time detections')).toBeInTheDocument();
    expect(screen.getByText('on scored moves')).toBeInTheDocument();
    expect(screen.getByText('per winning trade')).toBeInTheDocument();
  });
});
