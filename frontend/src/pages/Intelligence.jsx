import { useCallback, useEffect, useState } from 'react';
import Spinner from '../components/ui/Spinner';
import { ChainBadge, GradeBadge, SignalPill } from '../components/ui/Badge';
import ScoreRing from '../components/ui/ScoreRing';

const API_BASE = import.meta.env.VITE_API_URL || '';

function gradeFromScore(score) {
  if (score >= 92) return 'S';
  if (score >= 82) return 'A';
  if (score >= 68) return 'B';
  if (score >= 52) return 'C';
  if (score >= 36) return 'D';
  return 'F';
}

function relativeTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SignalRow({ item }) {
  const score = Number(item.score ?? 0);
  const grade = gradeFromScore(score);
  const addr = item.wallet_address
    ? `${item.wallet_address.slice(0, 6)}…${item.wallet_address.slice(-4)}`
    : '';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-subtle last:border-0">
      <ScoreRing score={score} size={36} strokeWidth={3} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-text-primary truncate">
            {item.wallet_label || 'Unknown wallet'}
          </span>
          <GradeBadge grade={grade} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-text-muted">{addr}</span>
          {item.generated_at && (
            <span className="text-[10px] text-text-muted">{relativeTime(item.generated_at)}</span>
          )}
        </div>
        {item.signal_reason && (
          <p className="text-[11px] text-text-secondary mt-1 leading-[1.5] line-clamp-2">
            {item.signal_reason}
          </p>
        )}
      </div>
      <SignalPill signal={item.signal || 'NEUTRAL'} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-6 flex flex-col gap-5">
      <div className="bg-bg-card border border-border-default rounded-xl p-5">
        <div className="skeleton h-3 w-24 rounded mb-3" />
        <div className="skeleton h-6 w-2/3 rounded mb-3" />
        <div className="skeleton h-3 w-40 rounded ml-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-card border border-border-default rounded-xl p-4">
          <div className="skeleton h-3 w-16 rounded mb-3" />
          <div className="skeleton h-4 w-full rounded" />
        </div>
        <div className="bg-bg-card border border-border-default rounded-xl p-4">
          <div className="skeleton h-3 w-16 rounded mb-3" />
          <div className="skeleton h-4 w-full rounded" />
        </div>
      </div>
      <div className="text-[13px] text-text-muted flex items-center gap-2">
        <Spinner size="sm" />
        Generating intelligence...
      </div>
    </div>
  );
}

export default function IntelligencePage() {
  const [summary, setSummary] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, signalsRes] = await Promise.all([
        fetch(`${API_BASE}/api/intelligence/summary`),
        fetch(`${API_BASE}/api/intelligence/signals`),
      ]);
      const summaryBody = await summaryRes.json();
      if (!summaryBody.success) throw new Error(summaryBody.error?.message || 'Failed to load intelligence');
      setSummary(summaryBody.data?.summary || null);
      const signalsBody = await signalsRes.json();
      if (signalsBody.success) setSignals(signalsBody.data?.signals || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const regenerate = () => load();
    window.addEventListener('regenerate-intelligence', regenerate);
    return () => window.removeEventListener('regenerate-intelligence', regenerate);
  }, [load]);

  if (loading) {
    return (
      <div className="h-full min-h-0 overflow-y-auto">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    <div className="max-w-3xl mx-auto px-5 py-6 flex flex-col gap-5">
      {error ? (
        <div className="bg-bg-card border border-red-border rounded-xl p-4 text-red text-[13px]">
          {error}
        </div>
      ) : null}

      <section className="relative bg-bg-card border border-border-default rounded-xl p-5">
        <div className="absolute w-[2px] left-0 top-4 bottom-4 bg-green rounded-r-full" />
        <div className="flex items-center">
          <span className="text-[10px] uppercase tracking-[1px] text-text-muted">Market signal</span>
          <div className="ml-auto">
            <SignalPill signal={summary?.top_signal || 'NEUTRAL'} />
          </div>
        </div>
        <h2 className="font-display text-[17px] font-bold text-text-primary leading-[1.4] mt-2">
          {summary?.headline || 'Ethereum smart money remains selectively constructive.'}
        </h2>
        <div className="text-[10px] text-text-muted mt-3 text-right">
          Generated {new Date().toLocaleTimeString()}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <article className="bg-bg-card border border-border-default rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ChainBadge chain="ethereum" />
            <span className="text-[11px] uppercase tracking-[1px] text-text-muted">Ethereum</span>
          </div>
          <p className="text-[13px] text-text-secondary leading-[1.6] mt-2">
            {summary?.ethereum_outlook || 'AI outlook not available yet.'}
          </p>
        </article>
        <article className="bg-bg-card border border-border-default rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ChainBadge chain="ethereum" />
            <span className="text-[11px] uppercase tracking-[1px] text-text-muted">Flow state</span>
          </div>
          <p className="text-[13px] text-text-secondary leading-[1.6] mt-2">
            {summary?.flow_state || 'Mixed'}
          </p>
        </article>
      </section>

      <section>
        <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-2">Key themes</div>
        <div className="flex flex-wrap gap-2">
          {(summary?.key_themes || ['Momentum concentration', 'Rotation into majors']).map((theme) => (
            <span key={theme} className="text-[11px] bg-bg-elevated border border-border-default rounded-full px-3 py-1 text-text-secondary">
              {theme}
            </span>
          ))}
        </div>
      </section>

      {/* Wallet signals feed */}
      <section className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <div className="text-[10px] uppercase tracking-[1px] text-text-muted">Recent signals</div>
          <div className="flex items-center gap-2">
            {signals.length > 0 && (
              <span className="text-[10px] text-text-muted">{signals.length} wallets</span>
            )}
            <ChainBadge chain="ethereum" />
          </div>
        </div>
        <div className="px-5">
          {signals.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-muted">
              No signals yet — scan wallets on the Watchlist to generate AI signals.
            </div>
          ) : (
            signals.map((item) => (
              <SignalRow key={item.wallet_address || item.wallet_label} item={item} />
            ))
          )}
        </div>
      </section>
    </div>
    </div>
  );
}
