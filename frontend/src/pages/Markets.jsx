import { useEffect, useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import { api } from '../lib/api';
import Spinner from '../components/ui/Spinner';
import NansenTradingTerminal from '../components/markets/NansenTradingTerminal';
import NetworkDashboard from '../components/markets/NetworkDashboard';
import CopyTradingIntelligence from '../components/markets/CopyTradingIntelligence';
import EthYtdChart from '../components/charts/EthYtdChart';

function fmt(n, dec = 2) {
  return Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function MarketsPage() {
  const { wallets } = useWatchlist();
  const [ethData, setEthData] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState(null);

  useEffect(() => { document.title = 'Markets — Sentinel AI'; }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getEthPrice(),
      api.getTopEthTokens(),
    ]).then(([price, tks]) => {
      setEthData(price.ethereum);
      setTokens(Array.isArray(tks) ? tks : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      api.getEthPrice().then((d) => setEthData(d.ethereum)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted text-[13px]">
          <Spinner size="md" /> Loading market data...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="p-5 flex flex-col gap-5 max-w-[1600px] mx-auto">
        {/* Network intelligence — Dune-powered on-chain dashboard */}
        <NetworkDashboard />

        {/* Copy-trading judgment layer — top wallets, latest txs, chain trades */}
        <CopyTradingIntelligence />

        {/* ETH year-to-date price chart */}
        <EthYtdChart />

        {/* Nansen-style trading terminal */}
        <NansenTradingTerminal
          ethData={ethData}
          wallets={wallets}
          selectedToken={selectedToken}
        />

        {/* Ecosystem token screener */}
        <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="font-display text-[14px] font-medium text-text-primary">Top ETH Ecosystem Tokens</span>
            <span className="text-[10px] text-text-muted">Click to trade · Powered by CoinGecko</span>
          </div>

          <div
            className="grid px-5 py-2.5 bg-bg-overlay border-b border-border-subtle text-[10px] uppercase tracking-widest text-text-muted"
            style={{ gridTemplateColumns: '36px 1fr 120px 100px 100px 120px 80px' }}
          >
            <div>#</div>
            <div>Token</div>
            <div className="text-right">Price</div>
            <div className="text-right">24h</div>
            <div className="text-right">7d</div>
            <div className="text-right">Mkt Cap</div>
            <div />
          </div>

          {tokens.map((token, i) => {
            const c24 = token.price_change_percentage_24h ?? 0;
            const c7d = token.price_change_percentage_7d_in_currency ?? 0;
            const isSelected = selectedToken?.id === token.id;

            return (
              <button
                key={token.id}
                type="button"
                onClick={() => {
                  setSelectedToken(token);
                  document.getElementById('markets-trade-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className={`group grid w-full px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors items-center text-left cursor-pointer ${
                  isSelected ? 'bg-bg-elevated border-l-2 border-l-green' : ''
                }`}
                style={{ gridTemplateColumns: '36px 1fr 120px 100px 100px 120px 80px' }}
              >
                <span className="text-[11px] text-text-muted font-mono">{i + 1}</span>
                <div className="flex items-center gap-3">
                  <img src={token.image} alt={token.symbol} className="w-7 h-7 rounded-full" />
                  <div>
                    <div className="text-[13px] font-medium text-text-primary">{token.name}</div>
                    <div className="text-[10px] text-text-muted font-mono uppercase">{token.symbol}</div>
                  </div>
                </div>
                <span className="font-mono text-[13px] text-text-primary text-right">
                  ${fmt(token.current_price, token.current_price > 1 ? 2 : 6)}
                </span>
                <span className={`font-mono text-[12px] text-right font-medium ${c24 >= 0 ? 'text-green' : 'text-red'}`}>
                  {c24 >= 0 ? '+' : ''}{c24.toFixed(2)}%
                </span>
                <span className={`font-mono text-[12px] text-right font-medium ${c7d >= 0 ? 'text-green' : 'text-red'}`}>
                  {c7d >= 0 ? '+' : ''}{c7d.toFixed(2)}%
                </span>
                <span className="font-mono text-[12px] text-text-secondary text-right">
                  ${(token.market_cap / 1e9).toFixed(2)}B
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-green text-right">
                  Trade →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EthPriceBadge() {
  const [ethData, setEthData] = useState(null);

  useEffect(() => {
    api.getEthPrice().then((d) => setEthData(d.ethereum)).catch(() => {});
    const iv = setInterval(() => {
      api.getEthPrice().then((d) => setEthData(d.ethereum)).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  if (!ethData) return null;
  const change = ethData.usd_24h_change ?? 0;

  return (
    <div className="flex items-center gap-2 bg-bg-surface border border-border-default rounded-lg px-3 py-1.5">
      <div className="flex items-center gap-1.5 mr-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
        <span className="text-[10px] text-text-muted uppercase">Live</span>
      </div>
      <img
        src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
        alt="ETH"
        className="w-4 h-4"
      />
      <span className="font-mono font-bold text-[14px] text-text-primary">
        ${Number(ethData.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={`text-[11px] font-mono ${change >= 0 ? 'text-green' : 'text-red'}`}>
        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}
