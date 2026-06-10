/**
 * Alerts MVP
 * Rules are stored in localStorage. On every watchlist load, rules are checked
 * against current wallet data and fired as window events that the Sidebar picks up.
 *
 * Rule schema: { id, walletAddress, walletLabel, type, threshold, createdAt }
 * type: 'signal_bullish' | 'signal_bearish' | 'score_above' | 'score_below'
 */

import { useEffect, useRef, useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import Button from '../components/ui/Button';
import { SignalPill } from '../components/ui/Badge';
import { TextureButton } from '../components/ui/texture-button';
import { TextureCard, TextureCardContent } from '../components/ui/texture-card';

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
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    const handler = (e) => {
      const alert = {
        id: Date.now(),
        wallet: e.detail?.wallet?.label || e.detail?.historyEntry?.walletLabel || 'Unknown',
        signal: e.detail?.wallet?.signal || e.detail?.historyEntry?.signal || 'NEUTRAL',
        rule: e.detail?.rule ? ruleDescription(e.detail.rule) : e.detail?.historyEntry?.ruleDescription || 'Signal change',
        firedAt: new Date().toISOString(),
      };
      setHistory((prev) => {
        const updated = [alert, ...prev].slice(0, 100);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    };
    window.addEventListener('sentinel-alert-fired', handler);
    return () => window.removeEventListener('sentinel-alert-fired', handler);
  }, []);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[14px] font-medium">Alert History</h2>
        {history.length > 0 && (
          <button type="button" onClick={clearHistory}
            className="text-[11px] text-text-muted hover:text-text-secondary">
            Clear all
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 border border-border-subtle rounded-xl">
          <svg className="w-8 h-8 text-text-muted" viewBox="0 0 24 24" fill="none">
            <path d="M15 17H20L18.6 15.6A2 2 0 0 1 18 14.2V11A6 6 0 0 0 7 11V14.2A2 2 0 0 1 6.4 15.6L5 17H10M15 17V18A3 3 0 0 1 9 18V17M15 17H9"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-[14px] text-text-secondary">No alerts fired yet</p>
          <p className="text-[12px] text-text-muted text-center max-w-xs">
            When a wallet matches your rules, alerts appear here instantly
          </p>
        </div>
      ) : (
        <div className="border border-border-subtle rounded-xl overflow-hidden">
          {history.map((item) => (
            <div key={item.id}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors">
              <div className={`w-[3px] self-stretch rounded-full flex-shrink-0 ${
                item.signal === 'BULLISH' ? 'bg-green' : item.signal === 'BEARISH' ? 'bg-red' : 'bg-amber'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-text-primary truncate">{item.wallet}</span>
                  <SignalPill signal={item.signal} />
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">{item.rule}</p>
              </div>
              <span className="text-[11px] text-text-muted font-mono flex-shrink-0">
                {relativeTime(item.firedAt || item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const { wallets } = useWatchlist();
  const [rules, setRules] = useState(loadRules);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { document.title = 'Alerts — Hadaleum'; }, []);

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
            <p className="text-[12px] text-text-muted mt-2 max-w-md leading-relaxed">
              Get notified when a whale changes signal, crosses a score threshold, or moves on-chain.
            </p>
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
          <TextureCard>
            <TextureCardContent className="py-16 flex flex-col items-center text-center">
            <svg width="40" height="40" viewBox="0 0 16 16" fill="none" className="stroke-text-muted mb-3">
              <path d="M8 2.3C6.1 2.3 4.8 3.7 4.8 5.7V7.1C4.8 8.1 4.4 9 3.8 9.7L3.1 10.5H12.9L12.2 9.7C11.6 9 11.2 8.1 11.2 7.1V5.7C11.2 3.7 9.9 2.3 8 2.3Z" strokeWidth="1.2" />
              <path d="M6.5 12.1C6.7 12.9 7.3 13.3 8 13.3C8.7 13.3 9.3 12.9 9.5 12.1" strokeWidth="1.2" />
            </svg>
            <div className="text-[14px] text-text-secondary font-display mb-1">No alerts configured</div>
            <div className="text-[12px] text-text-muted mb-6 max-w-sm">Create rules to be notified when wallets change signal or cross a score threshold.</div>
            <TextureButton variant="primary" className="!w-auto" onClick={() => setShowForm(true)}>
              <span className="px-3 text-green font-semibold">+ New alert</span>
            </TextureButton>
            </TextureCardContent>
          </TextureCard>
        ) : (
          <div className="flex flex-col gap-3">
            {rules.map((rule) => {
              const condition = rule.type === 'signal_bullish' ? 'BULLISH'
                : rule.type === 'signal_bearish' ? 'BEARISH' : 'NEUTRAL';
              return (
              <div
                key={rule.id}
                className="bg-bg-surface border border-border-default rounded-xl p-4 flex items-center gap-4 hover:border-border-strong transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.active ? 'bg-green' : 'bg-text-muted'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary">{rule.walletLabel}</span>
                    {(rule.type === 'signal_bullish' || rule.type === 'signal_bearish') && (
                      <SignalPill signal={condition} />
                    )}
                  </div>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    Notify when {ruleDescription(rule)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleToggle(rule.id)}
                    className="text-[11px] px-2.5 py-1.5 border border-border-default rounded-lg text-text-secondary hover:bg-bg-elevated transition-colors">
                    {rule.active ? 'Pause' : 'Resume'}
                  </button>
                  <button type="button" onClick={() => handleDelete(rule.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-red-dim hover:text-red transition-colors border border-transparent hover:border-red-border">
                    <svg width="12" height="12" viewBox="0 0 12 12">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            );})}
          </div>
        )}

        <AlertHistory />
      </div>
    </div>
  );
}
