import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, ExternalLink, TrendingUp } from 'lucide-react';
import GlassCard from '../primitives/GlassCard';
import { api } from '../../lib/api';
import { shortAddress, traderDisplayName } from '../../lib/ens';

function compact(n) {
  const x = Number(n ?? 0);
  if (x >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  if (x >= 1e3) return `$${(x / 1e3).toFixed(1)}K`;
  return `$${x.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function relTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTION_LABEL = {
  buy: { text: 'Accumulating', className: 'text-green bg-green/10 border-green/20' },
  take_profit: { text: 'Taking profit', className: 'text-amber bg-amber/10 border-amber/20' },
  rotate: { text: 'Rotating', className: 'text-blue bg-blue/10 border-blue/20' },
};

function MoveRow({ move, onCopy }) {
  const action = ACTION_LABEL[move.action] || ACTION_LABEL.rotate;
  const name = traderDisplayName({ address: move.trader_address, label: move.trader_label });

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-[13px] font-medium text-text-primary truncate">{name}</span>
          <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-semibold ${action.className}`}>
            {action.text}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
          <span className="text-text-muted">{move.sold}</span>
          <ArrowRight className="h-3 w-3 text-text-muted shrink-0" />
          <span className="font-medium text-text-primary">{move.bought}</span>
          <span className="text-text-muted">·</span>
          <span className="font-mono text-text-secondary">{compact(move.amount_usd)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 mt-1 text-[10px] text-text-muted">
          <span className="font-mono">{Math.round(move.win_rate_pct ?? 0)}% WR</span>
          <span>·</span>
          <span className="font-mono">PF {Number(move.profit_factor ?? 0).toFixed(1)}</span>
          <span>·</span>
          <span>Score {Math.round(move.copy_score ?? 0)}</span>
          <span>·</span>
          <span>{move.project}</span>
          <span>·</span>
          <span>{relTime(move.time)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onCopy(move)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-green/15 text-green border border-green/25 hover:bg-green/25 transition-colors"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
        <a
          href={`https://etherscan.io/tx/${move.tx_hash}`}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          aria-label="View on Etherscan"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function WatchlistMoveRow({ tx }) {
  return (
    <a
      href={`https://etherscan.io/tx/${tx.hash}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${tx.direction === 'in' ? 'bg-green' : 'bg-red'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text-primary">
          <span className="font-medium">{tx.wallet_label || shortAddress(tx.wallet_address)}</span>
          <span className="text-text-muted mx-1.5">·</span>
          <span className={tx.direction === 'in' ? 'text-green' : 'text-red'}>
            {tx.direction === 'in' ? 'Received' : 'Sent'} {Number(tx.value || 0).toFixed(3)} {tx.value_symbol || 'ETH'}
          </span>
        </div>
        <div className="text-[10px] text-text-muted mt-0.5">
          Your watchlist · Score {tx.wallet_score ?? '—'} · {relTime(tx.timestamp)}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0" />
    </a>
  );
}

function TopCopyTraderRow({ wallet, lastMove, onTrack }) {
  const m = wallet.metrics || {};
  const name = traderDisplayName(wallet);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/40 transition-colors">
      <span className="w-6 text-[11px] font-mono text-text-muted shrink-0">#{wallet.rank}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-text-primary truncate">{name}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-text-muted mt-0.5">
          <span className="font-mono text-green">{m.win_rate_pct ?? '—'}% WR</span>
          <span>·</span>
          <span className="font-mono">PF {m.profit_factor != null ? Number(m.profit_factor).toFixed(1) : '—'}</span>
          <span>·</span>
          <span>{m.track_record_days ?? '—'}d track</span>
          {lastMove && (
            <>
              <span>·</span>
              <span className="text-text-secondary">
                Last: {lastMove.sold} → {lastMove.bought}
              </span>
            </>
          )}
        </div>
      </div>
      <span className="font-mono text-[14px] font-bold text-green shrink-0 w-10 text-right">
        {Math.round(wallet.copy_trading_score ?? 0)}
      </span>
      <button
        type="button"
        onClick={() => onTrack(wallet)}
        className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-green/15 text-green border border-green/25 hover:bg-green/25 transition-colors"
      >
        Track
      </button>
    </div>
  );
}

export default function CopyTradingIntelligence() {
  const navigate = useNavigate();
  const [topWallets, setTopWallets] = useState([]);
  const [watchlistTxs, setWatchlistTxs] = useState([]);
  const [copyMoves, setCopyMoves] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getCopyTradingTop({ limit: 8, sort: 'copy_score' }),
      api.getLatestTransactions(8),
      api.getCopyRecentMoves(12),
    ]).then(([copyData, txs, moves]) => {
      if (cancelled) return;
      setTopWallets(copyData.wallets || []);
      setWatchlistTxs(txs);
      setCopyMoves(moves);
      setLoaded(true);
    }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const lastMoveByTrader = useMemo(() => {
    const map = {};
    for (const m of copyMoves) {
      const addr = (m.trader_address || '').toLowerCase();
      if (!map[addr]) map[addr] = m;
    }
    return map;
  }, [copyMoves]);

  const handleTrack = (walletOrMove) => {
    const addr = walletOrMove.address || walletOrMove.trader_address;
    if (addr) navigate(`/watchlist?tab=copy&add=${addr}`);
  };

  const handleCopyMove = (move) => {
    const bought = move.bought === 'WETH' ? 'ETH' : move.bought;
    const from = ['USDC', 'USDT', 'DAI'].includes(move.sold) ? move.sold : 'USDC';
    navigate(`/invest?from=${from}&to=${bought}`);
  };

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-border-default bg-bg-surface/40 px-5 py-8 text-center text-[13px] text-text-muted">
        Loading copy-trading feed…
      </div>
    );
  }

  const hasWatchlistActivity = watchlistTxs.length > 0;
  const hasCopyActivity = copyMoves.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-green" />
          <h2 className="font-display text-[16px] font-semibold text-text-primary">Copy Trading</h2>
        </div>
        <p className="text-[12px] text-text-muted max-w-2xl">
          Live DEX moves from ranked traders with 60%+ win rate and 2.0+ profit factor — filtered to liquid tokens worth copying.
        </p>
      </div>

      {/* Primary feed — copy-worthy moves */}
      <GlassCard padding={false}>
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-medium text-text-primary">Copy-Worthy Moves</div>
            <div className="text-[10px] text-text-muted mt-0.5">Ranked traders · Dune DEX · $250k+ swaps</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/watchlist?tab=copy')}
            className="text-[11px] text-green hover:underline shrink-0"
          >
            All copy traders →
          </button>
        </div>
        {!hasCopyActivity ? (
          <div className="px-4 py-10 text-center text-[12px] text-text-muted leading-relaxed">
            No recent moves from top copy traders into major tokens yet. Check back shortly — Dune refreshes every few hours.
          </div>
        ) : (
          copyMoves.map((m) => (
            <MoveRow key={m.tx_hash} move={m} onCopy={handleCopyMove} />
          ))
        )}
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Top copy traders — compact list */}
        <GlassCard padding={false}>
          <div className="px-4 py-3 border-b border-border-subtle">
            <div className="text-[14px] font-medium text-text-primary">Top Copy Traders</div>
            <div className="text-[10px] text-text-muted mt-0.5">Real DEX accounts · ranked by Hadaleum score</div>
          </div>
          {topWallets.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-text-muted">No copy traders loaded.</div>
          ) : (
            topWallets.map((w) => (
              <TopCopyTraderRow
                key={w.address}
                wallet={w}
                lastMove={lastMoveByTrader[(w.address || '').toLowerCase()]}
                onTrack={handleTrack}
              />
            ))
          )}
        </GlassCard>

        {/* Watchlist moves — secondary, only if user has tracked wallets */}
        <GlassCard padding={false}>
          <div className="px-4 py-3 border-b border-border-subtle">
            <div className="text-[14px] font-medium text-text-primary">Your Watchlist Moves</div>
            <div className="text-[10px] text-text-muted mt-0.5">
              {hasWatchlistActivity ? 'Wallets you track · on-chain' : 'Track traders to see their moves here'}
            </div>
          </div>
          {!hasWatchlistActivity ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[12px] text-text-muted mb-3 leading-relaxed">
                No watchlist activity yet. Track a copy trader above — we scan their wallet and show moves here.
              </p>
              <button
                type="button"
                onClick={() => navigate('/watchlist?tab=copy')}
                className="text-[11px] text-green font-medium hover:underline"
              >
                Browse copy traders →
              </button>
            </div>
          ) : (
            watchlistTxs.map((tx) => <WatchlistMoveRow key={tx.hash} tx={tx} />)
          )}
        </GlassCard>
      </div>
    </div>
  );
}
