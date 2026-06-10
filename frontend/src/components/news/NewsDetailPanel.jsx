import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, X } from 'lucide-react';
import { api } from '../../lib/api';

function relTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Section({ title, children }) {
  return (
    <div className="px-5 py-4 border-b border-border-subtle">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2.5">{title}</div>
      {children}
    </div>
  );
}

export default function NewsDetailPanel({ article, onClose }) {
  // Enriched data (AI deep-dive + wallet reactions) loads lazily for top stories.
  const [enriched, setEnriched] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    setEnriched(null);
    if (!article?.id) return;
    let cancelled = false;
    setLoadingAi(true);
    api.getNewsArticle(article.id)
      .then((d) => { if (!cancelled) setEnriched(d?.article || d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingAi(false); });
    return () => { cancelled = true; };
  }, [article?.id]);

  if (!article) return null;
  const a = { ...article, ...(enriched || {}) };
  const bull = a.bull_score ?? 50;
  const bear = a.bear_score ?? 50;
  const reactions = a.wallet_reactions || [];

  return (
    <aside className="w-full h-full min-h-0 bg-bg-surface flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle relative">
        <div className="flex items-center gap-2 text-[11px] text-text-muted pr-8">
          <span className="font-medium text-text-secondary">{a.source}</span>
          <span>· {relTime(a.published_at)}</span>
          <span className="text-[9px] uppercase tracking-wide bg-bg-elevated border border-border-subtle rounded px-1.5 py-0.5">{a.category}</span>
        </div>
        <h2 className="font-display text-[16px] font-bold text-text-primary leading-snug mt-2 pr-8">{a.title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-text-muted hover:text-text-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Bull vs Bear meter */}
        <Section title="Bull vs Bear">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-bg-elevated">
            <div className="bg-green" style={{ width: `${bull}%` }} />
            <div className="bg-red" style={{ width: `${bear}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] font-mono">
            <span className="text-green">{bull}% Bull</span>
            <span className="text-text-muted">{a.sentiment}</span>
            <span className="text-red">{bear}% Bear</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
              <div className="text-[9px] uppercase text-text-muted">Market Impact</div>
              <div className="font-mono font-bold text-[16px] text-text-primary">{a.market_impact ?? a.importance_score}<span className="text-[11px] text-text-muted">/100</span></div>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
              <div className="text-[9px] uppercase text-text-muted">ETH Relevance</div>
              <div className="font-mono font-bold text-[16px] text-blue">{a.ethereum_relevance ?? 0}<span className="text-[11px] text-text-muted">/100</span></div>
            </div>
          </div>
        </Section>

        {/* AI Summary */}
        {(a.ai_summary || a.summary) && (
          <Section title={a.ai_summary ? 'AI Summary' : 'Summary'}>
            <p className="text-[13px] text-text-secondary leading-relaxed">{a.ai_summary || a.summary}</p>
          </Section>
        )}

        {/* Bull / Bear thesis (AI, when available) */}
        {(a.bull_thesis || a.bear_thesis) ? (
          <>
            {a.bull_thesis && (
              <Section title="Bull Case">
                <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">{a.bull_thesis}</p>
              </Section>
            )}
            {a.bear_thesis && (
              <Section title="Bear Case">
                <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">{a.bear_thesis}</p>
              </Section>
            )}
          </>
        ) : loadingAi ? (
          <Section title="AI Analysis">
            <p className="text-[12px] text-text-muted">Loading deep-dive…</p>
          </Section>
        ) : (
          <Section title="AI Analysis">
            <p className="text-[12px] text-text-muted leading-relaxed">
              Full bull/bear deep-dive runs on the highest-impact stories. This one is scored heuristically.
            </p>
          </Section>
        )}

        {/* Wallet reactions */}
        {reactions.length > 0 && (
          <Section title="Wallet Reactions">
            <div className="flex flex-col gap-2">
              {reactions.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.side === 'buy' ? 'bg-green' : r.side === 'sell' ? 'bg-red' : 'bg-amber'}`} />
                  <span className="text-text-secondary font-medium truncate">{r.label}</span>
                  <span className="text-text-muted">{r.action}</span>
                  <span className="ml-auto font-mono text-text-primary">{r.amount}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Affected assets */}
        {((a.affected_tokens || []).length > 0 || (a.affected_protocols || []).length > 0) && (
          <Section title="Affected Assets">
            <div className="flex flex-wrap gap-1.5">
              {(a.affected_tokens || []).map((t) => (
                <span key={t} className="text-[11px] font-mono text-green bg-green/10 border border-green/20 rounded px-1.5 py-0.5">${t}</span>
              ))}
              {(a.affected_protocols || []).map((p) => (
                <span key={p} className="text-[11px] text-text-secondary bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5">{p}</span>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Footer link */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-border-subtle">
        <a href={a.url} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-border-default bg-bg-elevated py-2.5 text-[13px] font-medium text-text-primary hover:border-border-strong transition-colors">
          Read full article <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}
