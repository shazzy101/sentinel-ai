import { describe, it, expect } from 'vitest';
import { signalsToCsv } from './exportCsv';

const MOCK_SIGNAL = {
  signal_number: 42,
  asset: 'ETH',
  direction: 'long',
  confidence: 4,
  entry_low: 3200,
  entry_high: 3400,
  target: 4000,
  stop_loss: 3000,
  status: 'win',
  outcome_return: 12.5,
  created_at: '2024-01-15T10:00:00Z',
};

describe('signalsToCsv', () => {
  it('produces a correct header row as the first line', () => {
    const csv = signalsToCsv([MOCK_SIGNAL]);
    const [header] = csv.split('\n');
    expect(header).toBe(
      'signal_number,asset,direction,confidence,entry_low,entry_high,target,stop_loss,status,outcome_return,created_at',
    );
  });

  it('produces one data row per signal after the header', () => {
    const csv = signalsToCsv([MOCK_SIGNAL, MOCK_SIGNAL]);
    const lines = csv.split('\n');
    // 1 header + 2 data rows
    expect(lines).toHaveLength(3);
  });

  it('maps signal fields to the correct columns', () => {
    const csv = signalsToCsv([MOCK_SIGNAL]);
    const [, dataRow] = csv.split('\n');
    expect(dataRow).toBe('42,ETH,long,4,3200,3400,4000,3000,win,12.5,2024-01-15T10:00:00Z');
  });

  it('wraps cell values containing commas in double-quotes', () => {
    const signal = { ...MOCK_SIGNAL, asset: 'BTC,ETH' };
    const csv = signalsToCsv([signal]);
    const [, dataRow] = csv.split('\n');
    expect(dataRow).toContain('"BTC,ETH"');
  });

  it('escapes double-quotes inside a cell as ""', () => {
    const signal = { ...MOCK_SIGNAL, asset: 'A"B' };
    const csv = signalsToCsv([signal]);
    const [, dataRow] = csv.split('\n');
    expect(dataRow).toContain('"A""B"');
  });

  it('renders null/undefined fields as empty strings', () => {
    const signal = { ...MOCK_SIGNAL, outcome_return: null, stop_loss: undefined };
    const csv = signalsToCsv([signal]);
    const [, dataRow] = csv.split('\n');
    const cols = dataRow.split(',');
    // outcome_return is index 9, stop_loss is index 7
    expect(cols[7]).toBe('');
    expect(cols[9]).toBe('');
  });

  it('returns just the header row for an empty array', () => {
    const csv = signalsToCsv([]);
    expect(csv).toBe(
      'signal_number,asset,direction,confidence,entry_low,entry_high,target,stop_loss,status,outcome_return,created_at',
    );
  });
});
