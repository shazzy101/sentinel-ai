/**
 * signalTweet.js — pure tweet-text generator for Hadaleum signals.
 * No React, no side-effects. Fully testable.
 */

/**
 * Build confidence stars string: ★★★☆☆ style (1–5 scale).
 * @param {number|null} score
 */
function confidenceStars(score) {
  const n = Math.min(5, Math.max(1, score ?? 1));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/**
 * Format a number as a price string with up to 2 decimal places,
 * omitting trailing zeros but always showing at least 0.
 */
function fmtPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return '???';
  const num = Number(n);
  // Use up to 8 decimal places for small numbers, else 2
  if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '');
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Calculate % change from entry to target.
 * Returns a string like "+12.34%" or "-5.00%".
 */
function calcPct(entry, target) {
  if (entry == null || target == null || Number(entry) === 0) return '?%';
  const pct = ((Number(target) - Number(entry)) / Math.abs(Number(entry))) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * formatSignalTweet(signal) — returns the canonical tweet text for a signal.
 *
 * Signal shape (all fields nullable/optional):
 *   signal_number, asset, direction, confidence, entry_low, entry_high,
 *   target, stop_loss, explanation, created_at
 */
export function formatSignalTweet(signal) {
  if (!signal) return '';

  const num = signal.signal_number != null ? signal.signal_number : '?';
  const asset = signal.asset ?? '???';
  const direction =
    signal.direction === 'long'
      ? 'Long'
      : signal.direction === 'short'
        ? 'Short'
        : signal.direction
          ? signal.direction.charAt(0).toUpperCase() + signal.direction.slice(1)
          : '???';

  const stars = confidenceStars(signal.confidence);

  // Entry: midpoint of entry_low/entry_high if both present, else entry_low
  const entry =
    signal.entry_low != null && signal.entry_high != null
      ? (Number(signal.entry_low) + Number(signal.entry_high)) / 2
      : signal.entry_low ?? signal.entry_high ?? null;

  const target = signal.target ?? null;
  const stop = signal.stop_loss ?? null;
  const explanation = signal.explanation ?? '';
  const timestamp = signal.created_at ?? new Date().toISOString();
  const pct = calcPct(entry, target);

  return [
    `🐋 HADALEUM SIGNAL #${num}`,
    '',
    `${asset} ${direction} detected`,
    `Confidence: ${stars}`,
    '',
    `Entry: $${fmtPrice(entry)}`,
    '',
    `Target: $${fmtPrice(target)} (${pct})`,
    '',
    `Stop: $${fmtPrice(stop)}`,
    `Why: ${explanation}`,
    `Timestamp: ${timestamp}`,
    '',
    'Track record: hadaleum.com/track-record',
    '#crypto #ethereum #whale',
  ].join('\n');
}
