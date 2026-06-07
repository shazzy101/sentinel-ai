/**
 * Alerts MVP
 * Rules are stored in localStorage. On every watchlist load, rules are checked
 * against current wallet data and fired as window events that the Sidebar picks up.
 *
 * Rule schema: { id, walletAddress, walletLabel, type, threshold, createdAt }
 * type: 'signal_bullish' | 'signal_bearish' | 'score_above' | 'score_below'
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import Button from '../components/ui/Button';
import { SignalPill } from '../components/ui/Badge';

const RULES_KEY = 'sentinel_alert_rules';
const FIRED_KEY = 'sentinel_fired_alerts';
const HISTORY_KEY = 'sentinel-alert-history';

function loadRules() {
  try { return JSON.parse(localStorage.getItem(RULES_KEY) || '[]'); }
  catch { return []; }
}
function saveRules(rules) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}
function loadFired() {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); }
  catch { return {}; }
}
function saveFired(obj) {
  localStorage.setItem(FIRED_KEY, JSON.stringify(obj));
}

function ruleMatchesWallet(rule, wallet) {
  if (rule.walletAddress !== wallet.address) return false;
  if (rule.type === 'signal_bullish') return wallet.signal === 'BULLISH';
  if (rule.type === 'signal_bearish') return wallet.signal === 'BEARISH';
  if (rule.type === 'score_above') return Number(wallet.score ?? 0) >= Number(rule.threshold);
  if (rule.type === 'score_below') return Number(wallet.score ?? 0) < Number(rule.threshold);
  return false;
}

function ruleDescription(rule) {
  if (rule.type === 'signal_bullish') return `goes BULLISH`;
  if (rule.type === 'signal_bearish') return `goes BEARISH`;
  if (rule.type === 'score_above') return `score ≥ ${rule.threshold}`;
  if (rule.type === 'score_below') return `score < ${rule.threshold}`;
  return rule.type;
}

const RULE_TYPES = [
  { value: 'signal_bullish', label: 'Signal → BULLISH' },
  { value: 'signal_bearish', label: 'Signal → BEARISH' },
  { value: 'score_above', label: 'Score rises above…', hasThreshold: true },
  { value: 'score_below', label: 'Score drops below…', hasThreshold: true },
];

function AddRuleForm({ wallets, onAdd, onCancel }) {
  const [address, setAddress] = useState('');
  const [type, setType] = useState('signal_bullish');
  const [threshold, setThreshold] = useState('80');

  const selectedType = RULE_TYPES.find((t) => t.value === type);
  const wallet = wallets.find((w) => w.address === address);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!address) return;
    onAdd({
      id: `${Date.now()}`,
      walletAddress: address,
      walletLabel: wallet?.label || address.slice(0, 10),
      type,
      threshold: Number(threshold),
      createdAt: new Date().toISOString(),
      active: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg-card border border-border-default rounded-xl p-5 flex flex-col gap-4">
      <div className="text-[13px] font-medium text-text-primary">New alert rule</div>

      <div>
        <label className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-1.5">Wallet</label>
        <select
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-border-focus transition-colors"
          required
        >
          <option value="">Select wallet…</option>
          {wallets.map((w) => (
            <option key={w.address} value={w.address}>{w.label || w.address}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-1.5">Condition</label>
        <div className="flex flex-col gap-1.5">
          {RULE_TYPES.map((rt) => (
            <label
              key={rt.value}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                type === rt.value
                  ? 'border-border-strong bg-bg-elevated text-text-primary'
                  : 'border-border-subtle text-text-muted hover:border-border-default'
              }`}
            >
              <input
                type="radio"
                name="rule_type"
                value={rt.value}
                checked={type === rt.value}
                onChange={() => setType(rt.value)}
                className="sr-only"
              />
              <span className="text-[12px]">{rt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedType?.hasThreshold && (
        <div>
          <label className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-1.5">Threshold (0–100)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary font-mono outline-none focus:border-border-focus transition-colors"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" className="flex-1 justify-center" disabled={!address}>
          Create alert
        </Button>
      </div>
    </form>
  );
}

export function useAlertEngine(wallets) {
  const firedRef = useRef(loadFired());

  useEffect(() => {
    if (!wallets.length) return;
    const rules = loadRules();
    const fired = { ...firedRef.current };
    let anyNew = false;

    for (const rule of rules) {
      if (!rule.active) continue;
      const wallet = wallets.find((w) => w.address === rule.walletAddress);
      if (!wallet) continue;

      const key = `${rule.id}_${wallet.signal}_${wallet.score}`;
      if (fired[rule.id] === key) continue; // already fired for this exact state

      if (ruleMatchesWallet(rule, wallet)) {
        fired[rule.id] = key;
        anyNew = true;
        const historyEntry = {
          id: `${Date.now()}-${rule.id}`,
          walletLabel: wallet.label || 'Unknown',
          walletAddress: wallet.address,
          signal: wallet.signal,
          score: wallet.score,
          ruleType: rule.type,
          ruleDescription: ruleDescription(rule),
          timestamp: new Date().toISOString(),
        };
        try {
          const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
          const updated = [historyEntry, ...existing].slice(0, 50);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('sentinel-alert-fired', {
          detail: {
            rule,
            wallet,
            message: `${wallet.label || 'Wallet'} ${ruleDescription(rule)}`,
            historyEntry,
          },
        }));
      }
    }

    if (anyNew) {
      firedRef.current = fired;
      saveFired(fired);
    }
  }, [wallets]);
}

function relativeTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AlertHistory() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });

  const refresh = useCallback(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); } catch { setHistory([]); }
  }, []);

  useEffect(() => {
    window.addEventListener('sentinel-alert-fired', refresh);
    return () => window.removeEventListener('sentinel-alert-fired', refresh);
  }, [refresh]);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const signalColor = (sig) => {
    if (sig === 'BULLISH') return 'border-green bg-green-dim';
    if (sig === 'BEARISH') return 'border-red bg-red-dim';
    return 'border-amber bg-amber-dim';
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-medium text-text-primary">Alert History</div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            Clear history
          </button>
        )}
      </div>
      <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
        {history.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <svg width="32" height="32" viewBox="0 0 16 16" fill="none" className="stroke-text-muted mb-3">
              <path d="M8 2.3C6.1 2.3 4.8 3.7 4.8 5.7V7.1C4.8 8.1 4.4 9 3.8 9.7L3.1 10.5H12.9L12.2 9.7C11.6 9 11.2 8.1 11.2 7.1V5.7C11.2 3.7 9.9 2.3 8 2.3Z" strokeWidth="1.2" />
              <path d="M6.5 12.1C6.7 12.9 7.3 13.3 8 13.3C8.7 13.3 9.3 12.9 9.5 12.1" strokeWidth="1.2" />
            </svg>
            <div className="text-[13px] text-text-muted">No alerts fired yet</div>
            <div className="text-[12px] text-text-muted mt-1 opacity-70">Alerts will appear here when your rules match</div>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {history.map((entry) => (
              <div key={entry.id} className={`flex items-start gap-3 px-4 py-3 border-l-2 ${signalColor(entry.signal)}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary truncate">{entry.walletLabel}</span>
                    <SignalPill signal={entry.signal || 'NEUTRAL'} />
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {entry.ruleDescription} · {relativeTime(entry.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { wallets } = useWatchlist();
  const [rules, setRules] = useState(loadRules);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { document.title = 'Alerts — Sentinel AI'; }, []);

  // Persist on change
  useEffect(() => { saveRules(rules); }, [rules]);

  const handleAdd = (rule) => {
    setRules((prev) => [rule, ...prev]);
    setShowForm(false);
  };

  const handleDelete = (id) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggle = (id) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, active: !r.active } : r));
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-[1.2px] text-text-muted mb-1">Alert rules</div>
            <div className="text-[13px] text-text-secondary">
              {rules.length === 0 ? 'No rules yet' : `${rules.filter((r) => r.active).length} active of ${rules.length}`}
            </div>
          </div>
          {!showForm && (
            <Button variant="primary" onClick={() => setShowForm(true)}>+ New alert</Button>
          )}
        </div>

        {showForm && (
          <div className="mb-4">
            <AddRuleForm wallets={wallets} onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          </div>
        )}

        {rules.length === 0 && !showForm ? (
          <div className="bg-bg-card border border-border-subtle rounded-xl py-16 flex flex-col items-center text-center">
            <svg width="40" height="40" viewBox="0 0 16 16" fill="none" className="stroke-text-muted mb-3">
              <path d="M8 2.3C6.1 2.3 4.8 3.7 4.8 5.7V7.1C4.8 8.1 4.4 9 3.8 9.7L3.1 10.5H12.9L12.2 9.7C11.6 9 11.2 8.1 11.2 7.1V5.7C11.2 3.7 9.9 2.3 8 2.3Z" strokeWidth="1.2" />
              <path d="M6.5 12.1C6.7 12.9 7.3 13.3 8 13.3C8.7 13.3 9.3 12.9 9.5 12.1" strokeWidth="1.2" />
            </svg>
            <div className="text-[14px] text-text-secondary font-display mb-1">No alerts configured</div>
            <div className="text-[12px] text-text-muted mb-4">Create rules to be notified when wallets change signal or cross a score threshold.</div>
            <Button variant="primary" onClick={() => setShowForm(true)}>+ New alert</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-bg-card border rounded-xl px-4 py-3.5 flex items-center gap-3 ${
                  rule.active ? 'border-border-default' : 'border-border-subtle opacity-50'
                }`}
              >
                {/* Active dot */}
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                  rule.active ? 'bg-green relative pulse-dot' : 'bg-border-strong'
                }`} />

                {/* Rule info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary truncate">{rule.walletLabel}</span>
                    {(rule.type === 'signal_bullish' || rule.type === 'signal_bearish') && (
                      <SignalPill signal={rule.type === 'signal_bullish' ? 'BULLISH' : 'BEARISH'} />
                    )}
                    {(rule.type === 'score_above' || rule.type === 'score_below') && (
                      <span className="text-[10px] font-mono bg-bg-elevated border border-border-default rounded px-1.5 py-0.5 text-text-secondary">
                        {rule.type === 'score_above' ? '≥' : '<'} {rule.threshold}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Notify when {ruleDescription(rule)}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(rule.id)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-border-default text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors h-7"
                  >
                    {rule.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rule.id)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-border-default text-text-muted hover:bg-red-dim hover:text-red hover:border-red-border transition-colors h-7"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <AlertHistory />
      </div>
    </div>
  );
}
