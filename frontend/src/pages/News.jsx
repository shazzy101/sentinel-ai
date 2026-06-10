import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import NewsDetailPanel from '../components/news/NewsDetailPanel';

const CATEGORIES = [
  'All News', 'Ethereum', 'Layer 2', 'DeFi', 'Stablecoins', 'Institutional',
  'Regulation', 'Whale Activity', 'NFT', 'AI', 'Macro', 'Exchange News',
];

/* ── helpers ─────────────────────────────────────────── */
function relTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function sentimentMeta(s) {
  if (s === 'Strongly Bullish') return { color: 'text-green', bg: 'bg-green/15 border-green/30', dot: 'bg-green', bar: 'bg-green' };
  if (s === 'Bullish') return { color: 'text-green', bg: 'bg-green/10 border-green/20', dot: 'bg-green', bar: 'bg-green' };
  if (s === 'Strongly Bearish') return { color: 'text-red', bg: 'bg-red/15 border-red/30', dot: 'bg-red', bar: 'bg-red' };
  if (s === 'Bearish') return { color: 'text-red', bg: 'bg-red/10 border-red/20', dot: 'bg-red', bar: 'bg-red' };
  return { color: 'text-amber', bg: 'bg-amber/10 border-amber/20', dot: 'bg-amber', bar: 'bg-amber' };
}

