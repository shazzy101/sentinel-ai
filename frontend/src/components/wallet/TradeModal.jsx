import { useEffect, useState } from 'react';
import Spinner from '../ui/Spinner';
import { api } from '../../lib/api';
import { connectWallet, getWalletBalance, sendTransaction, formatWalletAddress } from '../../lib/web3';

const TOKEN_ADDRESSES = {
  ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

const TOKEN_DECIMALS = {
  ETH: 18, USDC: 6, USDT: 6, WBTC: 8, WETH: 18,
};

const FROM_TOKENS = ['ETH', 'USDC', 'USDT', 'WBTC'];
const TO_TOKENS = ['USDC', 'USDT', 'WBTC', 'ETH', 'WETH'];

function formatTokenAmount(rawAmount, tokenSymbol) {
  const decimals = TOKEN_DECIMALS[tokenSymbol] ?? 18;
  const value = Number(rawAmount) / Math.pow(10, decimals);
  if (!value) return '—';
  return value < 0.000001 ? value.toExponential(4) : value.toFixed(6);
}

/* ── Sub-components ─────────────────────────────── */
function TokenDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-bg-overlay rounded-lg px-3 py-2 hover:bg-bg-surface transition-colors"
      >
        <span className="text-[14px] font-bold text-text-primary">{value}</span>
        <span className="text-text-muted text-[12px]">▾</span>
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-bg-overlay border border-border-default rounded-lg z-20 min-w-[100px] overflow-hidden">
            {options.filter((o) => o !== value).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className="block w-full text-left px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
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

function DetailCell({ label, value }) {
  return (
    <div className="bg-bg-elevated rounded-lg p-2.5">
      <div className="text-[10px] uppercase text-text-muted mb-0.5">{label}</div>
      <div className="text-[12px] font-mono text-text-secondary">{value}</div>
    </div>
  );
}

/* ── Main component ─────────────────────────────── */
export default function TradeModal({ isOpen, onClose, defaultToken, ethPrice }) {
  const [step, setStep] = useState('configure');
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState(defaultToken?.symbol?.toUpperCase() || 'USDC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  // Reset on open/defaultToken change
  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      setQuote(null);
      setTxHash(null);
      setError(null);
      setAmount('');
      if (defaultToken?.symbol) {
        const sym = defaultToken.symbol.toUpperCase();
        setToToken(TO_TOKENS.includes(sym) ? sym : 'USDC');
      }
    }
  }, [isOpen, defaultToken?.symbol]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    try {
      setError(null);
      const addr = await connectWallet();
      setConnectedWallet(addr);
      const bal = await getWalletBalance(addr);
      setWalletBalance(bal);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGetQuote = async () => {
    if (!amount || !connectedWallet) return;
    setQuoteLoading(true);
    setError(null);
    try {
      const amountInWei = Math.floor(parseFloat(amount) * Math.pow(10, TOKEN_DECIMALS[fromToken] ?? 18)).toString();
      const data = await api.getSwapQuote(
        TOKEN_ADDRESSES[fromToken],
        TOKEN_ADDRESSES[toToken],
        amountInWei
      );
      if (data?.error || data?.message) throw new Error(data.error || data.message);
      setQuote(data);
      setStep('quote');
    } catch (err) {
      setError(`Quote failed: ${err.message}`);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleExecuteTrade = async () => {
    setStep('pending');
    setError(null);
    try {
      const hash = await sendTransaction({
        from: connectedWallet,
        to: quote.tx?.to,
        data: quote.tx?.data,
        value: quote.tx?.value,
        gas: quote.tx?.gas,
      });
      setTxHash(hash);
      setStep('success');
    } catch (err) {
      setError(err.message);
      setStep('quote');
    }
  };

  const usdValue = amount && ethPrice ? (parseFloat(amount) * (fromToken === 'ETH' ? ethPrice : 1)) : null;
  const priceImpact = quote?.priceImpact ?? 0;
  const impactHigh = priceImpact > 3;
  const impactExtreme = priceImpact > 10;

  return (
    <>
      {/* Backdrop */}
      <button type="button" aria-label="Close" className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-overlay border border-border-default rounded-xl w-[480px] z-50 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border-subtle">
          <div>
            <div className="font-display font-bold text-[16px] text-text-primary">Swap Tokens</div>
            <div className="text-[11px] text-text-muted mt-0.5">Powered by DefiLlama · Best rate across all DEXs</div>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors mt-0.5">✕</button>
        </div>

        <div className="px-6 py-5">

          {/* ── STEP: configure ─────────────────────── */}
          {step === 'configure' && (
            <div>
              {/* Wallet strip */}
              <div className="mb-4">
                {!connectedWallet ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border-default text-[13px] text-text-secondary hover:bg-bg-elevated transition-colors"
                  >
                    🦊 Connect MetaMask
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-bg-surface rounded-lg px-3 py-2 border border-green/20">
                    <div className="w-2 h-2 rounded-full bg-green flex-shrink-0" />
                    <span className="font-mono text-[12px] text-text-secondary">{formatWalletAddress(connectedWallet)}</span>
                    <span className="ml-auto font-mono text-[12px] text-text-primary font-medium">{walletBalance?.toFixed(4)} ETH</span>
                  </div>
                )}
              </div>

              {error && <div className="text-[12px] text-red mb-3 bg-red/5 border border-red/20 rounded-lg p-3">{error}</div>}

              {/* You pay */}
              <div className="mb-2">
                <div className="text-[11px] text-text-muted mb-1.5">You pay</div>
                <div className="bg-bg-elevated border border-border-default rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-transparent outline-none text-[24px] font-display font-bold text-text-primary w-full min-w-0"
                    />
                    <TokenDropdown value={fromToken} onChange={setFromToken} options={FROM_TOKENS} />
                  </div>
                  {usdValue != null && (
                    <div className="text-[11px] text-text-muted mt-1.5">
                      ≈ ${usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>

              {/* Swap direction button */}
              <div className="flex justify-center my-2">
                <button
                  type="button"
                  onClick={() => { setFromToken(toToken); setToToken(fromToken); }}
                  className="w-8 h-8 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center hover:bg-bg-surface hover:border-border-strong transition-all duration-300 hover:rotate-180"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-muted stroke-current">
                    <path d="M4 2L4 11M4 11L2 9M4 11L6 9" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 12L10 3M10 3L12 5M10 3L8 5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* You receive */}
              <div className="mb-4">
                <div className="text-[11px] text-text-muted mb-1.5">You receive</div>
                <div className="bg-bg-elevated border border-border-default rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-[24px] font-display font-bold text-text-muted w-full min-w-0 truncate">
                      {quote ? formatTokenAmount(quote.toAmount, toToken) : '—'}
                    </div>
                    <TokenDropdown value={toToken} onChange={setToToken} options={TO_TOKENS} />
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!amount || !connectedWallet || quoteLoading}
                onClick={handleGetQuote}
                className="w-full bg-green text-bg-base font-semibold text-[13px] py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {quoteLoading ? <><Spinner size="sm" /> Getting best rate...</> : 'Get Best Rate →'}
              </button>
            </div>
          )}

          {/* ── STEP: quote ─────────────────────────── */}
          {step === 'quote' && quote && (
            <div>
              {error && <div className="text-[12px] text-red mb-3 bg-red/5 border border-red/20 rounded-lg p-3">{error}</div>}

              <div className="bg-bg-surface border border-border-default rounded-xl p-4 mb-4">
                <div className="text-[12px] text-text-muted">Best Rate Found</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[15px] font-mono font-bold text-text-primary">{amount} {fromToken}</span>
                  <span className="text-text-muted mx-2">→</span>
                  <span className="text-[15px] font-mono font-bold text-green">{formatTokenAmount(quote.toAmount, toToken)} {toToken}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <DetailCell label="Exchange Rate" value={`1 ${fromToken} = ${formatTokenAmount(quote.toAmount, toToken)} ${toToken}`} />
                  <DetailCell label="Price Impact" value={`${(priceImpact ?? 0).toFixed(2)}%`} />
                  <DetailCell label="Est. Gas" value={quote.gasUsd ? `$${Number(quote.gasUsd).toFixed(2)}` : '—'} />
                  <DetailCell label="Route" value={quote.aggregator || quote.exchange || 'Best DEX'} />
                </div>

                {/* Route badges */}
                {quote.protocols?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {quote.protocols.flat(2).map((p, i) => (
                      <span key={i} className="bg-bg-overlay text-[10px] px-1.5 py-0.5 rounded text-text-muted">
                        {p?.name || p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price impact warning */}
              {impactExtreme && (
                <div className="flex gap-2 rounded-lg p-3 mb-4 border" style={{ background: 'rgba(255,77,77,0.08)', borderColor: 'rgba(255,77,77,0.25)' }}>
                  <span>⛔</span>
                  <span className="text-[12px]" style={{ color: '#FF4D4D' }}>
                    Extreme price impact ({priceImpact.toFixed(1)}%). This trade will lose significant value. Consider a much smaller amount.
                  </span>
                </div>
              )}
              {impactHigh && !impactExtreme && (
                <div className="flex gap-2 rounded-lg p-3 mb-4 border" style={{ background: 'rgba(245,166,35,0.08)', borderColor: 'rgba(245,166,35,0.25)' }}>
                  <span>⚠️</span>
                  <span className="text-[12px]" style={{ color: '#F5A623' }}>
                    High price impact ({priceImpact.toFixed(1)}%). Consider a smaller trade size.
                  </span>
                </div>
              )}

              <button type="button" onClick={() => setStep('confirm')} className="w-full bg-green text-bg-base font-semibold text-[13px] py-2.5 rounded-lg hover:opacity-90 transition-all">
                Review Trade
              </button>
              <button type="button" onClick={() => setStep('configure')} className="w-full mt-2 text-[12px] text-text-muted hover:text-text-secondary transition-colors py-1">
                ← Adjust
              </button>
            </div>
          )}

          {/* ── STEP: confirm ───────────────────────── */}
          {step === 'confirm' && (
            <div>
              {/* Summary */}
              <div className="bg-bg-surface border border-border-default rounded-xl p-4 mb-4">
                <div className="text-[12px] text-text-muted mb-2">Confirm Trade</div>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-mono font-bold text-text-primary">{amount} {fromToken}</span>
                  <span className="text-text-muted mx-2">→</span>
                  <span className="text-[15px] font-mono font-bold text-green">{formatTokenAmount(quote?.toAmount, toToken)} {toToken}</span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="rounded-lg p-3 mb-4 border" style={{ background: 'rgba(245,166,35,0.06)', borderColor: 'rgba(245,166,35,0.2)' }}>
                <p className="text-[11px] leading-relaxed" style={{ color: '#F5A623' }}>
                  This trade will be executed on Ethereum mainnet via your MetaMask wallet. Sentinel AI does not hold your funds or have access to your wallet. You are solely responsible for this transaction. Crypto trading involves significant risk.
                </p>
              </div>

              <button type="button" onClick={handleExecuteTrade} className="w-full bg-green text-bg-base font-semibold text-[13px] py-2.5 rounded-lg hover:opacity-90 transition-all">
                Confirm in MetaMask →
              </button>
              <div className="text-[10px] text-text-muted text-center mt-2">You&apos;ll approve this in MetaMask</div>
              <button type="button" onClick={() => setStep('quote')} className="w-full mt-2 text-[12px] text-text-muted hover:text-text-secondary transition-colors py-1">
                ← Back
              </button>
            </div>
          )}

          {/* ── STEP: pending ───────────────────────── */}
          {step === 'pending' && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="w-12 h-12 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
              <div className="font-display text-[16px] font-bold text-text-primary mt-4">Waiting for confirmation...</div>
              <div className="text-[13px] text-text-muted mt-2">Your transaction has been submitted to MetaMask.</div>
            </div>
          )}

          {/* ── STEP: success ───────────────────────── */}
          {step === 'success' && (
            <div className="flex flex-col items-center py-6 text-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-green">
                <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="2" />
                <path d="M14 24L21 31L34 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="font-display text-[20px] font-bold text-green mt-4">Trade Successful!</div>
              <div className="text-[13px] text-text-muted mt-2">Transaction confirmed on Ethereum</div>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-blue hover:underline mt-3 block"
                >
                  View on Etherscan ↗
                </a>
              )}
              <button type="button" onClick={onClose} className="w-full mt-6 border border-border-default text-text-secondary text-[13px] px-4 py-2 rounded-lg hover:bg-bg-elevated transition-colors">
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
