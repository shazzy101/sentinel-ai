import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock heavy deps ─────────────────────────────────────────────

// Mock useSignal (our hook)
vi.mock('@/hooks/useSignal', () => ({
  useSignal: vi.fn(),
}));

// Mock apiFetch so the price-chart effect doesn't trigger real network
vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn().mockRejectedValue(new Error('network')),
  getApiBase: vi.fn(() => ''),
  apiUrl: vi.fn((p) => p),
}));

// Mock recharts — render nothing so jsdom doesn't warn about SVG tags
vi.mock('recharts', () => ({
  AreaChart: () => null,
  Area: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  ResponsiveContainer: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Share2: () => null,
  ExternalLink: () => null,
}));

import { useSignal } from '@/hooks/useSignal';
import SignalDetail from './SignalDetail';

// ─── Test fixtures ───────────────────────────────────────────────

const MOCK_SIGNAL = {
  id: 'sig-abc',
  signal_number: 7,
  asset: 'ETH',
  direction: 'long',
  confidence: 4,
  entry_low: 3000,
  entry_high: 3400,
  target: 4200,
  stop_loss: 2800,
  explanation: 'Whale accumulation across multiple wallets observed.',
  pattern_type: 'Accumulation',
  whale_wallets: [
    '0xDeAdBeEf0000000000000000000000000000cafe',
    '0xAbCdEf1234567890abcdef1234567890abcdef12',
  ],
  tx_hashes: [
    '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  ],
  status: 'active',
  outcome_return: null,
  created_at: '2026-06-16T10:00:00.000Z',
};

// ─── Helpers ─────────────────────────────────────────────────────

async function renderSignalDetail(id = 'abc') {
  let result;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={[`/signal/${id}`]}>
        <Routes>
          <Route path="/signal/:id" element={<SignalDetail />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return result;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('SignalDetail — loaded signal', () => {
  beforeEach(() => {
    useSignal.mockReturnValue({ signal: MOCK_SIGNAL, loading: false, error: null });
  });
  afterEach(() => vi.clearAllMocks());

  it('renders the asset name', async () => {
    await renderSignalDetail();
    expect(screen.getAllByText(/ETH/i).length).toBeGreaterThan(0);
  });

  it('renders Long direction', async () => {
    await renderSignalDetail();
    expect(screen.getByText('Long')).toBeInTheDocument();
  });

  it('renders whale wallet etherscan links with correct hrefs', async () => {
    await renderSignalDetail();
    const walletLinks = screen.getAllByRole('link').filter((a) =>
      a.href.includes('etherscan.io/address/'),
    );
    expect(walletLinks.length).toBe(2);
    expect(walletLinks[0].href).toContain(
      'etherscan.io/address/0xDeAdBeEf0000000000000000000000000000cafe',
    );
    expect(walletLinks[1].href).toContain(
      'etherscan.io/address/0xAbCdEf1234567890abcdef1234567890abcdef12',
    );
  });

  it('renders tx hash etherscan links with correct hrefs', async () => {
    await renderSignalDetail();
    const txLinks = screen.getAllByRole('link').filter((a) =>
      a.href.includes('etherscan.io/tx/'),
    );
    expect(txLinks.length).toBe(1);
    expect(txLinks[0].href).toContain(
      'etherscan.io/tx/0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    );
  });

  it('etherscan links open in new tab with noopener', async () => {
    await renderSignalDetail();
    const etherscanLinks = screen.getAllByRole('link').filter((a) =>
      a.href.includes('etherscan.io'),
    );
    etherscanLinks.forEach((link) => {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.rel).toContain('noreferrer');
    });
  });

  it('renders the signal number', async () => {
    await renderSignalDetail();
    expect(screen.getByText(/Signal #7/i)).toBeInTheDocument();
  });

  it('renders the explanation', async () => {
    await renderSignalDetail();
    expect(
      screen.getByText(/Whale accumulation across multiple wallets observed/i),
    ).toBeInTheDocument();
  });

  it('share button produces tweet text containing the asset', async () => {
    // Mock clipboard + window.open
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await renderSignalDetail();
    const shareBtn = screen.getByTestId('share-button');
    fireEvent.click(shareBtn);

    expect(openSpy).toHaveBeenCalled();
    const [url] = openSpy.mock.calls[0];
    const decoded = decodeURIComponent(url.replace('https://twitter.com/intent/tweet?text=', ''));
    expect(decoded).toContain('ETH');
    expect(decoded).toContain('HADALEUM SIGNAL #7');

    openSpy.mockRestore();
  });
});

describe('SignalDetail — not-found state', () => {
  beforeEach(() => {
    useSignal.mockReturnValue({ signal: null, loading: false, error: null });
  });
  afterEach(() => vi.clearAllMocks());

  it('renders not-found state when signal is null and not loading', async () => {
    await renderSignalDetail('missing-id');
    expect(screen.getByText(/signal not found/i)).toBeInTheDocument();
  });

  it('shows a link back to /signals', async () => {
    await renderSignalDetail('missing-id');
    const link = screen.getByRole('link', { name: /browse all signals/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/signals');
  });
});

describe('SignalDetail — loading state', () => {
  beforeEach(() => {
    useSignal.mockReturnValue({ signal: null, loading: true, error: null });
  });
  afterEach(() => vi.clearAllMocks());

  it('shows skeleton while loading', async () => {
    await renderSignalDetail();
    // Skeleton renders animated pulse divs — no asset text, no "Signal not found"
    expect(screen.queryByText(/signal not found/i)).toBeNull();
    expect(screen.queryByText('ETH')).toBeNull();
  });
});

describe('SignalDetail — error state', () => {
  beforeEach(() => {
    useSignal.mockReturnValue({ signal: null, loading: false, error: 'Not found' });
  });
  afterEach(() => vi.clearAllMocks());

  it('shows not-found when error is set and signal is null', async () => {
    await renderSignalDetail('bad-id');
    expect(screen.getByText(/signal not found/i)).toBeInTheDocument();
  });
});
