import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { bucketMoves, WhaleHeatmapGrid } from './WhaleHeatmap';
import WhaleHeatmap from './WhaleHeatmap';

/* ─── Mock apiFetch so the container doesn't hit the network ─ */
vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn().mockRejectedValue(new Error('network')),
  getApiBase: vi.fn(() => ''),
  apiUrl: vi.fn((p) => p),
}));

/* ─── helpers ─────────────────────────────────────────────── */

/** Build an ISO timestamp string at a given UTC hour today */
function atHour(h) {
  const d = new Date();
  d.setUTCHours(h, 0, 0, 0);
  return d.toISOString();
}

/* ─── bucketMoves ─────────────────────────────────────────── */
describe('bucketMoves', () => {
  it('returns empty structure for empty input', () => {
    expect(bucketMoves([])).toEqual({ assets: [], cells: {}, max: 0 });
    expect(bucketMoves(null)).toEqual({ assets: [], cells: {}, max: 0 });
    expect(bucketMoves(undefined)).toEqual({ assets: [], cells: {}, max: 0 });
  });

  it('groups two moves for the same asset + hour', () => {
    const moves = [
      { asset: 'ETH', timestamp: atHour(5), amount_usd: 1_000_000 },
      { asset: 'ETH', timestamp: atHour(5), amount_usd: 500_000 },
    ];
    const { assets, cells, max } = bucketMoves(moves);
    expect(assets).toEqual(['ETH']);
    expect(cells['ETH'][5]).toBe(1_500_000);
    expect(max).toBe(1_500_000);
  });

  it('separates different hours into different cells', () => {
    const moves = [
      { asset: 'BTC', timestamp: atHour(10), amount_usd: 2_000_000 },
      { asset: 'BTC', timestamp: atHour(15), amount_usd: 3_000_000 },
    ];
    const { cells, max } = bucketMoves(moves);
    expect(cells['BTC'][10]).toBe(2_000_000);
    expect(cells['BTC'][15]).toBe(3_000_000);
    expect(max).toBe(3_000_000);
  });

  it('separates different assets into different rows', () => {
    const moves = [
      { asset: 'ETH', timestamp: atHour(7), amount_usd: 1_000_000 },
      { asset: 'SOL', timestamp: atHour(7), amount_usd: 800_000 },
    ];
    const { assets, cells, max } = bucketMoves(moves);
    expect(assets).toContain('ETH');
    expect(assets).toContain('SOL');
    expect(assets).toHaveLength(2);
    expect(cells['ETH'][7]).toBe(1_000_000);
    expect(cells['SOL'][7]).toBe(800_000);
    expect(max).toBe(1_000_000);
  });

  it('returns assets sorted alphabetically', () => {
    const moves = [
      { asset: 'SOL', timestamp: atHour(1), amount_usd: 1_000 },
      { asset: 'BTC', timestamp: atHour(1), amount_usd: 1_000 },
      { asset: 'ETH', timestamp: atHour(1), amount_usd: 1_000 },
    ];
    const { assets } = bucketMoves(moves);
    expect(assets).toEqual(['BTC', 'ETH', 'SOL']);
  });

  it('falls back to move.bought when move.asset is absent', () => {
    const moves = [{ bought: 'LINK', time: atHour(3), amount_usd: 500_000 }];
    const { assets } = bucketMoves(moves);
    expect(assets).toEqual(['LINK']);
  });

  it('uses move.usdValue field when present', () => {
    const moves = [{ asset: 'AVAX', timestamp: atHour(12), usdValue: 750_000 }];
    const { cells } = bucketMoves(moves);
    expect(cells['AVAX'][12]).toBe(750_000);
  });

  it('uses move.hour field when timestamp is absent', () => {
    const moves = [{ asset: 'MATIC', hour: 20, usdValue: 200_000 }];
    const { cells } = bucketMoves(moves);
    expect(cells['MATIC'][20]).toBe(200_000);
  });

  it('skips moves with zero or negative usdValue', () => {
    const moves = [
      { asset: 'ETH', timestamp: atHour(6), amount_usd: 0 },
      { asset: 'ETH', timestamp: atHour(6), amount_usd: -100 },
    ];
    const { assets, max } = bucketMoves(moves);
    expect(assets).toHaveLength(0);
    expect(max).toBe(0);
  });

  it('skips moves with out-of-range hour', () => {
    // no timestamp + no hour field → skip
    const moves = [{ asset: 'ETH', amount_usd: 1_000_000 }];
    const { assets } = bucketMoves(moves);
    expect(assets).toHaveLength(0);
  });

  it('computes correct max across many cells', () => {
    const moves = [
      { asset: 'ETH', timestamp: atHour(0), amount_usd: 100_000 },
      { asset: 'ETH', timestamp: atHour(1), amount_usd: 999_000 },
      { asset: 'BTC', timestamp: atHour(0), amount_usd: 500_000 },
    ];
    const { max } = bucketMoves(moves);
    expect(max).toBe(999_000);
  });
});

