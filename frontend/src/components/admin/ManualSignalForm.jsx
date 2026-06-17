/**
 * ManualSignalForm — controlled form to manually create a signal.
 *
 * Props:
 *   onSubmit(payload)  — called with normalized API payload on valid submit
 *   loading            — disables submit button while request is in-flight
 *
 * Exported helper:
 *   buildSignalPayload(formValues) — pure normalizer; unit-testable
 */
import { useState } from 'react';

// ─── Pure payload builder ────────────────────────────────────────────────────

/**
 * Normalize raw form values into the shape expected by POST /api/admin/signals.
 * - Splits comma-separated whale_wallets and tx_hashes into arrays.
 * - Coerces numeric strings to numbers (undefined/null → null).
 */
export function buildSignalPayload(values) {
  const splitTrim = (str) =>
    str
      ? str
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const toNum = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  return {
    asset: (values.asset || '').trim().toUpperCase(),
    direction: values.direction || '',
    confidence: toNum(values.confidence),
    entry_low: toNum(values.entry_low),
    entry_high: toNum(values.entry_high),
    target: toNum(values.target),
    stop_loss: toNum(values.stop_loss),
    explanation: (values.explanation || '').trim() || null,
    pattern_type: (values.pattern_type || '').trim() || null,
    whale_wallets: splitTrim(values.whale_wallets),
    tx_hashes: splitTrim(values.tx_hashes),
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validate(values) {
  const errors = {};

  if (!values.asset || !values.asset.trim()) {
    errors.asset = 'Asset is required.';
  }

  if (!['long', 'short'].includes(values.direction)) {
    errors.direction = 'Direction must be long or short.';
  }

  const conf = Number(values.confidence);
  if (!values.confidence || isNaN(conf) || conf < 1 || conf > 5) {
    errors.confidence = 'Confidence must be 1–5.';
  }

  const numericFields = ['entry_low', 'entry_high', 'target', 'stop_loss'];
  numericFields.forEach((field) => {
    if (values[field] !== '' && values[field] != null) {
      const n = Number(values[field]);
      if (isNaN(n)) {
        errors[field] = 'Must be a number.';
      }
    }
  });

  return errors;
}

// ─── Component ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  asset: '',
  direction: '',
  confidence: '',
  entry_low: '',
  entry_high: '',
  target: '',
  stop_loss: '',
  explanation: '',
  pattern_type: '',
  whale_wallets: '',
  tx_hashes: '',
};

export default function ManualSignalForm({ onSubmit, loading = false }) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const field = (name) => ({
    value: values[name],
    onChange: (e) => {
      setValues((prev) => ({ ...prev, [name]: e.target.value }));
      if (submitted) {
        // Re-validate live after first submit attempt
        const next = { ...values, [name]: e.target.value };
        const errs = validate(next);
        setErrors(errs);
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(buildSignalPayload(values));
  };

  const inputCls = (name) =>
    `w-full bg-white/5 border ${
      errors[name] ? 'border-loss/60' : 'border-white/10'
    } rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-signal/50`;

  const labelCls = 'block text-xs text-text-muted mb-1';
  const errorCls = 'text-xs text-loss mt-0.5';

  return (
    <form onSubmit={handleSubmit} noValidate data-testid="manual-signal-form" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Asset */}
        <div>
          <label htmlFor="msf-asset" className={labelCls}>Asset *</label>
          <input
            id="msf-asset"
            type="text"
            placeholder="ETH"
            className={inputCls('asset')}
            {...field('asset')}
          />
          {errors.asset && <p className={errorCls} role="alert">{errors.asset}</p>}
        </div>

        {/* Direction */}
        <div>
          <label htmlFor="msf-direction" className={labelCls}>Direction *</label>
          <select
            id="msf-direction"
            className={inputCls('direction')}
            {...field('direction')}
          >
            <option value="">Select…</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          {errors.direction && <p className={errorCls} role="alert">{errors.direction}</p>}
        </div>

        {/* Confidence */}
        <div>
          <label htmlFor="msf-confidence" className={labelCls}>Confidence (1–5) *</label>
          <select
            id="msf-confidence"
            className={inputCls('confidence')}
            {...field('confidence')}
          >
            <option value="">Select…</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {errors.confidence && <p className={errorCls} role="alert">{errors.confidence}</p>}
        </div>

        {/* Pattern type */}
        <div>
          <label htmlFor="msf-pattern-type" className={labelCls}>Pattern Type</label>
          <input
            id="msf-pattern-type"
            type="text"
            placeholder="Accumulation"
            className={inputCls('pattern_type')}
            {...field('pattern_type')}
          />
        </div>

        {/* Entry low */}
        <div>
          <label htmlFor="msf-entry-low" className={labelCls}>Entry Low</label>
          <input
            id="msf-entry-low"
            type="number"
            step="any"
            placeholder="3000"
            className={`${inputCls('entry_low')} font-mono`}
            {...field('entry_low')}
          />
          {errors.entry_low && <p className={errorCls} role="alert">{errors.entry_low}</p>}
        </div>

        {/* Entry high */}
        <div>
          <label htmlFor="msf-entry-high" className={labelCls}>Entry High</label>
          <input
            id="msf-entry-high"
            type="number"
            step="any"
            placeholder="3400"
            className={`${inputCls('entry_high')} font-mono`}
            {...field('entry_high')}
          />
          {errors.entry_high && <p className={errorCls} role="alert">{errors.entry_high}</p>}
        </div>

        {/* Target */}
        <div>
          <label htmlFor="msf-target" className={labelCls}>Target</label>
          <input
            id="msf-target"
            type="number"
            step="any"
            placeholder="4200"
            className={`${inputCls('target')} font-mono`}
            {...field('target')}
          />
          {errors.target && <p className={errorCls} role="alert">{errors.target}</p>}
        </div>

        {/* Stop loss */}
        <div>
          <label htmlFor="msf-stop-loss" className={labelCls}>Stop Loss</label>
          <input
            id="msf-stop-loss"
            type="number"
            step="any"
            placeholder="2800"
            className={`${inputCls('stop_loss')} font-mono`}
            {...field('stop_loss')}
          />
          {errors.stop_loss && <p className={errorCls} role="alert">{errors.stop_loss}</p>}
        </div>
      </div>

      {/* Explanation */}
      <div>
        <label htmlFor="msf-explanation" className={labelCls}>Explanation</label>
        <textarea
          id="msf-explanation"
          rows={3}
          placeholder="Describe the signal rationale…"
          className={`${inputCls('explanation')} resize-none`}
          {...field('explanation')}
        />
      </div>

      {/* Whale wallets */}
      <div>
        <label htmlFor="msf-whale-wallets" className={labelCls}>Whale Wallets (comma-separated)</label>
        <input
          id="msf-whale-wallets"
          type="text"
          placeholder="0xABC…, 0xDEF…"
          className={`${inputCls('whale_wallets')} font-mono`}
          {...field('whale_wallets')}
        />
      </div>

      {/* TX hashes */}
      <div>
        <label htmlFor="msf-tx-hashes" className={labelCls}>TX Hashes (comma-separated)</label>
        <input
          id="msf-tx-hashes"
          type="text"
          placeholder="0x123…, 0x456…"
          className={`${inputCls('tx_hashes')} font-mono`}
          {...field('tx_hashes')}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        data-testid="msf-submit"
        className="px-5 py-2 text-sm font-semibold rounded bg-signal/20 text-signal border border-signal/40 hover:bg-signal/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Submitting…' : 'Create Signal'}
      </button>
    </form>
  );
}
