import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import SignalHistoryTable from './SignalHistoryTable';

const MOCK_SIGNALS = [
  {
    id: 'sig-001',
    asset: 'ETH',
    direction: 'long',
    confidence: 4,
    entry_low: 3200,
    entry_high: 3400,
    target: 4000,
    stop_loss: 3000,
    explanation: 'ETH broke above key resistance.',
    status: 'win',
    outcome_return: 12.5,
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'sig-002',
    asset: 'BTC',
    direction: 'short',
    confidence: 2,
    entry_low: 65000,
    entry_high: 67000,
    target: 58000,
    stop_loss: 70000,
    explanation: 'BTC rejected at ATH.',
    status: 'loss',
    outcome_return: -5.0,
    created_at: '2024-01-20T14:30:00Z',
  },
  {
    id: 'sig-003',
    asset: 'SOL',
    direction: 'long',
    confidence: 5,
    entry_low: 80,
    entry_high: 85,
    target: 120,
    stop_loss: 72,
    explanation: 'SOL accumulation pattern.',
    status: 'active',
    outcome_return: null,
    created_at: '2024-02-01T09:00:00Z',
  },
];

function renderTable(props = {}) {
  return render(
    <MemoryRouter>
      <SignalHistoryTable signals={MOCK_SIGNALS} loading={false} {...props} />
    </MemoryRouter>,
  );
}

describe('SignalHistoryTable', () => {
  /* ─── Rendering ───────────────────────────────────────── */
  it('renders a row for each signal', () => {
    renderTable();
    const rows = screen.getAllByRole('row');
    // 1 header row + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('renders asset names in table cells', () => {
    renderTable();
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('SOL')).toBeInTheDocument();
  });

  it('renders direction labels', () => {
    renderTable();
    const longLabels = screen.getAllByText('Long');
    const shortLabels = screen.getAllByText('Short');
    expect(longLabels.length).toBeGreaterThanOrEqual(1);
    expect(shortLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('renders confidence dots', () => {
    renderTable();
    // ETH has confidence 4 → 4 filled dots; BTC has 2; SOL has 5
    // Filled dot count should be at least 4+2+5=11
    const filledDots = screen.getAllByText('●');
    expect(filledDots.length).toBeGreaterThanOrEqual(11);
  });

  it('renders outcome badges', () => {
    renderTable();
    expect(screen.getByText('Win')).toBeInTheDocument();
    expect(screen.getByText('Loss')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders positive return with + prefix', () => {
    renderTable();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('renders negative return without + prefix', () => {
    renderTable();
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('renders — for null outcome_return', () => {
    renderTable();
    // SOL has null outcome_return → "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows empty state when no signals', () => {
    render(<MemoryRouter><SignalHistoryTable signals={[]} loading={false} /></MemoryRouter>);
    expect(screen.getByText(/no signal history/i)).toBeInTheDocument();
  });

  it('shows skeleton while loading', () => {
    render(<MemoryRouter><SignalHistoryTable signals={[]} loading={true} /></MemoryRouter>);
    // TableSkeleton renders animated pulse divs — table element should NOT exist
    expect(screen.queryByTestId('signal-history-table')).toBeNull();
  });

  /* ─── Sorting ─────────────────────────────────────────── */
  it('initially sorts by date descending (most recent first)', () => {
    renderTable();
    const rows = screen.getAllByRole('row');
    // Row 1 (index 1 = first data row) should be SOL (most recent 2024-02-01)
    expect(rows[1]).toHaveTextContent('SOL');
    // Row 2 should be BTC (2024-01-20)
    expect(rows[2]).toHaveTextContent('BTC');
    // Row 3 should be ETH (2024-01-15)
    expect(rows[3]).toHaveTextContent('ETH');
  });

  it('sorts by confidence descending when Confidence header clicked', () => {
    renderTable();
    const confidenceHeader = screen.getByRole('columnheader', { name: /confidence/i });
    fireEvent.click(confidenceHeader);
    const rows = screen.getAllByRole('row');
    // Descending: SOL (5), ETH (4), BTC (2)
    expect(rows[1]).toHaveTextContent('SOL');
    expect(rows[2]).toHaveTextContent('ETH');
    expect(rows[3]).toHaveTextContent('BTC');
  });

  it('sorts by confidence ascending when Confidence clicked twice', () => {
    renderTable();
    const confidenceHeader = screen.getByRole('columnheader', { name: /confidence/i });
    fireEvent.click(confidenceHeader);
    fireEvent.click(confidenceHeader);
    const rows = screen.getAllByRole('row');
    // Ascending: BTC (2), ETH (4), SOL (5)
    expect(rows[1]).toHaveTextContent('BTC');
    expect(rows[2]).toHaveTextContent('ETH');
    expect(rows[3]).toHaveTextContent('SOL');
  });

  it('sorts by date ascending when Date header clicked once (toggles from desc)', () => {
    renderTable();
    // Initial: sortKey=created_at, sortDir=desc → SOL, BTC, ETH
    const dateHeader = screen.getByRole('columnheader', { name: /date/i });
    fireEvent.click(dateHeader); // same key → toggle to asc → ETH, BTC, SOL
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('ETH');
    expect(rows[2]).toHaveTextContent('BTC');
    expect(rows[3]).toHaveTextContent('SOL');
  });

  /* ─── Accessibility ───────────────────────────────────── */
  it('has aria-sort on sorted column header', () => {
    renderTable();
    const dateHeader = screen.getByRole('columnheader', { name: /date/i });
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
  });
});
