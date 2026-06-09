import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWatchlist, useScanWallet } from '../hooks/useWatchlist';
import { useAlertEngine } from './Alerts';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { ToastStack } from '../components/ui/Toast';
import ScanIsland from '../components/ui/scan-island';
import WalletTable from '../components/wallet/WalletTable';
import WalletDetailPanel from '../components/wallet/WalletDetailPanel';
import AddWalletModal from '../components/wallet/AddWalletModal';
import TradeModal from '../components/wallet/TradeModal';
import { BentoGrid, BentoItem } from '../components/primitives/BentoGrid';
import StatWidget from '../components/primitives/StatWidget';
import { TrendingUp, TrendingDown, Award, BarChart2 } from 'lucide-react';

const EXCHANGE_NAMES = [
  'Binance', 'Coinbase', 'Kraken', 'KuCoin', 'OKX', 'Crypto.com', 'Gemini',
  'Bitstamp', 'Coinone', 'MEV Bot', 'Poloniex', 'Bittrex', 'Huobi', 'Gate.io',
  'Bitfinex', 'Bithumb', 'Bybit', 'BitMEX', 'Upbit', 'Korbit', 'FTX',
];

function isExchangeWallet(w) {
  const label = (w.label || '').toLowerCase();
  return EXCHANGE_NAMES.some((n) => label.includes(n.toLowerCase()))
    || label.includes('deposit funder')
    || label.includes('hot wallet');
}

const SORT_LABEL = {
  score: 'Score ↓',
  balance: 'Balance ↓',
  ytd: 'YTD ↓',
  name: 'Name A–Z',
  lastActive: 'Last Active',
};

const SIGNAL_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'bullish', label: 'Bullish' },
  { key: 'bearish', label: 'Bearish' },
  { key: 'neutral', label: 'Neutral' },
];

// Stage messages shown in the filter bar while a scan is running
const STAGE_MESSAGES = {
  fetching_onchain: '⛓ Pulling on-chain transactions...',
  analyzing: '🤖 Running Claude AI analysis...',
  complete: '✓ Scan complete',
  error: '✕ Scan failed',
};

