import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWatchlist, useScanWallet } from '../hooks/useWatchlist';
import { useCopyTraders } from '../hooks/useCopyTraders';
import { useAlertEngine } from './Alerts';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { ToastStack } from '../components/ui/Toast';
import ScanIsland from '../components/ui/scan-island';
import WalletTable from '../components/wallet/WalletTable';
import CopyTraderTable from '../components/wallet/CopyTraderTable';
import WalletDetailPanel from '../components/wallet/WalletDetailPanel';
import CopyTraderDetailPanel from '../components/wallet/CopyTraderDetailPanel';
import AddWalletModal from '../components/wallet/AddWalletModal';
import TradeModal from '../components/wallet/TradeModal';
import { BentoGrid, BentoItem } from '../components/primitives/BentoGrid';
import StatWidget from '../components/primitives/StatWidget';
import { TrendingUp, TrendingDown, Award, BarChart2, Users, Target, Wallet, Lock, Zap } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { api } from '../lib/api';
import { useAuth } from '@/context/AuthProvider';
import PaywallGate from '@/components/auth/PaywallGate';

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

const COPY_SORT_LABEL = {
  copy_score: 'Copy Score ↓',
  win_rate: 'Win Rate ↓',
  profit_factor: 'Profit Factor ↓',
  track_record: 'Track Record ↓',
  drawdown: 'Low Drawdown ↑',
  duration: 'Duration ↓',
};

const SIGNAL_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'bullish', label: 'Bullish' },
  { key: 'bearish', label: 'Bearish' },
  { key: 'neutral', label: 'Neutral' },
];

// Stage messages shown in the filter bar while a scan is running
const STAGE_MESSAGES = {
  fetching_onchain: 'Pulling on-chain transactions...',
  analyzing: 'Running Claude AI analysis...',
  complete: 'Scan complete',
  error: 'Scan failed',
};

