import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, TrendingUp, Users } from 'lucide-react';
import GlassCard from '../primitives/GlassCard';
import StatWidget from '../primitives/StatWidget';
import { BentoGrid, BentoItem } from '../primitives/BentoGrid';
import { api } from '../../lib/api';

const TOP_STATS = [
  { key: 'win_rate_pct', label: 'Win Rate', fmt: (v) => `${v}%`, suffix: 'of trades profitable' },
  { key: 'profit_factor', label: 'Profit Factor', fmt: (v) => v?.toFixed(1) ?? '—', suffix: 'gains vs losses' },
  { key: 'trades_per_day', label: 'Trades/Day', fmt: (v) => v?.toFixed(1) ?? '—', suffix: 'active frequency' },
  { key: 'copy_trading_score', label: 'Copy Score', fmt: (v) => v?.toFixed(0) ?? '—', suffix: 'Sentinel rank' },
  { key: 'track_record_days', label: 'Track Record', fmt: (v) => `${v}d`, suffix: 'verified history' },
];

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

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

function CopyWalletCard({ wallet, onTrack }) {
  const m = wallet.metrics || {};
  const oc = wallet.on_chain_data || {};
  const stats = {
    win_rate_pct: m.win_rate_pct,
    profit_factor: m.profit_factor,
    trades_per_day: oc.trades_per_day,
    copy_trading_score: wallet.copy_trading_score,
    track_record_days: m.track_record_days,
  };

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-green bg-green/10 px-1.5 py-0.5 rounded">#{wallet.rank}</span>
            <span className="text-[13px] font-semibold text-text-primary truncate">
              {wallet.label || `DEX Trader ${wallet.rank}`}
            </span>
          </div>
          <a
            href={`https://etherscan.io/address/${wallet.address}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-mono text-text-muted hover:text-blue mt-0.5 inline-flex items-center gap-1"
          >
            {shortAddr(wallet.address)} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <button
          type="button"
          onClick={() => onTrack(wallet)}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-green/15 text-green border border-green/25 hover:bg-green/25 transition-colors"
        >
          <Copy className="h-3 w-3" /> Track
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {TOP_STATS.map(({ key, label, fmt }) => (
          <div key={key} className="text-center">
            <div className="text-[9px] uppercase tracking-widest text-text-muted mb-0.5">{label}</div>
            <div className="font-mono text-[13px] font-bold text-text-primary">{fmt(stats[key])}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border-subtle text-[10px] text-text-muted">
        <span>{oc.total_trades?.toLocaleString() ?? '—'} trades</span>
        <span>·</span>
        <span>{compact(oc.total_volume_usd)} volume</span>
        <span>·</span>
        <span>{oc.tokens_traded ?? '—'} tokens</span>
      </div>
    </div>
  );
}

function LatestTxFeed({ transactions }) {
  return (
    <GlassCard padding={false} className="h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[14px] font-medium text-text-primary">Latest Watchlist Moves</span>
        <span className="text-[10px] text-text-muted">Tracked wallets · live</span>
      </div>
      {transactions.length === 0 ? (
        <div className="py-10 text-center text-[12px] text-text-muted">No transactions yet — scan wallets on Watchlist.</div>
      ) : transactions.map((tx) => (
        <a
          key={tx.hash}
          href={`https://etherscan.io/tx/${tx.hash}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
        >
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.direction === 'in' ? 'bg-green' : 'bg-red'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-text-primary truncate">
              {tx.wallet_label || shortAddr(tx.wallet_address)}
              <span className="text-text-muted font-normal mx-1">·</span>
              <span className={tx.direction === 'in' ? 'text-green' : 'text-red'}>
                {tx.direction === 'in' ? 'Received' : 'Sent'} {Number(tx.value || 0).toFixed(2)} {tx.value_symbol || 'ETH'}
              </span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Score {tx.wallet_score ?? '—'} · {relTime(tx.timestamp)}
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0" />
        </a>
      ))}
    </GlassCard>
  );
}