function filterButtonClass(isActive) {
  if (isActive) return 'text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors select-none bg-bg-elevated border-border-strong text-text-primary';
  return 'text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors select-none bg-transparent border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default';
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function WatchlistPage() {
  const { wallets, loading, error, refetch } = useWatchlist();
  const { scan, loading: isScanning, activeAddress, stage } = useScanWallet();
  useAlertEngine(wallets);

  useEffect(() => { document.title = 'Watchlist — Sentinel AI'; }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [signalFilter, setSignalFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [smartMoneyOnly, setSmartMoneyOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showTop100, setShowTop100] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [scanningIds, setScanningIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef(null);
  const [isRescanningAll, setIsRescanningAll] = useState(false);
  const [isBatchIngesting, setIsBatchIngesting] = useState(false);

  // Open add-wallet modal from App-level topbar button
  useEffect(() => {
    const openModal = () => setIsAddModalOpen(true);
    window.addEventListener('open-add-wallet', openModal);
    return () => window.removeEventListener('open-add-wallet', openModal);
  }, []);

  // Close sort dropdown on outside click or Escape
  useEffect(() => {
    const onClickOutside = (event) => {
      if (!sortMenuRef.current) return;
      if (!sortMenuRef.current.contains(event.target)) setSortOpen(false);
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setSortOpen(false);
        setSelectedWallet(null);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  // Show alert-fired events as toasts
  useEffect(() => {
    const onAlert = (e) => addToast(`🔔 ${e.detail.message}`, 'info');
    window.addEventListener('sentinel-alert-fired', onAlert);
    return () => window.removeEventListener('sentinel-alert-fired', onAlert);
  }, [addToast]);

  const handleBatchIngest = useCallback(async () => {
    if (isBatchIngesting) return;
    setIsBatchIngesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/batch-ingest?limit=500`, { method: 'POST' });
      const json = await res.json();
      const queued = json?.data?.queued ?? 0;
      addToast(`Scanning ${queued} whale wallets via Etherscan…`, 'success');
      setTimeout(() => refetch(), 15000);
    } catch {
      addToast('Batch ingest failed — check backend connection', 'error');
    } finally {
      setIsBatchIngesting(false);
    }
  }, [isBatchIngesting, refetch, addToast]);

  const handleRescanAll = useCallback(async () => {
    if (isRescanningAll) return;
    setIsRescanningAll(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/rescan-all`, { method: 'POST' });
      const json = await res.json();
      const count = json?.data?.queued ?? wallets.length;
      addToast(`Rescanning ${count} wallets with v3 scoring engine…`, 'success');
      setTimeout(() => { refetch(); }, 10000);
    } catch {
      addToast('Rescan failed — check backend connection', 'error');
    } finally {
      setIsRescanningAll(false);
    }
  }, [isRescanningAll, wallets.length, refetch, addToast]);

  const filteredWallets = useMemo(() => wallets
    .filter((w) => {
      const name = (w.label || '').toLowerCase();
      const address = (w.address || '').toLowerCase();
      const matchesSearch = !searchQuery
        || name.includes(searchQuery.toLowerCase())
        || address.includes(searchQuery.toLowerCase());
      const matchesSignal = signalFilter === 'all' || w.signal === signalFilter.toUpperCase();
      const matchesSmartMoney = !smartMoneyOnly || (
        !isExchangeWallet(w) && (w.score ?? 0) >= 60
      );
      return matchesSearch && matchesSignal && matchesSmartMoney;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'balance') return (b.balance ?? 0) - (a.balance ?? 0);
      if (sortBy === 'name') return (a.label || '').localeCompare(b.label || '');
      if (sortBy === 'ytd') return (b.ytd_growth_pct ?? -999) - (a.ytd_growth_pct ?? -999);
      return new Date(b.last_scanned || 0).getTime() - new Date(a.last_scanned || 0).getTime();
    }), [wallets, searchQuery, signalFilter, sortBy, smartMoneyOnly]);

  const displayWallets = useMemo(() => {
    const limited = showTop100 ? filteredWallets.slice(0, 100) : filteredWallets;
    return showAll ? limited : limited.slice(0, 50);
  }, [filteredWallets, showAll, showTop100]);

  // Keep selected wallet in sync after refetch
  useEffect(() => {
    if (!selectedWallet?.address) return;
    const next = wallets.find((w) => w.address === selectedWallet.address);
    if (next) setSelectedWallet(next);
  }, [wallets, selectedWallet?.address]);

  const handleScan = useCallback(async (wallet) => {
    const addr = wallet.address;
    setScanningIds((prev) => { const s = new Set(prev); s.add(addr); return s; });
    try {
      const result = await scan(addr, wallet.label);
      await refetch();
      addToast(`${wallet.label || 'Wallet'} scanned — score ${result?.wallet?.score ?? '?'}`, 'success');
    } catch (err) {
      addToast(err.message || 'Scan failed', 'error');
    } finally {
      setScanningIds((prev) => { const s = new Set(prev); s.delete(addr); return s; });
    }
  }, [scan, refetch, addToast]);

  const handleRemoveWallet = useCallback(async () => {
    if (!selectedWallet) return;
    const label = selectedWallet.label || selectedWallet.address;
    setSelectedWallet(null);
    await refetch();
    addToast(`${label} removed from watchlist`, 'info');
  }, [selectedWallet, refetch, addToast]);

  const handleSelectWallet = useCallback((wallet) => {
    setSelectedWallet((prev) => prev?.address === wallet.address ? null : wallet);
  }, []);

  const scanStageMessage = isScanning && activeAddress && stage !== 'idle'
    ? STAGE_MESSAGES[stage] || 'Scanning...'
    : null;

  return (
    <div className="h-full min-h-0 flex flex-col">

      {/* Filter bar */}
      <div className="flex-shrink-0 px-4 py-3 md:px-5">
        <div className="glass-surface flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 shadow-card">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5 pointer-events-none" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search wallets..."
            className="w-[200px] bg-bg-elevated border border-border-default rounded-lg pl-8 pr-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:border-border-focus transition-colors font-mono"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Signal filter pills */}
        <div className="flex gap-1.5">
          {SIGNAL_FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSignalFilter(option.key)}
              className={filterButtonClass(signalFilter === option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Top 100 toggle */}
        <button
          type="button"
          onClick={() => setShowTop100((prev) => !prev)}
          className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors select-none ${
            showTop100
              ? 'bg-blue/10 border-blue/30 text-blue'
              : 'border-border-subtle text-text-muted hover:text-text-secondary'
          }`}
        >
          Top 100
        </button>

        {/* Smart Money filter */}
        <button
          type="button"
          onClick={() => { setSmartMoneyOnly((prev) => !prev); setShowAll(false); }}
          className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors select-none ${
            smartMoneyOnly
              ? 'bg-green/10 border-green/30 text-green'
              : 'border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default'
          }`}
        >
          {smartMoneyOnly ? `◈ Smart Money · ${filteredWallets.length}` : 'Show all wallets'}
        </button>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-2 relative" ref={sortMenuRef}>
          <button
            type="button"
            onClick={() => setSortOpen((prev) => !prev)}
            className="flex items-center gap-2 text-[12px] text-text-secondary bg-bg-overlay border border-border-default rounded-lg px-3 py-1.5 min-w-[130px] hover:border-border-strong transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-muted flex-shrink-0">
              <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="flex-1 text-left">{SORT_LABEL[sortBy]}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`text-text-muted transition-transform ${sortOpen ? 'rotate-180' : ''}`}>
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {sortOpen ? (
            <div className="absolute top-9 right-0 bg-bg-overlay border border-border-default rounded-lg text-[12px] text-text-secondary min-w-[130px] z-20 shadow-xl overflow-hidden">
              {Object.entries(SORT_LABEL).map(([key, lbl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSortBy(key); setSortOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-bg-elevated transition-colors ${sortBy === key ? 'text-green' : ''}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          ) : null}

          <span className="text-[11px] text-text-muted whitespace-nowrap px-1">
            {filteredWallets.length}<span className="opacity-40"> / {wallets.length}</span>
            {smartMoneyOnly && filteredWallets.length < 5 && (
              <span className="text-amber ml-1" title="Turn off Smart Money Only to see all tracked wallets">· few match</span>
            )}
          </span>

          <button
            type="button"
            onClick={handleBatchIngest}
            disabled={isBatchIngesting}
            title="Discover and scan up to 500 top whale wallets via Etherscan"
            className="flex items-center gap-1.5 text-[11px] text-green border border-green/30 rounded-lg px-2.5 py-1.5 hover:bg-green/10 transition-colors disabled:opacity-40"
          >
            {isBatchIngesting ? <Spinner size="sm" /> : 'Scan 500'}
          </button>

          <button
            type="button"
            onClick={handleRescanAll}
            disabled={isRescanningAll}
            title="Apply new scoring engine to all wallets"
            className="flex items-center gap-1.5 text-[11px] text-text-muted border border-border-subtle rounded-lg px-2.5 py-1.5 hover:border-border-default hover:text-text-secondary transition-colors disabled:opacity-40"
          >
            {isRescanningAll ? <Spinner size="sm" /> : (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M9.5 3.5A4 4 0 1 0 10 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M10 1.5v2.5H7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            Rescan All
          </button>

          <button
            type="button"
            onClick={() => setTradeOpen(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary border border-border-default rounded-lg px-2.5 py-1.5 hover:bg-bg-elevated transition-colors"
          >
            ⚡ Trade
          </button>

          <Button variant="icon" onClick={refetch} disabled={loading} aria-label="Refresh watchlist">
            {loading ? <Spinner size="sm" /> : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
                <path d="M11.7 5A5 5 0 1 0 12 7" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M12 2.5V5.5H9" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </Button>
        </div>
        </div>
      </div>

      {/* Quick stats — bento dashboard strip */}
      {wallets.length > 0 && (
        <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.04]">
          <BentoGrid cols={4} className="gap-2">
            <BentoItem delay={0}>
              <StatWidget
                label="Avg Score"
                value={Math.round(wallets.reduce((a, w) => a + (w.score ?? 0), 0) / wallets.length)}
                icon={BarChart2}
              />
            </BentoItem>
            <BentoItem delay={0.04}>
              <StatWidget
                label="Bullish"
                value={wallets.filter((w) => w.signal === 'BULLISH').length}
                sub="signals"
                icon={TrendingUp}
              />
            </BentoItem>
            <BentoItem delay={0.08}>
              <StatWidget
                label="Bearish"
                value={wallets.filter((w) => w.signal === 'BEARISH').length}
                sub="signals"
                icon={TrendingDown}
              />
            </BentoItem>
            <BentoItem delay={0.12}>
              <StatWidget
                label="Top Wallet"
                value={[...wallets].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.label?.split(' ')[0] || '—'}
                animate={false}
                icon={Award}
              />
            </BentoItem>
          </BentoGrid>
        </div>
      )}

      <ScanIsland
        visible={Boolean(scanStageMessage)}
        message={scanStageMessage || ''}
        address={activeAddress}
      />

      {/* Main area: table + detail panel */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0 p-5">
          <WalletTable
            wallets={displayWallets}
            loading={loading}
            error={error}
            selectedWallet={selectedWallet}
            scanningIds={scanningIds}
            onSelectWallet={handleSelectWallet}
            onScanWallet={handleScan}
            onRetry={refetch}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
          {!showAll && filteredWallets.length > 50 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full py-3 text-[12px] text-text-muted hover:text-text-secondary border-t border-border-subtle text-center hover:bg-bg-elevated transition-colors"
            >
              Show all {filteredWallets.length} wallets ↓
            </button>
          )}
        </div>
        <div
          className={`flex-shrink-0 h-full transition-all duration-200 ease-out ${
            selectedWallet ? 'w-[400px]' : 'w-0'
          } overflow-hidden`}
        >
          {selectedWallet && (
            <WalletDetailPanel
              wallet={selectedWallet}
              onClose={() => setSelectedWallet(null)}
              onRescan={() => handleScan(selectedWallet)}
              onRemove={handleRemoveWallet}
            />
          )}
        </div>
      </div>

      <AddWalletModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        isScanning={isScanning}
        onSubmit={async ({ address, label, tags }) => {
          setIsAddModalOpen(false);
          await handleScan({ address, label: label || address.slice(0, 10), chain: 'ethereum', tags });
        }}
      />

      <TradeModal isOpen={tradeOpen} onClose={() => setTradeOpen(false)} />
      <ToastStack items={toasts} onDismiss={removeToast} />
    </div>
  );
}