function SentimentPill({ s }) {
  const m = sentimentMeta(s);
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${m.bg} ${m.color}`}>
      <span className={`w-1 h-1 rounded-full ${m.dot}`} />
      {s}
    </span>
  );
}

/* ── Market Pulse strip ──────────────────────────────── */
function MarketPulse({ pulse }) {
  const meter = pulse?.sentiment_meter ?? 50;
  const greedLabel = meter >= 75 ? 'Extreme Greed' : meter >= 58 ? 'Greed' : meter >= 43 ? 'Neutral' : meter >= 25 ? 'Fear' : 'Extreme Fear';
  const meterColor = meter >= 58 ? 'text-green' : meter <= 42 ? 'text-red' : 'text-amber';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
      {/* Sentiment meter */}
      <div className="glass-surface rounded-2xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-[1.5px] text-text-muted">Market Sentiment</span>
          <span className={`text-[13px] font-bold ${meterColor}`}>{greedLabel} · {meter}</span>
        </div>
        <div className="relative h-2.5 rounded-full overflow-hidden bg-bg-elevated">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,#FF4D4D 0%,#F59E0B 50%,#00D992 100%)', opacity: 0.85 }} />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white border-2 border-bg-base shadow-lg"
            initial={{ left: '50%' }}
            animate={{ left: `calc(${meter}% - 8px)` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] uppercase tracking-wider text-text-muted">
          <span>Extreme Fear</span><span>Neutral</span><span>Extreme Greed</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: 'Bullish', value: pulse?.bullish ?? 0, color: 'text-green' },
            { label: 'Neutral', value: pulse?.neutral ?? 0, color: 'text-amber' },
            { label: 'Bearish', value: pulse?.bearish ?? 0, color: 'text-red' },
          ].map((t) => (
            <div key={t.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">{t.label}</div>
              <div className={`font-mono font-bold text-[18px] ${t.color}`}>{t.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ETH + narrative */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
        <div className="glass-surface rounded-2xl p-4 shadow-card">
          <div className="text-[10px] uppercase tracking-[1.5px] text-text-muted mb-1">ETH Sentiment</div>
          {pulse?.eth_sentiment != null ? (
            <>
              <div className={`font-mono font-bold text-[22px] ${pulse.eth_sentiment >= 55 ? 'text-green' : pulse.eth_sentiment <= 45 ? 'text-red' : 'text-amber'}`}>
                {pulse.eth_sentiment}<span className="text-[12px] text-text-muted">/100</span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">{pulse.eth_relevant_count} ETH-relevant stories</div>
            </>
          ) : <div className="text-[13px] text-text-muted mt-1">No ETH stories yet</div>}
        </div>
        <div className="glass-surface rounded-2xl p-4 shadow-card">
          <div className="text-[10px] uppercase tracking-[1.5px] text-text-muted mb-1">Top Narrative</div>
          {pulse?.top_token && (
            <span className="inline-block text-[12px] font-mono font-bold text-green bg-green/10 border border-green/20 rounded px-1.5 py-0.5 mb-1">${pulse.top_token}</span>
          )}
          <p className="text-[12px] text-text-secondary leading-snug line-clamp-2">{pulse?.top_headline || '—'}</p>
        </div>
      </div>
    </div>
  );
}

/* ── News card ───────────────────────────────────────── */
function NewsCard({ a, onOpen, i }) {
  const m = sentimentMeta(a.sentiment);
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(a)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(i * 0.015, 0.3) }}
      className="group w-full text-left bg-bg-surface border border-border-default rounded-xl p-4 hover:border-border-strong hover:bg-bg-elevated transition-colors relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${m.bar}`} />
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[11px] font-medium text-text-secondary">{a.source}</span>
        <span className="text-text-muted text-[10px]">· {relTime(a.published_at)}</span>
        <span className="text-[9px] uppercase tracking-wide text-text-muted bg-bg-elevated border border-border-subtle rounded px-1.5 py-0.5">{a.category}</span>
        {a.ethereum_relevance >= 40 && (
          <span className="text-[9px] uppercase tracking-wide text-blue bg-blue/10 border border-blue/20 rounded px-1.5 py-0.5">ETH {a.ethereum_relevance}</span>
        )}
        <span className="ml-auto"><SentimentPill s={a.sentiment} /></span>
      </div>
      <h3 className="text-[14px] font-semibold text-text-primary leading-snug group-hover:text-white transition-colors">{a.title}</h3>
      {a.summary && <p className="text-[12px] text-text-muted mt-1.5 leading-relaxed line-clamp-2">{a.summary}</p>}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* impact bar */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase text-text-muted">Impact</span>
          <div className="w-16 h-1 rounded-full bg-bg-elevated overflow-hidden">
            <div className={`h-full ${a.importance_score >= 65 ? 'bg-green' : a.importance_score >= 40 ? 'bg-amber' : 'bg-text-muted'}`} style={{ width: `${a.importance_score}%` }} />
          </div>
          <span className="text-[10px] font-mono text-text-secondary">{a.importance_score}</span>
        </div>
        {(a.affected_tokens || []).slice(0, 4).map((t) => (
          <span key={t} className="text-[10px] font-mono text-text-secondary bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5">${t}</span>
        ))}
      </div>
    </motion.button>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-bg-surface border border-border-default rounded-xl p-4">
          <div className="skeleton h-3 w-32 rounded mb-3" />
          <div className="skeleton h-4 w-3/4 rounded mb-2" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function NewsPage() {
  const [pulse, setPulse] = useState(null);
  const [articles, setArticles] = useState([]);
  const [category, setCategory] = useState('All News');
  const [sort, setSort] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { document.title = 'News Intelligence — Sentinel AI'; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, a] = await Promise.all([
      api.getNewsPulse().catch(() => ({ available: false })),
      api.getNews({ category: category === 'All News' ? undefined : category, sort, limit: 50 }).catch(() => []),
    ]);
    setPulse(p?.available ? p : null);
    setArticles(a || []);
    setLoading(false);
  }, [category, sort]);

  useEffect(() => { load(); }, [load]);

  // Background refresh every 3 min
  useEffect(() => {
    const iv = setInterval(load, 180000);
    return () => clearInterval(iv);
  }, [load]);

  const insights = useMemo(() => {
    if (!articles.length) return [];
    const out = [];
    const strongBull = articles.filter((a) => a.sentiment === 'Strongly Bullish');
    const strongBear = articles.filter((a) => a.sentiment === 'Strongly Bearish');
    const ethBull = articles.filter((a) => a.ethereum_relevance >= 40 && a.bull_score >= 60);
    if (ethBull.length >= 2) out.push({ tone: 'bull', text: `${ethBull.length} Ethereum stories skewing bullish right now — narrative momentum building.` });
    if (strongBull.length && strongBear.length) out.push({ tone: 'neutral', text: `Split tape: ${strongBull.length} strongly-bullish vs ${strongBear.length} strongly-bearish headlines. Conviction is divided.` });
    const top = articles.slice().sort((a, b) => b.importance_score - a.importance_score)[0];
    if (top) out.push({ tone: top.bull_score >= 55 ? 'bull' : top.bear_score >= 55 ? 'bear' : 'neutral', text: `Highest-impact story: "${top.title.slice(0, 70)}…"` });
    return out.slice(0, 3);
  }, [articles]);

  return (
    <div className="h-full min-h-0 flex overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 py-5 flex flex-col gap-5">
          {/* Market Pulse */}
          {pulse ? <MarketPulse pulse={pulse} /> : (
            <div className="glass-surface rounded-2xl p-5 text-[13px] text-text-muted">
              {loading ? 'Loading market pulse…' : 'No news yet — the feed populates automatically every 30 minutes.'}
            </div>
          )}

          {/* AI insight cards (derived, zero-cost) */}
          {insights.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {insights.map((ins, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border p-3.5 text-[12px] leading-relaxed ${
                    ins.tone === 'bull' ? 'border-green/20 bg-green/[0.04] text-text-secondary'
                    : ins.tone === 'bear' ? 'border-red/20 bg-red/[0.04] text-text-secondary'
                    : 'border-border-default bg-bg-surface text-text-secondary'
                  }`}>
                  <div className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">◈ Sentinel Insight</div>
                  {ins.text}
                </motion.div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap sticky top-0 z-10 py-1">
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors select-none ${
                    category === c ? 'bg-bg-elevated border-border-strong text-text-primary' : 'bg-transparent border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-bg-elevated border border-border-subtle rounded-lg p-0.5">
              {[['recent', 'Latest'], ['importance', 'Top Impact']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setSort(k)}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${sort === k ? 'bg-bg-surface text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Feed */}
          {loading ? <FeedSkeleton /> : articles.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-text-muted border border-border-subtle rounded-xl">
              No articles in this category yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-6">
              {articles.map((a, i) => <NewsCard key={a.id} a={a} i={i} onOpen={setSelected} />)}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className={`flex-shrink-0 h-full transition-all duration-200 ease-out ${selected ? 'w-[440px]' : 'w-0'} overflow-hidden border-l border-border-subtle`}>
        {selected && <NewsDetailPanel article={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
