import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { ChainBadge, GradeBadge, SignalPill } from '../components/ui/Badge';
import ScoreRing from '../components/ui/ScoreRing';
import { TextureCard, TextureCardContent } from '../components/ui/texture-card';
import TextShimmer from '../components/ui/text-shimmer';
import { apiFetch } from '../lib/apiClient';
import SignalAccuracyWidget from '../components/intelligence/SignalAccuracyWidget';
import TrustPulse from '../components/trust/TrustPulse';
import { supabase } from '../lib/supabase';
import { TableSkeleton } from '../components/primitives/DataState';
import { useAuth } from '@/context/AuthProvider';
import PaywallGate from '@/components/auth/PaywallGate';

function gradeFromScore(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

function gradeColor(grade) {
  switch (grade) {
    case 'S': return 'bg-green/20 text-green';
    case 'A': return 'bg-green/10 text-green';
    case 'B': return 'bg-amber/20 text-amber';
    case 'C': return 'bg-amber/10 text-amber';
    case 'D': return 'bg-red/10 text-red';
    default:  return 'bg-red/20 text-red';
  }
}

/** Extract at most 3 words from a theme string to keep pills tight. */
function shortenTheme(theme) {
  const words = theme.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return theme;
  return words.slice(0, 3).join(' ') + '…';
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

function CopyTraderSignalRow({ item }) {
  const m = item.copy_metrics || {};
  const signal = item.signal || 'NEUTRAL';
  const borderClass = signal === 'BULLISH' ? 'border-l-green/40' : 'border-l-border-subtle';
  return (
    <div className={`flex items-start gap-3 py-4 border-b border-border-subtle last:border-0 border-l-2 pl-3 -ml-3 ${borderClass}`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green/15 border border-green/25 flex items-center justify-center">
        <span className="text-[11px] font-bold font-mono text-green">#{item.rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-text-primary truncate">{item.wallet_label}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green/10 text-green border border-green/20 uppercase tracking-wide">Copy</span>
        </div>
        <p className="text-[11px] text-text-muted mt-0.5 font-mono">
          {m.unrealized_win_rate_pct != null && (
            <span title="Unrealized win rate — held positions marked to market">{m.unrealized_win_rate_pct}% WR · </span>
          )}
          PF {Number(m.profit_factor || 0).toFixed(1)} · {m.track_record_days}d
        </p>
        {item.signal_reason && (
          <p className="text-[12px] text-text-secondary mt-1 leading-relaxed line-clamp-2">{item.signal_reason}</p>
        )}
      </div>
      <SignalPill signal={item.signal || 'NEUTRAL'} />
    </div>
  );
}

function SignalRow({ item }) {
  const score = Number(item.score ?? 0);
  const grade = gradeFromScore(score);
  const addr = item.wallet_address
    ? `${item.wallet_address.slice(0, 6)}…${item.wallet_address.slice(-4)}`
    : '';
  const signal = item.signal || 'NEUTRAL';
  const borderClass = signal === 'BULLISH'
    ? 'border-l-green/50 bg-green/[0.03]'
    : signal === 'BEARISH'
      ? 'border-l-red/50 bg-red/[0.03]'
      : 'border-l-border-subtle';

  return (
    <div className={`flex items-start gap-3 py-4 border-b border-border-subtle last:border-0 border-l-2 pl-3 -ml-3 ${borderClass}`}>
      <ScoreRing score={score} size={40} strokeWidth={3} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-medium text-text-primary truncate">
            {item.wallet_label || 'Unknown wallet'}
          </span>
          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${gradeColor(grade)}`}>
            {grade}
          </span>
          {item.signal_source === 'ai' && (
            <span className="text-[9px] text-text-muted uppercase tracking-wide">AI</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-text-muted">{addr}</span>
          {item.generated_at && (
            <span className="text-[10px] text-text-muted">{relativeTime(item.generated_at)}</span>
          )}
        </div>
        {item.signal_reason && (
          <p className="text-[13px] text-text-secondary mt-2 leading-relaxed line-clamp-3">
            {item.signal_reason}
          </p>
        )}
      </div>
      <SignalPill signal={signal} />
    </div>
  );
}

function SignalFeed({ whaleSignals, copySignals, isPro, isTrialing }) {
  const [tab, setTab] = useState('copy');
  const filteredWhales = whaleSignals.filter((s) => (s.score ?? 0) >= 55);

  return (
    <TextureCard className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle gap-3">
        <div className="flex gap-1 p-0.5 rounded-lg bg-bg-elevated border border-border-subtle">
          {[
            { key: 'copy', label: 'Copy Traders', count: copySignals.length },
            { key: 'whale', label: 'Whale Research', count: filteredWhales.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`text-[11px] px-3 py-1.5 rounded-md transition-colors ${
                tab === key
                  ? 'bg-bg-surface text-text-primary font-medium shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {label}
              {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          ))}
        </div>
        <ChainBadge chain="ethereum" />
      </div>
      <div className="px-5 pb-2" aria-live="polite" aria-busy={copySignals.length === 0 && whaleSignals.length === 0}>
        {tab === 'copy' ? (
          copySignals.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-muted leading-relaxed">
              Copy trader signals loading from Dune rankings…
            </div>
          ) : (
            <>
              {copySignals.slice(0, 10).map((item, i) => (
                (isPro || isTrialing || i < 1) && (
                  <CopyTraderSignalRow key={item.wallet_address} item={item} />
                )
              ))}
              {!isPro && !isTrialing && copySignals.length > 1 && (
                <PaywallGate feature="Unlimited AI Signals" blur={false} />
              )}
            </>
          )
        ) : filteredWhales.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-text-muted leading-relaxed max-w-md mx-auto">
            No high-conviction whale alerts yet. Exchange hot wallets and low-score noise are filtered out —
            scan smart-money wallets on My Watchlist to populate this feed.
          </div>
        ) : (
          <>
            {filteredWhales.map((item, i) => (
              (isPro || isTrialing || i < 1) && (
                <SignalRow key={item.wallet_address || item.wallet_label} item={item} />
              )
            ))}
            {!isPro && !isTrialing && filteredWhales.length > 1 && (
              <PaywallGate feature="Unlimited AI Signals" blur={false} />
            )}
          </>
        )}
      </div>
    </TextureCard>
  );
}