/* ─── WhaleHeatmapGrid ────────────────────────────────────── */
describe('WhaleHeatmapGrid', () => {
  it('renders one cell per asset × 24 hours', () => {
    const assets = ['ETH', 'BTC'];
    const cells = { ETH: { 5: 1_000_000 }, BTC: { 10: 2_000_000 } };
    const max = 2_000_000;
    render(<WhaleHeatmapGrid assets={assets} cells={cells} max={max} />);
    // Each asset has 24 hour cells
    const ethCells = screen.getAllByTestId(/^cell-ETH-/);
    const btcCells = screen.getAllByTestId(/^cell-BTC-/);
    expect(ethCells).toHaveLength(24);
    expect(btcCells).toHaveLength(24);
  });

  it('renders all 24 hour header labels (00–23)', () => {
    const assets = ['ETH'];
    const cells = { ETH: { 0: 1_000 } };
    render(<WhaleHeatmapGrid assets={assets} cells={cells} max={1_000} />);
    // hour labels: '00' through '23'
    expect(screen.getByText('00')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('renders row headers for each asset', () => {
    const assets = ['ETH', 'SOL'];
    const cells = { ETH: { 3: 500_000 }, SOL: { 3: 300_000 } };
    render(<WhaleHeatmapGrid assets={assets} cells={cells} max={500_000} />);
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('SOL')).toBeInTheDocument();
  });

  it('returns null when assets array is empty', () => {
    const { container } = render(
      <WhaleHeatmapGrid assets={[]} cells={{}} max={0} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

/* ─── WhaleHeatmap container ──────────────────────────────── */
describe('WhaleHeatmap', () => {
  it('shows skeleton while loading', () => {
    render(<WhaleHeatmap moves={[]} loading={true} />);
    expect(screen.getByTestId('whale-heatmap-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no moves and not loading', () => {
    render(<WhaleHeatmap moves={[]} loading={false} />);
    expect(screen.getByTestId('whale-heatmap-empty')).toBeInTheDocument();
  });

  it('renders the heatmap grid when moves are provided', () => {
    const moves = [
      { asset: 'ETH', timestamp: atHour(10), amount_usd: 2_000_000 },
      { asset: 'BTC', timestamp: atHour(14), amount_usd: 5_000_000 },
    ];
    render(<WhaleHeatmap moves={moves} loading={false} />);
    // Grid cells for ETH and BTC should be present
    expect(screen.getAllByTestId(/^cell-ETH-/)).toHaveLength(24);
    expect(screen.getAllByTestId(/^cell-BTC-/)).toHaveLength(24);
  });

  it('renders the outer container', () => {
    render(<WhaleHeatmap moves={[]} loading={false} />);
    expect(screen.getByTestId('whale-heatmap')).toBeInTheDocument();
  });

  it('shows the Whale Activity heading', () => {
    render(<WhaleHeatmap moves={[]} loading={false} />);
    expect(screen.getByText('Whale Activity')).toBeInTheDocument();
  });
});
