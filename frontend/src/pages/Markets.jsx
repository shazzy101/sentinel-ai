import { useEffect, useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import { api } from '../lib/api';
import Spinner from '../components/ui/Spinner';
import NansenTradingTerminal from '../components/markets/NansenTradingTerminal';
import CopyTradingIntelligence from '../components/markets/CopyTradingIntelligence';
import TrustPulse from '../components/trust/TrustPulse';
import EthYtdChart from '../components/charts/EthYtdChart';
import { useEthPrice } from '../hooks/useEthPrice';

function fmt(n, dec = 2) {
  return Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function MarketsPage() {
  const { wallets } = useWatchlist();
  const ethData = useEthPrice(); // shared poller — dedupes CoinGecko requests
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);

  useEffect(() => { document.title = 'Copy — Hadaleum'; }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getTopEthTokens()
      .then((tks) => {
        setTokens(Array.isArray(tks) ? tks : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load market data. Check your connection and retry.");
        setLoading(false);
      });
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

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="font-display text-[16px] font-bold text-text-primary mb-2">Market data unavailable</div>
          <p className="text-[13px] text-text-muted mb-4">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-green px-5 py-2.5 text-[13px] font-semibold text-text-inverse hover:bg-green-bright transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="p-5 flex flex-col gap-6 max-w-[1200px] mx-auto">
        {/* Primary: copy trading feed + top traders */}
        <CopyTradingIntelligence />

        <TrustPulse variant="full" />

        {/* ETH chart — secondary context */}
        <EthYtdChart />

        {/* Trading terminal — collapsed by default feel via smaller gap */}
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between rounded-xl border border-border-default bg-bg-surface px-4 py-3 hover:bg-bg-elevated/40 transition-colors">
            <span className="font-display text-[14px] font-medium text-text-primary">Advanced · Chart &amp; Swap</span>
            <span className="text-[11px] text-text-muted group-open:hidden">Expand</span>
            <span className="text-[11px] text-text-muted hidden group-open:inline">Collapse</span>
          </summary>
          <div className="mt-3">
            <NansenTradingTerminal
              ethData={ethData}
              wallets={wallets}
              selectedToken={selectedToken}
            />
          </div>
        </details>

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
  const ethData = useEthPrice();

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
