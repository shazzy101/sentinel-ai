import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Wallet } from 'lucide-react';
import GlassCard from '../primitives/GlassCard';
import MagneticButton from '../primitives/MagneticButton';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Sparkline from '../ui/Sparkline';
import { SignalPill } from '../ui/Badge';
import TradingViewChart from '../charts/TradingViewChart';
import { useWallet } from '../../hooks/useWallet';
import { api } from '../../lib/api';
import {
  TOKEN_ADDRESSES, TO_TOKENS,
  toTokenUnits, parseQuoteOutput,
} from '../../lib/tokens';
import { buildBalanceSparkline } from '../../lib/chartUtils';
import { getSpendableBalance, validateSwapInputs } from '../../lib/swapExecution';
import { useTransaction } from '../../hooks/useTrade';

const EXCHANGE_KW = ['binance', 'coinbase', 'kraken', 'kucoin', 'okx', 'crypto.com', 'gemini', 'bitstamp', 'bittrex', 'huobi', 'gate.io', 'bitfinex', 'bithumb', 'coinone', 'deposit funder', 'hot wallet'];

function isExchange(w) {
  const label = (w.label || '').toLowerCase();
  return EXCHANGE_KW.some((k) => label.includes(k));
}

function fmt(n, dec = 2) {
  return Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function OrderBook({ price }) {
  const mid = Number(price) || 1700;
  const asks = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    price: mid + (8 - i) * (mid * 0.0003),
    size: (Math.random() * 12 + 2).toFixed(2),
  })), [mid]);
  const bids = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    price: mid - (i + 1) * (mid * 0.0003),
    size: (Math.random() * 12 + 2).toFixed(2),
  })), [mid]);

  return (
    <div className="flex flex-col h-full text-[11px] font-mono">
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5 text-[9px] uppercase tracking-widest text-text-muted border-b border-white/[0.06]">
        <span>Price</span><span className="text-right">Size</span><span className="text-right">Total</span>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {asks.map((row, i) => (
          <div key={`a-${i}`} className="grid grid-cols-3 gap-1 px-2 py-0.5 relative">
            <div className="absolute inset-y-0 right-0 bg-red/10" style={{ width: `${20 + i * 8}%` }} />
            <span className="relative text-red">{fmt(row.price)}</span>
            <span className="relative text-right text-text-secondary">{row.size}</span>
            <span className="relative text-right text-text-muted">{(row.size * row.price / 1000).toFixed(1)}K</span>
          </div>
        ))}
        <div className="py-1.5 text-center text-[10px] text-text-muted border-y border-white/[0.06] my-0.5">
          Spread <span className="text-text-secondary">{fmt(mid * 0.0002, 4)}</span>
        </div>
        {bids.map((row, i) => (
          <div key={`b-${i}`} className="grid grid-cols-3 gap-1 px-2 py-0.5 relative">
            <div className="absolute inset-y-0 right-0 bg-green/10" style={{ width: `${20 + i * 8}%` }} />
            <span className="relative text-green">{fmt(row.price)}</span>
            <span className="relative text-right text-text-secondary">{row.size}</span>
            <span className="relative text-right text-text-muted">{(row.size * row.price / 1000).toFixed(1)}K</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeExecutionPanel({ ethData, selectedToken, wallets, onTradeSuccess }) {
  const wallet = useWallet();
  const tx = useTransaction();
  const navigate = useNavigate();
  const [side, setSide] = useState('buy');
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenBal, setTokenBal] = useState(null);

  const bullish = wallets.filter((w) => w.signal === 'BULLISH').length;
  const bearish = wallets.filter((w) => w.signal === 'BEARISH').length;
  const total = bullish + bearish || 1;
  const bullishPct = Math.round((bullish / total) * 100);
  const bearishPct = 100 - bullishPct;

  useEffect(() => {
    if (!wallet.address) { setTokenBal(null); return; }
    getSpendableBalance(wallet.address, fromToken).then(setTokenBal).catch(() => setTokenBal(null));
  }, [wallet.address, fromToken]);

  useEffect(() => {
    if (selectedToken?.symbol) {
      const sym = selectedToken.symbol.toUpperCase();
      if (TO_TOKENS.includes(sym)) setToToken(sym);
    }
  }, [selectedToken?.symbol]);

  useEffect(() => {
    if (side === 'buy') {
      setFromToken('USDC');
      const sym = selectedToken?.symbol?.toUpperCase();
      setToToken(sym && TO_TOKENS.includes(sym) ? sym : 'ETH');
    } else {
      setFromToken('ETH');
      setToToken('USDC');
    }
    setQuote(null);
    setAmount('');
  }, [side, selectedToken?.symbol]);

  const outputAmount = parseQuoteOutput(quote, toToken);
  const validationError = validateSwapInputs({
    amount, fromToken, balance: tokenBal,
    isConnected: wallet.isConnected, isMainnet: wallet.isMainnet,
  });

  const handleQuote = async () => {
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSwapQuote(
        TOKEN_ADDRESSES[fromToken],
        TOKEN_ADDRESSES[toToken],
        toTokenUnits(amount, fromToken),
      );
      if (data?.error || data?.message) throw new Error(data.error || data.message);
      setQuote(data);
    } catch (err) {
      const ethPrice = ethData?.usd || 1665;
      const est = fromToken === 'USDC'
        ? parseFloat(amount) / ethPrice
        : parseFloat(amount) * ethPrice;
      setQuote({ toAmount: String(Math.floor(est * 1e6)), priceImpact: 0, aggregator: 'Estimate', _fallback: true });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!quote || quote._fallback) { setError('Get a live quote before executing.'); return; }
    setError(null);
    try {
      await tx.execute({ from: wallet.address, quote, fromToken, amount, tradeMeta: { fromToken, toToken, amount, outputAmount } });
      onTradeSuccess?.();
      setQuote(null);
      setAmount('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <GlassCard padding={false} className="h-full flex flex-col overflow-hidden" id="markets-trade-panel">
      <div className="flex border-b border-white/[0.06]">
        {['buy', 'sell'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`flex-1 py-3 text-[12px] font-semibold uppercase tracking-wide transition-colors ${
              side === s
                ? s === 'buy' ? 'bg-green/15 text-green border-b-2 border-green' : 'bg-red/10 text-red border-b-2 border-red'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {s === 'buy' ? 'Buy / Long' : 'Sell / Short'}
          </button>
        ))}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
        {!wallet.isConnected ? (
          <MagneticButton type="button" onClick={wallet.connectWallet} disabled={wallet.connecting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm">
            {wallet.connecting ? <Spinner size="sm" /> : <Wallet className="h-4 w-4" />}
            Connect MetaMask
          </MagneticButton>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-green/20 bg-green/5 px-3 py-2 text-[11px] font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-green pulse-dot" />
            <span className="text-text-secondary truncate">{wallet.address?.slice(0, 8)}…</span>
            <span className="ml-auto text-text-primary">{tokenBal?.toFixed(4) ?? '—'} {fromToken}</span>
          </div>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-widest text-text-muted mb-1 block">Amount ({fromToken})</label>
          <input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
            placeholder="0.0"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-lg font-mono font-bold text-text-primary outline-none focus:border-green/40" />
          <div className="flex gap-1 mt-2">
            {[0, 25, 50, 75, 100].map((pct) => (
              <button key={pct} type="button"
                onClick={() => { if (tokenBal != null) { setAmount(String((tokenBal * pct / 100).toFixed(6))); setQuote(null); } }}
                className="flex-1 text-[10px] py-1 rounded-md border border-white/[0.06] text-text-muted hover:text-text-primary">
                {pct === 100 ? 'Max' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {quote && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">You receive</span><span className="font-mono text-green">{outputAmount} {toToken}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Impact</span><span className="font-mono">{(quote.priceImpact ?? 0).toFixed(2)}%</span></div>
          </div>
        )}

        {error && <div className="text-[11px] text-red bg-red/10 border border-red/20 rounded-lg p-2">{error}</div>}

        {!quote ? (
          <Button variant="primary" fullWidth disabled={loading || !!validationError} onClick={handleQuote}>
            {loading ? <><Spinner size="sm" /> Getting rate…</> : <><Zap className="h-4 w-4" /> Get best rate</>}
          </Button>
        ) : (
          <Button variant="primary" fullWidth disabled={tx.isBusy || quote._fallback} onClick={handleExecute}>
            {tx.isBusy ? 'Confirming…' : 'Execute in MetaMask →'}
          </Button>
        )}

        <button type="button" onClick={() => navigate(`/invest?from=${fromToken}&to=${toToken}`)}
          className="text-[10px] text-text-muted hover:text-green text-center">
          Advanced swap on Invest page →
        </button>

        <div className="mt-auto pt-3 border-t border-white/[0.06]">
          <div className="text-[9px] uppercase tracking-widest text-text-muted mb-2">Whale Sentiment</div>
          <div className="flex h-2 rounded-full overflow-hidden w-full">
            <div className="bg-green transition-all" style={{ width: `${bullishPct}%` }} />
            <div className="bg-red transition-all" style={{ width: `${bearishPct}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-green">{bullishPct}% Bullish</span>
            <span className="text-[11px] text-red">{bearishPct}% Bearish</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function TopTradersTable({ wallets }) {
  const [showAll, setShowAll] = useState(false);

  const topTraders = useMemo(() =>
    (wallets || [])
      .filter((w) => !isExchange(w) && (w.score ?? 0) >= 60)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
  [wallets]);

  const displayed = showAll ? topTraders : topTraders.slice(0, 10);

  return (
    <GlassCard padding={false} className="overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[12px] font-semibold text-text-primary">Top Traders</span>
        <span className="text-[10px] text-text-muted">YTD sparkline · Sentinel score</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[1fr_100px_100px_90px_80px] gap-2 px-4 py-2 text-[9px] uppercase tracking-widest text-text-muted border-b border-white/[0.04] min-w-[520px]">
          <span>Trader</span><span className="text-right">YTD</span><span className="text-right">Balance</span><span className="text-right">Score</span><span className="text-right">Signal</span>
        </div>
        {displayed.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-text-muted">No smart money wallets with score ≥ 60 yet. Run Scan 500 on Watchlist.</div>
        ) : displayed.map((w) => {
          const sparkData = buildBalanceSparkline(w.transactions, w.balance);
          return (
            <div key={w.address} className="grid grid-cols-[1fr_100px_100px_90px_80px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] items-center min-w-[520px]">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-text-primary truncate">{w.label || 'Whale'}</div>
                <div className="text-[10px] font-mono text-text-muted">{w.address?.slice(0, 10)}…</div>
              </div>
              <div className="flex justify-end">
                {sparkData.length >= 2 ? (
                  <Sparkline data={sparkData} width={80} height={24} />
                ) : (
                  <span className="text-text-muted text-[11px]">Scan needed</span>
                )}
              </div>
              <span className="text-right font-mono text-[11px] text-text-secondary">
                {Number(w.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ETH
              </span>
              <span className="text-right font-mono text-[12px] font-bold text-text-primary">{Math.round(w.score ?? 0)}</span>
              <span className="text-right">{w.signal ? <SignalPill signal={w.signal} /> : '—'}</span>
            </div>
          );
        })}
      </div>
      {!showAll && topTraders.length > 10 && (
        <button type="button" onClick={() => setShowAll(true)}
          className="w-full py-3 text-[12px] text-text-muted hover:text-text-secondary border-t border-white/[0.06] text-center hover:bg-white/[0.02] transition-colors">
          Load all {topTraders.length} traders with score ≥ 60 ↓
        </button>
      )}
    </GlassCard>
  );
}

export default function NansenTradingTerminal({ ethData, wallets, selectedToken, onSelectToken }) {
  const [chartInterval, setChartInterval] = useState('5');
  const change24h = ethData?.usd_24h_change ?? 0;
  const price = ethData?.usd ?? 0;

  const intervalLabel = (iv) => {
    if (iv === '1') return '1m';
    if (iv === '5') return '5m';
    if (iv === '60') return '1h';
    return 'D';
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex flex-wrap items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" alt="ETH" className="w-7 h-7 rounded-full" />
          <div>
            <div className="font-display font-bold text-text-primary">ETH · Ethereum</div>
            <div className="text-[11px] text-text-muted">Token God Mode · Spot</div>
          </div>
        </div>
        <div className="font-mono text-xl font-bold text-text-primary">${fmt(price)}</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span className="text-[11px] text-text-muted">LIVE</span>
        </div>
        <span className={`text-[12px] font-mono ${change24h >= 0 ? 'text-green' : 'text-red'}`}>
          {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}% 24h
        </span>
        {[['Mark', `$${fmt(price)}`], ['Mkt Cap', `$${((ethData?.usd_market_cap ?? 0) / 1e9).toFixed(1)}B`]].map(([k, v]) => (
          <div key={k} className="text-[11px]">
            <span className="text-text-muted">{k} </span>
            <span className="font-mono text-text-secondary">{v}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_200px_280px] gap-3 min-h-[420px] flex-1">
        <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden flex flex-col min-h-[360px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] font-semibold text-text-primary">ETH-USDC</span>
              <span className="text-[11px] text-text-muted">Token God Mode · Spot</span>
            </div>
            <div className="flex items-center gap-1">
              {['1m', '5m', '1h', 'D'].map((t) => {
                const iv = t === '1m' ? '1' : t === '5m' ? '5' : t === '1h' ? '60' : 'D';
                return (
                  <button key={t} type="button" onClick={() => setChartInterval(iv)}
                    className={`text-[11px] px-2 py-1 rounded transition-colors ${
                      chartInterval === iv ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-secondary'
                    }`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <TradingViewChart symbol="ETHUSD" interval={chartInterval} height={420} />
        </div>

        <GlassCard padding={false} className="hidden xl:flex flex-col min-h-[360px]">
          <div className="px-3 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-text-muted">Order Book</div>
          <OrderBook price={price} />
        </GlassCard>

        <TradeExecutionPanel ethData={ethData} selectedToken={selectedToken} wallets={wallets} />
      </div>

      <TopTradersTable wallets={wallets} />
    </div>
  );
}