function ChainTradesFeed({ trades }) {
  return (
    <GlassCard padding={false} className="h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[14px] font-medium text-text-primary">Top Ethereum Chain Trades</span>
        <span className="text-[10px] text-text-muted">DEX &gt; $250k · Dune</span>
      </div>
      {trades.length === 0 ? (
        <div className="py-10 text-center text-[12px] text-text-muted">Refreshing chain data from Dune…</div>
      ) : trades.slice(0, 8).map((t, i) => (
        <a
          key={`${t.tx_hash}-${i}`}
          href={`https://etherscan.io/tx/${t.tx_hash}`}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors ${
            t.is_tracked ? 'border-l-2 border-l-green bg-green/[0.03]' : ''
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-text-primary">
              <span className="text-red">{t.sold}</span>
              <span className="text-text-muted mx-1">→</span>
              <span className="text-green">{t.bought}</span>
              <span className="text-text-muted font-normal ml-2">{compact(t.amount_usd)}</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              {shortAddr(t.trader)} · {t.project} · {relTime(t.time)}
              {t.is_tracked && <span className="text-green ml-1">· Tracked</span>}
            </div>
          </div>
        </a>
      ))}
    </GlassCard>
  );
}

export default function CopyTradingIntelligence() {
  const navigate = useNavigate();
  const [topWallets, setTopWallets] = useState([]);
  const [latestTxs, setLatestTxs] = useState([]);
  const [chainTrades, setChainTrades] = useState([]);
  const [aggregate, setAggregate] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getCopyTradingTop(5),
      api.getLatestTransactions(12),
      api.getNetworkLargeTrades(),
    ]).then(([copyData, txs, trades]) => {
      if (cancelled) return;
      const wallets = copyData.wallets || [];
      setTopWallets(wallets);
      setLatestTxs(txs);
      setChainTrades(trades);

      if (wallets.length) {
        const avgWin = wallets.reduce((s, w) => s + (w.metrics?.win_rate_pct || 0), 0) / wallets.length;
        const avgScore = wallets.reduce((s, w) => s + (w.copy_trading_score || 0), 0) / wallets.length;
        const totalVol = wallets.reduce((s, w) => s + (w.on_chain_data?.total_volume_usd || 0), 0);
        setAggregate({ avgWin, avgScore, totalVol, count: wallets.length });
      }
      setLoaded(true);
    }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const handleTrack = (wallet) => {
    navigate(`/watchlist?tab=copy&add=${wallet.address}`);
  };

  if (!loaded) return null;
  if (!topWallets.length && !latestTxs.length && !chainTrades.length) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-green" />
        <span className="font-display text-[15px] font-semibold text-text-primary">Copy Trading Intelligence</span>
        <span className="text-[10px] text-text-muted ml-1">Dune-ranked · judgment signals for smart-money copy trades</span>
      </div>

      {aggregate && (
        <BentoGrid cols={4}>
          <BentoItem>
            <StatWidget label="Top Traders" value={aggregate.count} sub="Dune DEX ranked" icon={Users} animate={false} />
          </BentoItem>
          <BentoItem>
            <StatWidget label="Avg Win Rate" value={`${aggregate.avgWin.toFixed(1)}%`} sub="top 5 traders" animate={false} />
          </BentoItem>
          <BentoItem>
            <StatWidget label="Avg Copy Score" value={Math.round(aggregate.avgScore)} sub="Sentinel composite" animate={false} />
          </BentoItem>
          <BentoItem>
            <StatWidget label="Combined Volume" value={compact(aggregate.totalVol)} sub="verified on-chain" animate={false} />
          </BentoItem>
        </BentoGrid>
      )}

      {topWallets.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">
            Top 5 Wallets to Copy · 5 stats that indicate strong activity
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {topWallets.map((w) => (
              <CopyWalletCard key={w.address} wallet={w} onTrack={handleTrack} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LatestTxFeed transactions={latestTxs} />
        <ChainTradesFeed trades={chainTrades} />
      </div>
    </div>
  );
}
