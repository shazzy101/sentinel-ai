import { describe, it, expect } from 'vitest';
import { formatSignalTweet } from './signalTweet';

const MOCK_SIGNAL = {
  signal_number: 42,
  asset: 'ETH',
  direction: 'long',
  confidence: 4,
  entry_low: 3000,
  entry_high: 3400,
  target: 4200,
  stop_loss: 2800,
  explanation: 'Large whale accumulation detected across 3 wallets.',
  created_at: '2026-06-16T12:00:00.000Z',
};

describe('formatSignalTweet', () => {
  it('contains HADALEUM SIGNAL #<number>', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('HADALEUM SIGNAL #42');
  });

  it('contains the asset', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('ETH');
  });

  it('contains Long (capitalised)', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('Long');
  });

  it('contains Short (capitalised) for short direction', () => {
    const text = formatSignalTweet({ ...MOCK_SIGNAL, direction: 'short' });
    expect(text).toContain('Short');
  });

  it('contains the entry price', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    // midpoint of 3000 + 3400 = 3200
    expect(text).toContain('3,200');
  });

  it('contains the target price', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('4,200');
  });

  it('contains a + sign and % for target', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    // 4200 is 31.25% up from 3200
    expect(text).toMatch(/\+[\d.]+%/);
  });

  it('contains the explanation', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('Large whale accumulation detected across 3 wallets.');
  });

  it('contains the track-record URL', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('hadaleum.com/track-record');
  });

  it('contains #crypto hashtag', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('#crypto');
  });

  it('contains #ethereum hashtag', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('#ethereum');
  });

  it('contains #whale hashtag', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('#whale');
  });

  it('contains the ISO timestamp', () => {
    const text = formatSignalTweet(MOCK_SIGNAL);
    expect(text).toContain('2026-06-16T12:00:00.000Z');
  });

  it('handles null signal gracefully', () => {
    expect(formatSignalTweet(null)).toBe('');
    expect(formatSignalTweet(undefined)).toBe('');
  });

  it('handles missing optional fields without crashing', () => {
    const sparse = { asset: 'BTC', direction: 'short', signal_number: 1 };
    const text = formatSignalTweet(sparse);
    expect(text).toContain('HADALEUM SIGNAL #1');
    expect(text).toContain('BTC');
    expect(text).toContain('Short');
    expect(text).toContain('hadaleum.com/track-record');
  });

  it('uses ? for missing signal_number', () => {
    const text = formatSignalTweet({ asset: 'SOL', direction: 'long' });
    expect(text).toContain('HADALEUM SIGNAL #?');
  });
});