function filterButtonClass(isActive) {
  if (isActive) return 'text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors select-none bg-bg-elevated border-border-strong text-text-primary';
  return 'text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors select-none bg-transparent border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default';
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function WatchlistPage() {
  const { isPro, isTrialing, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('copy'); // copy | watchlist
  const [strictCopyFilter, setStrictCopyFilter] = useState(true);
  const [copySortBy, setCopySortBy] = useState('copy_score');
  const [trackingId, setTrackingId] = useState(null);
  const { wallets, loading, error, refetch } = useWatchlist({ enabled: true });
  const {
    wallets: copyTraders,
    totalQualified,
    totalInDataset,
    loading: copyLoading,
    error: copyError,
    refetch: refetchCopy,
  } = useCopyTraders({
    enabled: viewMode === 'copy',
    limit: 300,
    sort: copySortBy,
    strict: strictCopyFilter,
  });
  const { scan, loading: isScanning, activeAddress, stage } = useScanWallet();
  useAlertEngine(wallets);

  useEffect(() => { document.title = 'Watchlist — Hadaleum'; }, []);

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
    const onAlert = (e) => addToast(e.detail.message, 'info');
    window.addEventListener('sentinel-alert-fired', onAlert);
    return () => window.removeEventListener('sentinel-alert-fired', onAlert);
  }, [addToast]);

  const handleBatchIngest = useCallback(async () => {
    if (isBatchIngesting) return;
    setIsBatchIngesting(true);
    try {
      const json = await apiFetch('/api/admin/batch-ingest?limit=500', { method: 'POST', timeoutMs: 30000 });
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
      const json = await apiFetch('/api/admin/rescan-all', { method: 'POST', timeoutMs: 30000 });
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
    if (!isPro && !isTrialing) return filteredWallets.slice(0, 10);
    const limited = showTop100 ? filteredWallets.slice(0, 100) : filteredWallets;
    return showAll ? limited : limited.slice(0, 50);
  }, [filteredWallets, showAll, showTop100, isPro, isTrialing]);

  const filteredCopyTraders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return copyTraders.filter((w) => {
      if (!q) return true;
      return (w.label || '').toLowerCase().includes(q)
        || (w.address || '').toLowerCase().includes(q);
    });
  }, [copyTraders, searchQuery]);

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

  const handleTrackCopyTrader = useCallback(async (trader) => {
    if (!trader?.address) return;
    if (trackingId === trader.address) return;
    setTrackingId(trader.address);
    setIsAddModalOpen(false);
    try {
      const body = await api.trackCopyTrader(trader.address);
      if (!body.success) {
        throw new Error(body.error?.message || 'Failed to track wallet');
      }
      await refetch();
      setViewMode('watchlist');
      setSelectedWallet(body.data?.wallet || trader);
      addToast(
        body.data?.already_tracked
          ? `${trader.label || 'Trader'} is already on your watchlist`
          : `${trader.label || 'Trader'} added — scan & AI analysis running in background`,
        'success',
      );
    } catch (err) {
      addToast(err.message || 'Failed to track wallet', 'error');
    } finally {
      setTrackingId(null);
    }
  }, [refetch, addToast, trackingId]);

  const handleUntrackCopyTrader = useCallback(async (trader) => {
    const label = trader?.label || trader?.address || 'Wallet';
    setSelectedWallet(null);
    await refetch();
    addToast(`${label} removed from watchlist`, 'info');
  }, [refetch, addToast]);

  const trackedAddresses = useMemo(
    () => new Set(wallets.map((w) => (w.address || '').toLowerCase())),
    [wallets],
  );

  // Deep-link: /watchlist?tab=watchlist&add=0x... or ?upgraded=1 after Stripe
  const addHandled = useRef(false);
  const upgradeHandled = useRef(false);
  useEffect(() => {
    const tab = searchParams.get('tab');
    const add = searchParams.get('add');
    const upgraded = searchParams.get('upgraded');
    if (tab === 'watchlist') setViewMode('watchlist');
    else if (tab === 'copy') setViewMode('copy');
    if (upgraded === '1' && !upgradeHandled.current) {
      upgradeHandled.current = true;
      refreshProfile?.();
      addToast('Welcome to Hadaleum Pro — full access unlocked', 'success');
      setSearchParams({}, { replace: true });
    }
    if (add && !addHandled.current) {
      addHandled.current = true;
      const addr = add.toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(addr)) {
        api.getCopyTrader(addr).then((t) => {
          if (t) handleTrackCopyTrader(t);
          else addToast('Address not found in copy-trader rankings', 'error');
        });
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, handleTrackCopyTrader, addToast, refreshProfile]);

  const scanStageMessage = isScanning && activeAddress && stage !== 'idle'
    ? STAGE_MESSAGES[stage] || 'Scanning...'
    : null;

  return (
    <div className="h-full min-h-0 flex flex-col">

      {/* Filter bar — z-40 so sort dropdown sits above stat cards */}
      <div className="flex-shrink-0 px-4 py-3 md:px-5 relative z-40">
        <div className="glass-surface flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 shadow-card overflow-visible">
        {/* View mode tabs */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-bg-elevated border border-border-subtle">
          {[
            { key: 'copy', label: 'Copy Traders', count: totalQualified, accent: 'green' },
            { key: 'watchlist', label: 'My Watchlist', count: wallets.length, accent: 'blue' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setViewMode(tab.key); setSelectedWallet(null); }}
              className={`text-[11px] px-3 py-1.5 rounded-md transition-colors ${
                viewMode === tab.key
                  ? tab.accent === 'green'
                    ? 'bg-green/15 text-green border border-green/25 font-semibold'
                    : 'bg-blue/15 text-blue border border-blue/25 font-semibold'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 opacity-70">{tab.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>

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

        {viewMode === 'watchlist' && (
          <>
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
            <button
              type="button"
              onClick={() => { setSmartMoneyOnly((prev) => !prev); setShowAll(false); }}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors select-none ${
                smartMoneyOnly
                  ? 'bg-green/10 border-green/30 text-green'
                  : 'border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default'
              }`}
            >
              {smartMoneyOnly ? `Smart Money · ${filteredWallets.length}` : 'Show all wallets'}
            </button>
          </>
        )}
        {viewMode === 'copy' && (
          <>
            <button
              type="button"
              onClick={() => setStrictCopyFilter((p) => !p)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors select-none ${
                strictCopyFilter
                  ? 'bg-green/10 border-green/30 text-green'
                  : 'border-border-subtle text-text-muted hover:text-text-secondary'
              }`}
              title="Win rate ≥60%, profit factor ≥2, track record ≥90 days"
            >
              {strictCopyFilter ? 'Strict filters on' : 'Strict filters'}
            </button>
            <span className="text-[10px] text-text-muted hidden sm:inline">
              {totalInDataset.toLocaleString()} ranked · bots filtered
            </span>
          </>
        )}

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
            <span className="flex-1 text-left">
              {viewMode === 'copy' ? COPY_SORT_LABEL[copySortBy] : SORT_LABEL[sortBy]}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`text-text-muted transition-transform ${sortOpen ? 'rotate-180' : ''}`}>
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {sortOpen ? (
            <div className="absolute top-full mt-1 right-0 bg-bg-overlay border border-border-default rounded-lg text-[12px] text-text-secondary min-w-[160px] z-50 shadow-2xl overflow-hidden">
              {Object.entries(viewMode === 'copy' ? COPY_SORT_LABEL : SORT_LABEL).map(([key, lbl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (viewMode === 'copy') setCopySortBy(key);
                    else setSortBy(key);
                    setSortOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-bg-elevated transition-colors ${
                    (viewMode === 'copy' ? copySortBy : sortBy) === key ? 'text-green' : ''
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          ) : null}

          <span className="text-[11px] text-text-muted whitespace-nowrap px-1">
            {viewMode === 'copy'
              ? `${filteredCopyTraders.length} shown`
              : (
                <>
                  {filteredWallets.length}<span className="opacity-40"> / {wallets.length}</span>
                  {smartMoneyOnly && filteredWallets.length < 5 && (
                    <span className="text-amber ml-1">· few match</span>
                  )}
                </>
              )}
          </span>

          {import.meta.env.DEV && viewMode === 'watchlist' && (
            <>
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
                {isRescanningAll ? <Spinner size="sm" /> : 'Rescan All'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setTradeOpen(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary border border-border-default rounded-lg px-2.5 py-1.5 hover:bg-bg-elevated transition-colors"
          >
            <Zap className="h-3 w-3" /> Trade
          </button>

          <Button
            variant="icon"
            onClick={() => (viewMode === 'copy' ? refetchCopy() : refetch())}
            disabled={viewMode === 'copy' ? copyLoading : loading}
            aria-label="Refresh"
          >
            {(viewMode === 'copy' ? copyLoading : loading) ? <Spinner size="sm" /> : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
                <path d="M11.7 5A5 5 0 1 0 12 7" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M12 2.5V5.5H9" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </Button>
        </div>
        </div>
      </div>

      {/* Section banner — distinct identity per tab */}
      <div className={`flex-shrink-0 px-5 py-2 border-b ${
        viewMode === 'copy' ? 'border-green/10 bg-green/[0.03]' : 'border-blue/10 bg-blue/[0.03]'
      }`}>
        {viewMode === 'copy' ? (
          <div className="flex items-center gap-2 text-[12px]">
            <Target className="h-3.5 w-3.5 text-green shrink-0" />
            <span className="text-text-secondary">
              <span className="text-green font-medium">Copy Traders</span>
              {' — '}
              {totalQualified.toLocaleString()} human DEX traders ranked by win rate, profit factor & track record. Bots filtered.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[12px]">
            <Wallet className="h-3.5 w-3.5 text-blue shrink-0" />
            <span className="text-text-secondary">
              <span className="text-blue font-medium">My Watchlist</span>
              {' — '}
              Your tracked whales & smart-money wallets with AI scoring and on-chain signals.
            </span>
          </div>
        )}
      </div>

      {/* Quick stats */}
      {viewMode === 'copy' && copyTraders.length > 0 && (
        <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.04] relative z-0">
          <BentoGrid cols={4} className="gap-2">
            <BentoItem delay={0}>
              <StatWidget label="Qualified" value={totalQualified} sub="DEX traders" icon={Users} />
            </BentoItem>
            <BentoItem delay={0.04}>
              <StatWidget
                label="Avg Win Rate"
                value={`${(copyTraders.reduce((a, w) => a + ((w.metrics?.unrealized_win_rate_pct ?? w.metrics?.win_rate_pct) ?? 0), 0) / Math.max(copyTraders.length, 1)).toFixed(1)}%`}
                animate={false}
                icon={TrendingUp}
              />
            </BentoItem>
            <BentoItem delay={0.08}>
              <StatWidget
                label="Avg PF"
                value={(copyTraders.reduce((a, w) => a + (w.metrics?.profit_factor ?? 0), 0) / copyTraders.length).toFixed(1)}
                animate={false}
                icon={BarChart2}
              />
            </BentoItem>
            <BentoItem delay={0.12}>
              <StatWidget label="#1 Trader" value={`#${copyTraders[0]?.rank ?? 1}`} animate={false} icon={Award} />
            </BentoItem>
          </BentoGrid>
        </div>
      )}
      {viewMode === 'watchlist' && wallets.length > 0 && (
        <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.04] relative z-0">
          <BentoGrid cols={4} className="gap-2">
            <BentoItem delay={0}>
              <StatWidget
                label="Avg Score"
                value={Math.round(wallets.reduce((a, w) => a + (w.score ?? 0), 0) / wallets.length)}
                icon={BarChart2}
              />
            </BentoItem>
            <BentoItem delay={0.04}>
              <StatWidget label="Bullish" value={wallets.filter((w) => w.signal === 'BULLISH').length} sub="signals" icon={TrendingUp} />
            </BentoItem>
            <BentoItem delay={0.08}>
              <StatWidget label="Bearish" value={wallets.filter((w) => w.signal === 'BEARISH').length} sub="signals" icon={TrendingDown} />
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

      {/* Main area — table stays full width; detail opens as overlay */}
      <div className="flex-1 min-h-0 p-5 overflow-hidden">
        {viewMode === 'copy' ? (
          <CopyTraderTable
            wallets={filteredCopyTraders}
            loading={copyLoading}
            error={copyError}
            selectedWallet={selectedWallet}
            onSelectWallet={handleSelectWallet}
            onRetry={refetchCopy}
            totalQualified={totalQualified}
            trackedAddresses={trackedAddresses}
            lockedCount={(!isPro && !isTrialing && !searchQuery) ? Math.max(0, (totalQualified || 0) - filteredCopyTraders.length) : 0}
            onUpgrade={() => navigate('/upgrade')}
          />
        ) : (
          <>
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
            {!isPro && !isTrialing ? (
              <div className="relative border-t border-border-subtle">
                {/* Blurred teaser rows hinting at locked wallets */}
                <div className="pointer-events-none select-none blur-[5px] opacity-40" aria-hidden="true">
                  {[92, 88, 85].map((score, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
                      <span className="text-[11px] text-text-muted font-mono w-5">{11 + i}</span>
                      <div className="flex-1 h-3 rounded bg-bg-elevated" style={{ maxWidth: `${60 - i * 8}%` }} />
                      <span className="text-[12px] font-mono font-bold text-green">{score}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-gradient-to-b from-transparent via-bg-base/80 to-bg-base">
                  <Lock className="h-5 w-5 text-green mb-2" strokeWidth={1.75} />
                  <div className="font-display text-[15px] font-bold text-text-primary">
                    {Math.max(0, (filteredWallets.length || 2796) - 10).toLocaleString()} more ranked wallets locked
                  </div>
                  <p className="text-[12px] text-text-muted mt-1 mb-3 max-w-xs">
                    You're seeing the top 10. Pro unlocks every elite wallet, sorted by intelligence score.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/upgrade')}
                    className="rounded-xl bg-green px-5 py-2.5 text-[13px] font-semibold text-text-inverse hover:bg-green-bright transition-colors"
                    style={{ boxShadow: '0 0 0 1px rgba(0,217,146,0.3), 0 4px 20px rgba(0,217,146,0.2)' }}
                  >
                    Unlock all wallets — Free for 7 days →
                  </button>
                </div>
              </div>
            ) : (
              !showAll && filteredWallets.length > 50 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full py-3 text-[12px] text-text-muted hover:text-text-secondary border-t border-border-subtle text-center hover:bg-bg-elevated transition-colors"
                >
                  Show all {filteredWallets.length} wallets ↓
                </button>
              )
            )}
          </>
        )}
      </div>

      {selectedWallet && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedWallet(null)}
            aria-hidden="true"
          />
          <div className="fixed right-0 top-0 bottom-0 w-[min(520px,92vw)] z-50 animate-in slide-in-from-right duration-200">
            {viewMode === 'copy' ? (
              <CopyTraderDetailPanel
                wallet={selectedWallet}
                onClose={() => setSelectedWallet(null)}
                onTrack={handleTrackCopyTrader}
                onUntrack={handleUntrackCopyTrader}
                isTracked={trackedAddresses.has((selectedWallet.address || '').toLowerCase())}
                isTracking={trackingId === selectedWallet.address}
              />
            ) : (
              <WalletDetailPanel
                wallet={selectedWallet}
                onClose={() => setSelectedWallet(null)}
                onRescan={() => handleScan(selectedWallet)}
                onRemove={handleRemoveWallet}
              />
            )}
          </div>
        </>
      )}

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
