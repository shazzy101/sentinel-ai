import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { ChainBadge, GradeBadge, SignalPill } from '../components/ui/Badge';
import ScoreRing from '../components/ui/ScoreRing';
import PremiumStatCard from '../components/ui/premium-stat-card';
import { TextureCard, TextureCardContent } from '../components/ui/texture-card';
import TextShimmer from '../components/ui/text-shimmer';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

function SignalRow({ item }) {
  const score = Number(item.score ?? 0);
  const grade = gradeFromScore(score);
  const addr = item.wallet_address
    ? `${item.wallet_address.slice(0, 6)}…${item.wallet_address.slice(-4)}`
    : '';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-subtle last:border-0">
      <ScoreRing score={score} size={38} strokeWidth={3} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-text-primary truncate">
            {item.wallet_label || 'Unknown wallet'}
          </span>
          <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${gradeColor(grade)}`}>
            {grade}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-text-muted">{addr}</span>
          {item.generated_at && (
            <span className="text-[10px] text-text-muted">{relativeTime(item.generated_at)}</span>
          )}
        </div>
        {item.signal_reason && (
          <p className="text-[12px] text-text-secondary mt-1 leading-relaxed line-clamp-2">
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
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = 'Intelligence — Sentinel AI';
  }, []);

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

  const bullishCount = signals.filter((s) => s.signal === 'BULLISH').length;
  const bearishCount = signals.filter((s) => s.signal === 'BEARISH').length;
  const neutralCount = signals.filter((s) => s.signal === 'NEUTRAL').length;
  const flowState = bullishCount > bearishCount ? 'ACCUMULATION' : bearishCount > bullishCount ? 'DISTRIBUTION' : 'NEUTRAL';
  const dominantSignal = bullishCount >= bearishCount && bullishCount >= neutralCount ? 'BULLISH'
    : bearishCount >= neutralCount ? 'BEARISH' : 'NEUTRAL';

  return (
    <div className="h-full min-h-0 overflow-y-auto">
    {/* Top stats strip */}
    <div className="border-b border-border-subtle py-3 px-5 flex items-center gap-6 bg-bg-surface flex-wrap">
      {[
        { label: 'Total Analyzed', value: signals.length || 0, color: 'text-text-primary' },
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
    <div className="max-w-3xl mx-auto px-5 py-6 flex flex-col gap-5">
      {error ? (
        <div className="bg-bg-card border border-red-border rounded-xl p-4 text-red text-[13px]">
          {error}
        </div>
      ) : null}

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
              Generated {new Date().toLocaleTimeString()}
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
            {signals.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {/* Signal breakdown bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden bg-bg-elevated">
                  {bullishCount > 0 && <div className="bg-green" style={{ width: `${(bullishCount / signals.length) * 100}%` }} />}
                  {neutralCount > 0 && <div className="bg-amber" style={{ width: `${(neutralCount / signals.length) * 100}%` }} />}
                  {bearishCount > 0 && <div className="bg-red" style={{ width: `${(bearishCount / signals.length) * 100}%` }} />}
                </div>
                <div className="text-[10px] text-text-muted font-mono">
                  {signals.length} wallet{signals.length !== 1 ? 's' : ''} analyzed
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

      <TextureCard className="overflow-hidden">
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
      </TextureCard>

      {/* Ask AI shortcut */}
      <div className="bg-bg-surface border border-green/20 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px] text-text-primary font-medium">Have a question about today's signals?</p>
          <p className="text-[13px] text-text-muted mt-1">Ask Sentinel AI for a deeper analysis.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/ask')}>
          Ask Sentinel →
        </Button>
      </div>
    </div>
    </div>
  );
}