function LoadingState() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
      <div className="flex items-center gap-3 text-sm text-text-muted">
        <Spinner size="sm" />
        <span>Generating Hadaleum intelligence…</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border-default bg-bg-surface p-4 space-y-3">
            <div className="animate-pulse h-2 w-16 rounded bg-white/[0.06]" />
            <div className="animate-pulse h-7 w-12 rounded bg-white/[0.06]" />
            <div className="animate-pulse h-2 w-20 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border-default bg-bg-surface p-5 space-y-3">
        <div className="animate-pulse h-3 w-24 rounded bg-white/[0.06]" />
        <div className="animate-pulse h-16 w-full rounded bg-white/[0.06]" />
        <div className="animate-pulse h-3 w-3/4 rounded bg-white/[0.06]" />
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}

export default function IntelligencePage() {
  const { isPro, isTrialing } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [whaleSignals, setWhaleSignals] = useState([]);
  const [copySignals, setCopySignals] = useState([]);
  const [meta, setMeta] = useState({ whale_count: 0, copy_trader_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = 'AI Signals — Hadaleum';
  }, []);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const summaryPath = refresh ? '/api/intelligence/summary?refresh=true' : '/api/intelligence/summary';
      const [summaryBody, signalsBody] = await Promise.all([
        apiFetch(summaryPath, { timeoutMs: 45000 }),
        apiFetch('/api/intelligence/signals', { timeoutMs: 20000 }),
      ]);
      if (!summaryBody.success) throw new Error(summaryBody.error?.message || 'Failed to load intelligence');
      const summaryData = summaryBody.data?.summary || null;
      setSummary(summaryData);
      setMeta({
        whale_count: summaryBody.data?.whale_count || 0,
        copy_trader_count: summaryBody.data?.copy_trader_count || 0,
      });
      if (signalsBody.success) {
        setWhaleSignals(signalsBody.data?.whale_signals || []);
        setCopySignals(signalsBody.data?.copy_trader_signals || []);
      }
      // Log signal to Supabase for accuracy tracking (fire-and-forget, de-duplicated)
      if (summaryData?.signal && supabase) {
        const triggerAddr = signalsBody.data?.whale_signals?.[0]?.wallet_address || null;
        (async () => {
          try {
            // Skip if an identical signal (same type + trigger) was logged within the last hour.
            const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
            let dupQuery = supabase
              .from('signals')
              .select('id')
              .eq('signal_type', summaryData.signal)
              .gte('created_at', oneHourAgo)
              .limit(1);
            dupQuery = triggerAddr
              ? dupQuery.eq('whale_trigger_address', triggerAddr)
              : dupQuery.is('whale_trigger_address', null);
            const { data: existing } = await dupQuery;
            if (existing && existing.length > 0) return;

            const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const priceData = await priceRes.json().catch(() => null);
            await supabase.from('signals').insert({
              signal_type: summaryData.signal,
              reasoning: summaryData.summary || summaryData.reasoning || '',
              eth_price_at_signal: priceData?.ethereum?.usd || null,
              whale_trigger_address: triggerAddr,
              outcome_24h: 'PENDING',
              outcome_48h: 'PENDING',
              outcome_7d: 'PENDING',
            });
          } catch { /* non-critical telemetry */ }
        })();
      }
    } catch (err) {
      setError(err.message);
      // Clear stale data so the error state isn't shown over outdated signals.
      setSummary(null);
      setWhaleSignals([]);
      setCopySignals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const regenerate = () => load(true);
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

  const allSignals = [...whaleSignals, ...copySignals];
  const bullishCount = allSignals.filter((s) => s.signal === 'BULLISH').length;
  const bearishCount = allSignals.filter((s) => s.signal === 'BEARISH').length;
  const neutralCount = allSignals.filter((s) => s.signal === 'NEUTRAL').length;
  const flowState = bullishCount > bearishCount ? 'ACCUMULATION' : bearishCount > bullishCount ? 'DISTRIBUTION' : 'NEUTRAL';
  const dominantSignal = bullishCount >= bearishCount && bullishCount >= neutralCount ? 'BULLISH'
    : bearishCount >= neutralCount ? 'BEARISH' : 'NEUTRAL';

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    {/* Top stats strip */}
    <div className="border-b border-border-subtle py-3 px-5 flex items-center gap-6 bg-bg-surface flex-wrap">
      {[
        { label: 'Whales Tracked', value: meta.whale_count, color: 'text-blue' },
        { label: 'Copy Traders', value: meta.copy_trader_count, color: 'text-green' },
        { label: 'Bullish', value: bullishCount, color: 'text-green' },
        { label: 'Bearish', value: bearishCount, color: 'text-red' },
        { label: 'Neutral', value: neutralCount, color: 'text-amber' },
      ].map(({ label, value, color }, i, arr) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted">{label}</span>
          <span className={`text-[12px] font-mono font-medium ${color}`}>{value}</span>
          {i < arr.length - 1 && <span className="text-text-muted ml-3">·</span>}
        </div>
      ))}
    </div>
    <div className="max-w-4xl mx-auto px-4 md:px-5 py-6 flex flex-col gap-5">
      {error ? (
        <div className="bg-bg-card border border-red-border rounded-xl p-4 text-red text-[13px]">
          {error}
        </div>
      ) : null}

      {/* Signal Accuracy Widget — top of page */}
      <SignalAccuracyWidget />

      <TrustPulse variant="full" />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <TextureCard>
          <TextureCardContent className="p-5 relative">
            <div className="absolute w-[2px] left-0 top-4 bottom-4 bg-green rounded-r-full" />
            <div className="flex items-center">
              <span className="text-[10px] uppercase tracking-[1px] text-text-muted">Market signal</span>
              <div className="ml-auto">
                <SignalPill signal={summary?.top_signal || 'NEUTRAL'} />
              </div>
            </div>
            <h2 className="font-display text-[17px] font-bold text-text-primary leading-[1.4] mt-2">
              {summary?.headline || (
                <>
                  Ethereum smart money remains{' '}
                  <TextShimmer>selectively constructive</TextShimmer>.
                </>
              )}
            </h2>
            <div className="text-[10px] text-text-muted mt-3 text-right">
              Generated {summary?.generated_at ? new Date(summary.generated_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
            </div>
          </TextureCardContent>
        </TextureCard>
      </motion.section>

      <section className="grid grid-cols-2 gap-3">
        <TextureCard>
          <TextureCardContent className="p-4">
            <div className="flex items-center gap-2">
              <ChainBadge chain="ethereum" />
              <span className="text-[11px] uppercase tracking-[1px] text-text-muted">Ethereum</span>
            </div>
            <p className="text-[13px] text-text-secondary leading-[1.6] mt-2">
              {summary?.ethereum_outlook || 'AI outlook not available yet.'}
            </p>
          </TextureCardContent>
        </TextureCard>
        <TextureCard>
          <TextureCardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ChainBadge chain="ethereum" />
              <span className="text-[11px] uppercase tracking-[1px] text-text-muted">Flow state</span>
            </div>
            <p className={`text-[18px] font-bold font-display mt-1 ${flowState === 'ACCUMULATION' ? 'text-green' : flowState === 'DISTRIBUTION' ? 'text-red' : 'text-amber'}`}>
              {flowState}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Dominant: <span className={dominantSignal === 'BULLISH' ? 'text-green' : dominantSignal === 'BEARISH' ? 'text-red' : 'text-amber'}>{dominantSignal}</span>
            </p>
            {allSignals.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-bg-elevated">
                  {bullishCount > 0 && <div className="bg-green" style={{ width: `${(bullishCount / allSignals.length) * 100}%` }} />}
                  {neutralCount > 0 && <div className="bg-amber" style={{ width: `${(neutralCount / allSignals.length) * 100}%` }} />}
                  {bearishCount > 0 && <div className="bg-red" style={{ width: `${(bearishCount / allSignals.length) * 100}%` }} />}
                </div>
                <div className="text-[10px] text-text-muted font-mono">
                  {whaleSignals.length} whale{whaleSignals.length !== 1 ? 's' : ''} · {copySignals.length} copy traders
                </div>
              </div>
            )}
          </TextureCardContent>
        </TextureCard>
      </section>

      <section>
        <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-2">Key themes</div>
        <div className="flex flex-wrap gap-2">
          {(summary?.key_themes || ['Smart money', 'Spot accumulation', 'High conviction']).map((theme) => {
            const display = theme.length > 35 ? theme.slice(0, 35) + '...' : theme;
            return (
              <span key={theme} title={theme} className="text-[11px] bg-bg-elevated border border-border-default rounded-full px-3 py-1 text-text-secondary whitespace-nowrap">
                {display}
              </span>
            );
          })}
        </div>
      </section>

      <SignalFeed whaleSignals={whaleSignals} copySignals={copySignals} isPro={isPro} isTrialing={isTrialing} />
    </div>
    </div>
  );
}
