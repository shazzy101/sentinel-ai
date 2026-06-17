/**
 * exportCsv.js — CSV export utilities for signal track record.
 *
 * `signalsToCsv` is a pure function (no DOM, testable in Node/jsdom).
 * `downloadCsv` triggers a browser download — keep it out of unit tests.
 */

const HEADERS = [
  'signal_number',
  'asset',
  'direction',
  'confidence',
  'entry_low',
  'entry_high',
  'target',
  'stop_loss',
  'status',
  'outcome_return',
  'created_at',
];

/**
 * Escape a single CSV cell value per RFC 4180:
 * - If the value contains a comma, double-quote, or newline → wrap in double-quotes
 * - Any double-quote inside is escaped as ""
 */
function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of signal objects into a CSV string.
 * Pure function — no DOM side-effects.
 *
 * @param {Object[]} rows - Array of signal objects
 * @returns {string} CSV string with header row + one data row per signal
 */
export function signalsToCsv(rows) {
  const headerRow = HEADERS.map(escapeCell).join(',');
  const dataRows = rows.map((signal) => {
    return HEADERS.map((key) => escapeCell(signal[key])).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger a browser file download for a CSV string.
 * Not pure — creates a Blob and DOM anchor; exclude from unit tests.
 *
 * @param {string} filename - e.g. 'hadaleum-track-record.csv'
 * @param {string} csvString - output of signalsToCsv()
 */
export function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
