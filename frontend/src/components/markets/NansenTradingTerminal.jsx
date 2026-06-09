import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Zap, Wallet } from 'lucide-react';
import GlassCard from '../primitives/GlassCard';
import MagneticButton from '../primitives/MagneticButton';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { SignalPill } from '../ui/Badge';
import { useWallet } from '../../hooks/useWallet';
import { api } from '../../lib/api';
import {
  TOKEN_ADDRESSES, FROM_TOKENS, TO_TOKENS,
  toTokenUnits, parseQuoteOutput, formatTokenAmount,
} from '../../lib/tokens';
import { getSpendableBalance, validateSwapInputs } from '../../lib/swapExecution';
import { useTransaction } from '../../hooks/useTrade';

const RANGES = ['1m', '5m', '1h', 'D'];
const RANGE_DAYS = { '1m': 1, '5m': 1, '1h': 7, 'D': 365 };

function fmt(n, dec = 2) {
  return Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Mock order book around current price — visual only, like Nansen/Hyperliquid */
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

/** Nansen-style execution panel — spot swaps via DefiLlama + MetaMask */
function TradeExecutionPanel({ ethData, selectedToken, onTradeSuccess }) {
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

  useEffect(() => {
    if (!wallet.address) { setTokenBal(null); return; }
    getSpendableBalance(wallet.address, fromToken)
      .then(setTokenBal)
      .catch(() => setTokenBal(null));
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
      setToToken(selectedToken?.symbol?.toUpperCase() === 'ETH' ? 'ETH' : (TO_TOKENS.includes(selectedToken?.symbol?.toUpperCase()) ? selectedToken.symbol.toUpperCase() : 'ETH'));
    } else {
      setFromToken('ETH');
      setToToken('USDC');
    }
    setQuote(null);
    setAmount('');
  }, [side, selectedToken?.symbol]);

  const outputAmount = parseQuoteOutput(quote, toToken);
  const validationError = validateSwapInputs({
    amount,
    fromToken,
    balance: tokenBal,
    isConnected: wallet.isConnected,
    isMainnet: wallet.isMainnet,
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!quote) return;
    setError(null);
    try {
      await tx.execute({
        from: wallet.address,
        quote,
        fromToken,
        amount,
        tradeMeta: { fromToken, toToken, amount, outputAmount },
      });
      onTradeSuccess?.();
      setQuote(null);
      setAmount('');
    } catch (err) {
      setError(err.message);
    }
  };

  const pctButtons = [0, 25, 50, 75, 100];

  return (
    <GlassCard padding={false} className="h-full flex flex-col overflow-hidden">
      {/* Tabs like Nansen: Token / Perps → we use Spot / Swap */}
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
          <MagneticButton
            type="button"
            onClick={wallet.connectWallet}
            disabled={wallet.connecting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm"
          >
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
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
            placeholder="0.0"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-lg font-mono font-bold text-text-primary outline-none focus:border-green/40"
          />
          <div className="flex gap-1 mt-2">
            {pctButtons.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  if (tokenBal != null) {
                    setAmount(String((tokenBal * pct / 100).toFixed(6)));
                    setQuote(null);
                  }
                }}
                className="flex-1 text-[10px] py-1 rounded-md border border-white/[0.06] text-text-muted hover:text-text-primary hover:border-white/[0.12]"
              >
                {pct === 100 ? 'Max' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {quote && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">You receive</span><span className="font-mono text-green">{outputAmount} {toToken}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Impact</span><span className="font-mono">{(quote.priceImpact ?? 0).toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Route</span><span className="font-mono">{quote.aggregator || 'Multi-DEX'}</span></div>
          </div>
        )}

        {error && <div className="text-[11px] text-red bg-red/10 border border-red/20 rounded-lg p-2">{error}</div>}

        {!quote ? (
          <Button variant="primary" fullWidth disabled={loading || !!validationError} onClick={handleQuote}>
            {loading ? <><Spinner size="sm" /> Getting rate…</> : <><Zap className="h-4 w-4" /> Get best rate</>}
          </Button>
        ) : (
          <Button variant="primary" fullWidth disabled={tx.isBusy} onClick={handleExecute}>
            {tx.isBusy ? 'Confirming…' : 'Execute in MetaMask →'}
          </Button>
        )}

        <button
          type="button"
          onClick={() => navigate(`/invest?from=${fromToken}&to=${toToken}`)}
          className="text-[10px] text-text-muted hover:text-green text-center"
        >
          Advanced swap on Invest page →
        </button>

        {/* Smart money sentiment strip */}
        <div className="mt-auto pt-3 border-t border-white/[0.06]">
          <div className="text-[9px] uppercase tracking-widest text-text-muted mb-2">Whale Sentiment</div>
          <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
            <div className="bg-green/60" style={{ width: '62%' }} />
            <div className="bg-red/60 flex-1" />
          </div>
          <div className="flex justify-between text-[10px] mt-1 text-text-muted">
            <span className="text-green">62% Bullish</span>
            <span className="text-red">38% Bearish</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/** Top whale traders table — Nansen-style bottom panel */
function TopTradersTable({ wallets }) {
  const top = useMemo(() =>
    [...wallets]
      .filter((w) => (w.score ?? 0) > 55)
      .sort((a, b) => (b.ytd_growth_pct ?? b.score ?? 0) - (a.ytd_growth_pct ?? a.score ?? 0))
      .slice(0, 10),
  [wallets]);

  return (
    <GlassCard padding={false} className="overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[12px] font-semibold text-text-primary">Top Traders</span>
        <span className="text-[10px] text-text-muted">YTD growth · Sentinel score</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[1fr_100px_100px_90px_80px] gap-2 px-4 py-2 text-[9px] uppercase tracking-widest text-text-muted border-b border-white/[0.04] min-w-[520px]">
          <span>Trader</span><span className="text-right">YTD</span><span className="text-right">Balance</span><span className="text-right">Score</span><span className="text-right">Signal</span>
        </div>
        {top.map((w) => {
          const ytd = w.ytd_growth_pct;
          return (
            <div key={w.address} className="grid grid-cols-[1fr_100px_100px_90px_80px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] items-center min-w-[520px]">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-text-primary truncate">{w.label || 'Whale'}</div>
                <div className="text-[10px] font-mono text-text-muted">{w.address?.slice(0, 10)}…</div>
              </div>
              <span className={`text-right font-mono text-[12px] ${ytd >= 0 ? 'text-green' : 'text-red'}`}>
                {ytd != null ? `${ytd >= 0 ? '+' : ''}${ytd.toFixed(1)}%` : '—'}
              </span>
              <span className="text-right font-mono text-[11px] text-text-secondary">
                {Number(w.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ETH
              </span>
              <span className="text-right font-mono text-[12px] font-bold text-text-primary">{Math.round(w.score ?? 0)}</span>
              <span className="text-right">{w.signal ? <SignalPill signal={w.signal} /> : '—'}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

/** Full Nansen-inspired trading terminal layout */
export default function NansenTradingTerminal({ ethData, ethChart, wallets, selectedToken, onSelectToken }) {
  const [range, setRange] = useState('D');
  const [chartDays, setChartDays] = useState(365);

  useEffect(() => {
    setChartDays(RANGE_DAYS[range] ?? 365);
  }, [range]);

  const change24h = ethData?.usd_24h_change ?? 0;
  const price = ethData?.usd ?? 0;

  const chartData = ethChart?.prices?.map(([ts, p]) => ({
    date: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: range !== 'D' ? 'numeric' : undefined }),
    price: Math.round(p * 100) / 100,
  })) || [];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Token info bar — like Nansen header */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" alt="ETH" className="w-7 h-7 rounded-full" />
          <div>
            <div className="font-display font-bold text-text-primary">ETH · Ethereum</div>
            <div className="text-[11px] text-text-muted">Token God Mode · Spot</div>
          </div>
        </div>
        <div className="font-mono text-xl font-bold text-text-primary">${fmt(price)}</div>
        <span className={`text-[12px] font-mono ${change24h >= 0 ? 'text-green' : 'text-red'}`}>
          {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}% 24h
        </span>
        {[
          ['Mark', `$${fmt(price)}`],
          ['24h Vol', `$${((ethData?.usd_market_cap ?? 0) / 1e6 * 0.01).toFixed(1)}B`],
          ['Mkt Cap', `$${((ethData?.usd_market_cap ?? 0) / 1e9).toFixed(1)}B`],
        ].map(([k, v]) => (
          <div key={k} className="text-[11px]">
            <span className="text-text-muted">{k} </span>
            <span className="font-mono text-text-secondary">{v}</span>
          </div>
        ))}
      </div>

      {/* Main grid: chart + order book + trade panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_200px_280px] gap-3 min-h-[420px] flex-1">
        {/* Chart */}
        <GlassCard padding={false} className="flex flex-col min-h-[360px]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
            <span className="text-[11px] font-mono text-text-secondary">ETH-USDC</span>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`text-[10px] px-2 py-0.5 rounded ${range === r ? 'bg-white/[0.08] text-text-primary' : 'text-text-muted'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 p-2 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nansenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D992" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00D992" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E26" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#4A4A5E', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#4A4A5E', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={56} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: '#141418', border: '1px solid #28283A', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`$${fmt(v)}`, 'Price']} />
                <Area type="monotone" dataKey="price" stroke="#00D992" strokeWidth={1.5} fill="url(#nansenGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Order book */}
        <GlassCard padding={false} className="hidden xl:flex flex-col min-h-[360px]">
          <div className="px-3 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-text-muted">Order Book</div>
          <OrderBook price={price} />
        </GlassCard>

        {/* Trade execution */}
        <TradeExecutionPanel ethData={ethData} selectedToken={selectedToken} />
      </div>

      {/* Bottom: top traders */}
      <TopTradersTable wallets={wallets} />
    </div>
  );
}
