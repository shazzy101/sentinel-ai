import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowDownUp, Wallet, Shield, ExternalLink, Zap,
  CheckCircle2, Loader2, AlertTriangle,
} from 'lucide-react';
import MagneticButton from '../components/primitives/MagneticButton';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { SignalPill } from '../components/ui/Badge';
import { useWallet } from '../hooks/useWallet';
import { useWatchlist } from '../hooks/useWatchlist';
import { useTransaction, useTradeHistory } from '../hooks/useTrade';
import { api } from '../lib/api';
import {
  TOKEN_ADDRESSES, FROM_TOKENS, TO_TOKENS, POPULAR_PAIRS,
  toTokenUnits, parseQuoteOutput, flattenProtocols,
} from '../lib/tokens';
import { formatWalletAddress } from '../lib/web3';
import { getSpendableBalance, validateSwapInputs } from '../lib/swapExecution';
import { fadeUp, motionTokens } from '../design/motion';

function formatTimeAgo(ts) {
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LiveWhaleMovesFeed({ wallets, onCopyTrade, selectedAddress }) {
  const feedWallets = useMemo(() =>
    (wallets || [])
      .filter((w) => w.signal != null)
      .sort((a, b) => new Date(b.last_scanned || 0).getTime() - new Date(a.last_scanned || 0).getTime())
      .slice(0, 10),
  [wallets]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-2">
      <div className="mb-4">
        <h2 className="font-display text-[14px] font-medium text-text-primary">Live Whale Moves</h2>
        <p className="text-[11px] text-text-muted mt-0.5">Real-time · Copy any trade</p>
      </div>
      {feedWallets.length === 0 ? (
        <div className="text-[13px] text-text-muted py-12 text-center border border-border-subtle rounded-xl">
          No whale signals yet. Run scans on Watchlist to populate moves.
        </div>
      ) : feedWallets.map((w) => {
        const tx = w.transactions?.[0];
        const ethAmt = tx?.value_eth ?? tx?.value ?? w.balance ?? 0;
        return (
          <div
            key={w.address}
            role="button"
            tabIndex={0}
            onClick={() => onCopyTrade(w)}
            onKeyDown={(e) => e.key === 'Enter' && onCopyTrade(w)}
            className={`bg-bg-surface border rounded-xl p-4 mb-3 cursor-pointer hover:border-border-strong transition-all ${
              selectedAddress === w.address ? 'border-green/40 bg-green/5' : 'border-border-default'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-widest text-green mb-1">Whale move detected</div>
                <div className="font-display text-[15px] font-bold text-text-primary truncate">{w.label || 'Whale'}</div>
                <div className="font-mono text-[12px] text-text-secondary mt-1">
                  Sent {Number(ethAmt).toFixed(2)} ETH · {formatTimeAgo(tx?.timestamp || w.last_scanned)}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-text-muted">
                  Signal: <SignalPill signal={w.signal} />
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCopyTrade(w); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green text-bg-base rounded-lg text-[12px] font-semibold hover:opacity-90 active:scale-95 transition-all shrink-0"
              >
                Copy trade
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TokenSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 hover:bg-white/[0.06] transition-colors"
      >
        <span className="text-sm font-bold text-text-primary">{value}</span>
        <span className="text-text-muted text-xs">▾</span>
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border border-white/[0.08] bg-bg-overlay shadow-elevated">
            {options.filter((o) => o !== value).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className="block w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function InvestPage() {
  const [searchParams] = useSearchParams();
  const wallet = useWallet();
  const tx = useTransaction();
  const history = useTradeHistory();
  const { wallets } = useWatchlist();

  const [step, setStep] = useState('configure');
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ethPrice, setEthPrice] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);

  useEffect(() => {
    if (!wallet.address || step === 'configure' || step === 'quote') {
      if (wallet.address && fromToken) {
        getSpendableBalance(wallet.address, fromToken)
          .then(setTokenBalance)
          .catch(() => setTokenBalance(null));
      }
    }
  }, [wallet.address, fromToken, step]);

  const inputError = useMemo(() => validateSwapInputs({
    amount,
    fromToken,
    balance: tokenBalance,
    isConnected: wallet.isConnected,
    isMainnet: wallet.isMainnet,
  }), [amount, fromToken, tokenBalance, wallet.isConnected, wallet.isMainnet]);

  useEffect(() => { document.title = 'Invest — Sentinel AI'; }, []);

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && FROM_TOKENS.includes(from)) setFromToken(from);
    if (to && TO_TOKENS.includes(to)) setToToken(to);
  }, [searchParams]);

  useEffect(() => {
    api.getEthPrice().then((d) => setEthPrice(d.ethereum?.usd)).catch(() => {});
    const iv = setInterval(() => {
      api.getEthPrice().then((d) => setEthPrice(d.ethereum?.usd)).catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  const usdEstimate = useMemo(() => {
    const n = parseFloat(amount);
    if (!n || !ethPrice) return null;
    if (fromToken === 'ETH' || fromToken === 'WETH') return n * ethPrice;
    return n; // stablecoins ~$1
  }, [amount, fromToken, ethPrice]);

  const outputAmount = parseQuoteOutput(quote, toToken);
  const priceImpact = quote?.priceImpact ?? 0;

  const handleSwapDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setQuote(null);
    setStep('configure');
  };

  const handleGetQuote = async () => {
    if (!amount || !wallet.address) return;
    setQuoteLoading(true);
    setError(null);
    try {
      const amountIn = toTokenUnits(amount, fromToken);
      const data = await api.getSwapQuote(
        TOKEN_ADDRESSES[fromToken],
        TOKEN_ADDRESSES[toToken],
        amountIn,
      );
      if (data?.error || data?.message) throw new Error(data.error || data.message);
      setQuote(data);
      setStep('quote');
    } catch (err) {
      const price = ethPrice || 1665;
      const est = fromToken === 'USDC'
        ? parseFloat(amount) / price
        : parseFloat(amount) * price;
      const decimals = toToken === 'USDC' || toToken === 'USDT' ? 6 : 18;
      setQuote({
        toAmount: String(Math.floor(est * Math.pow(10, decimals))),
        priceImpact: 0,
        aggregator: 'Estimate',
        _fallback: true,
      });
      setStep('quote');
      setError('Live quote unavailable — showing estimate. Confirm before executing.');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleExecute = async () => {
    if (quote?._fallback) {
      setError('Get a live quote before executing.');
      return;
    }
    setStep('executing');
    setError(null);
    try {
      await tx.execute({
        from: wallet.address,
        quote,
        fromToken,
        amount,
        tradeMeta: {
          fromToken,
          toToken,
          amount,
          outputAmount,
          priceImpact,
        },
      });
      setStep('success');
    } catch (err) {
      setError(err.message);
      setStep('quote');
    }
  };

  const handleReset = () => {
    setStep('configure');
    setQuote(null);
    setAmount('');
    tx.reset();
    setError(null);
  };

  const applyPair = (pair) => {
    setFromToken(pair.from);
    setToToken(pair.to);
    setQuote(null);
    setStep('configure');
    setSelectedWallet(null);
  };

  const handleCopyTrade = (w) => {
    setSelectedWallet(w);
    setFromToken('USDC');
    setToToken('ETH');
    setAmount('');
    setQuote(null);
    setStep('configure');
    setError(null);
    document.getElementById('swap-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-end px-5 py-3 border-b border-border-subtle">
        {!wallet.isConnected ? (
          <MagneticButton type="button" onClick={wallet.connectWallet} disabled={wallet.connecting}
            className="text-[12px] px-3 py-1.5 border border-border-default rounded-lg text-text-secondary hover:bg-bg-elevated">
            {wallet.connecting ? 'Connecting…' : 'Connect MetaMask'}
          </MagneticButton>
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-mono text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            {formatWalletAddress(wallet.address)}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 p-5 overflow-hidden flex flex-col">
          <LiveWhaleMovesFeed wallets={wallets} onCopyTrade={handleCopyTrade} selectedAddress={selectedWallet?.address} />
        </div>

        <div id="swap-panel" className="w-[380px] flex-shrink-0 border-l border-border-subtle bg-bg-surface overflow-y-auto">
          <div className="p-4">
            <div className="mb-4">
              <div className="font-display font-bold text-[16px] text-text-primary">Swap</div>
              <div className="text-[11px] text-text-muted">Powered by DefiLlama · Best rate</div>
            </div>

            {selectedWallet && step === 'configure' && (
              <div className="mb-4 rounded-xl border border-green/25 bg-green/10 px-3 py-2.5 text-[11px] text-green">
                Copying <strong>{selectedWallet.label}</strong>&apos;s ETH buy — adjust amount, then get rate.
              </div>
            )}
            {/* Wallet strip */}
            <div className="mb-5">
              {!wallet.isConnected ? (
                <MagneticButton
                  type="button"
                  onClick={wallet.connectWallet}
                  disabled={wallet.connecting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-text-secondary hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                >
                  {wallet.connecting ? <Spinner size="sm" /> : <Wallet className="h-4 w-4" strokeWidth={1.75} />}
                  Connect MetaMask to trade
                </MagneticButton>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-green/20 bg-green/5 px-4 py-3">
                  <span className="relative h-2 w-2 rounded-full bg-green pulse-dot shrink-0" />
                  <span className="font-mono text-sm text-text-secondary">{formatWalletAddress(wallet.address)}</span>
                  <span className="ml-auto font-mono text-sm font-medium text-text-primary">
                    {tokenBalance != null ? tokenBalance.toFixed(4) : wallet.balance?.toFixed(4)} {fromToken}
                  </span>
                  {!wallet.isMainnet && (
                    <span className="text-[10px] text-amber uppercase font-medium">Wrong network</span>
                  )}
                </div>
              )}
            </div>

            {/* Popular pairs */}
            {step === 'configure' && (
              <div className="flex flex-wrap gap-2 mb-5">
                {POPULAR_PAIRS.map((pair) => (
                  <button
                    key={pair.label}
                    type="button"
                    onClick={() => applyPair(pair)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.06] bg-white/[0.02] text-text-muted hover:text-text-primary hover:border-white/[0.1] transition-colors"
                  >
                    {pair.label}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              {(step === 'configure' || step === 'quote' || step === 'confirm') && (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={motionTokens.easeOut}
                >
                  {/* You pay */}
                  <div className="mb-2">
                    <label className="text-[11px] text-text-muted mb-1.5 block">You pay</label>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          placeholder="0.0"
                          value={amount}
                          onChange={(e) => { setAmount(e.target.value); setQuote(null); setStep('configure'); }}
                          disabled={step !== 'configure' && step !== 'quote'}
                          className="min-w-0 flex-1 bg-transparent text-2xl font-display font-bold text-text-primary outline-none disabled:opacity-60"
                        />
                        <TokenSelect
                          value={fromToken}
                          onChange={(t) => { setFromToken(t); setQuote(null); setStep('configure'); }}
                          options={FROM_TOKENS}
                        />
                      </div>
                      {usdEstimate != null && (
                        <div className="mt-2 text-[11px] text-text-muted">≈ ${usdEstimate.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center my-2">
                    <button
                      type="button"
                      onClick={handleSwapDirection}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:rotate-180 transition-all duration-300"
                    >
                      <ArrowDownUp className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
                    </button>
                  </div>

                  {/* You receive */}
                  <div className="mb-5">
                    <label className="text-[11px] text-text-muted mb-1.5 block">You receive</label>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1 text-2xl font-display font-bold text-text-muted truncate">
                          {outputAmount ?? '—'}
                        </div>
                        <TokenSelect
                          value={toToken}
                          onChange={(t) => { setToToken(t); setQuote(null); setStep('configure'); }}
                          options={TO_TOKENS}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quote details */}
                  {step === 'quote' && quote && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4 space-y-3">
                      <div className="text-[11px] uppercase tracking-widest text-text-muted">Best rate · DefiLlama</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Price impact', `${priceImpact.toFixed(2)}%`],
                          ['Est. gas', quote.gasUsd ? `$${Number(quote.gasUsd).toFixed(2)}` : '—'],
                          ['Route', quote.aggregator || quote.exchange || 'Multi-DEX'],
                          ['Rate', `1 ${fromToken} ≈ ${outputAmount} ${toToken}`],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-white/[0.03] p-2.5">
                            <div className="text-[10px] uppercase text-text-muted">{k}</div>
                            <div className="text-xs font-mono text-text-secondary mt-0.5">{v}</div>
                          </div>
                        ))}
                      </div>
                      {flattenProtocols(quote).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {flattenProtocols(quote).map((p) => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-text-muted">{p}</span>
                          ))}
                        </div>
                      )}
                      {priceImpact > 3 && (
                        <div className={`flex gap-2 rounded-lg p-3 text-xs ${priceImpact > 10 ? 'text-red bg-red/10 border border-red/20' : 'text-amber bg-amber/10 border border-amber/20'}`}>
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          High price impact ({priceImpact.toFixed(1)}%). Consider a smaller trade.
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="mb-4 rounded-xl border border-red/20 bg-red/10 p-3 text-xs text-red">{error}</div>
                  )}
                  {inputError && step === 'configure' && amount && (
                    <div className="mb-4 rounded-xl border border-amber/20 bg-amber/10 p-3 text-xs text-amber">{inputError}</div>
                  )}

                  {/* Actions */}
                  {step === 'configure' && (
                    <Button
                      variant="primary"
                      magnetic
                      fullWidth
                      disabled={!amount || !wallet.isConnected || quoteLoading || !wallet.isMainnet || !!inputError}
                      onClick={handleGetQuote}
                    >
                      {quoteLoading ? <><Spinner size="sm" /> Fetching best rate…</> : 'Get best rate →'}
                    </Button>
                  )}
                  {step === 'quote' && (
                    <div className="space-y-2">
                      <Button variant="primary" fullWidth onClick={() => setStep('confirm')}>Review trade</Button>
                      <button type="button" onClick={() => setStep('configure')} className="w-full text-xs text-text-muted hover:text-text-secondary py-1">← Adjust</button>
                    </div>
                  )}
                  {step === 'confirm' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-amber/20 bg-amber/5 p-3 text-[11px] text-amber leading-relaxed flex gap-2">
                        <Shield className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                        This trade executes on Ethereum mainnet via your MetaMask wallet. Sentinel AI never holds your funds or accesses your private keys.
                      </div>
                      <Button variant="primary" fullWidth onClick={handleExecute}>Confirm in MetaMask →</Button>
                      <button type="button" onClick={() => setStep('quote')} className="w-full text-xs text-text-muted hover:text-text-secondary py-1">← Back</button>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 'executing' && (
                <motion.div key="executing" {...fadeUp} className="py-12 flex flex-col items-center text-center">
                  <Loader2 className="h-10 w-10 text-green animate-spin mb-4" />
                  <div className="font-display text-lg font-bold text-text-primary">
                    {tx.status === 'approving' ? 'Approving token…' : tx.status === 'pending' ? 'Waiting for MetaMask…' : 'Confirming on-chain…'}
                  </div>
                  <p className="text-sm text-text-muted mt-2 max-w-sm">
                    {tx.status === 'approving'
                      ? 'Approve the token spend in MetaMask, then the swap will execute.'
                      : tx.status === 'confirming'
                      ? 'Transaction submitted. Waiting for block confirmation.'
                      : 'Approve the transaction in your wallet to continue.'}
                  </p>
                  {tx.txHash && (
                    <a
                      href={`https://etherscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 text-xs font-mono text-blue hover:underline flex items-center gap-1"
                    >
                      View on Etherscan <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div key="success" {...fadeUp} className="py-12 flex flex-col items-center text-center">
                  <CheckCircle2 className="h-12 w-12 text-green mb-4" strokeWidth={1.5} />
                  <div className="font-display text-xl font-bold text-green">Trade submitted</div>
                  <p className="text-sm text-text-muted mt-2">
                    {amount} {fromToken} → {outputAmount} {toToken}
                  </p>
                  {tx.txHash && (
                    <a
                      href={`https://etherscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 text-xs font-mono text-blue hover:underline flex items-center gap-1"
                    >
                      {tx.txHash.slice(0, 20)}… <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <Button variant="ghost" fullWidth className="mt-6" onClick={handleReset}>New trade</Button>
                </motion.div>
              )}
            </AnimatePresence>

            {history.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border-subtle">
                <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Recent trades</div>
                <ul className="space-y-2">
                  {history.slice(0, 4).map((t) => (
                    <li key={t.id} className="text-[11px] font-mono text-text-muted">
                      {t.amount} {t.fromToken} → {t.toToken}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
