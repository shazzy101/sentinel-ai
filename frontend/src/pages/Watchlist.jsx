import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWatchlist, useScanWallet } from '../hooks/useWatchlist';
import { useAlertEngine } from './Alerts';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { ToastStack } from '../components/ui/Toast';
import WalletTable from '../components/wallet/WalletTable';
import WalletDetailPanel from '../components/wallet/WalletDetailPanel';
import AddWalletModal from '../components/wallet/AddWalletModal';

const SORT_LABEL = {
  score: 'Score ↓',
  balance: 'Balance ↓',
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
  if (isActive) return 'text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors bg-bg-elevated border-border-strong text-text-primary';
  return 'text-[11px] px-2.5 py-1 rounded-md border cursor-pointer transition-colors bg-transparent border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default';
}

export default function WatchlistPage() {
  const { wallets, loading, error, refetch } = useWatchlist();
  const { scan, loading: isScanning, activeAddress, stage } = useScanWallet();
  useAlertEngine(wallets);

  const [searchQuery, setSearchQuery] = useState('');
  const [signalFilter, setSignalFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [scanningIds, setScanningIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef(null);

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

  const filteredWallets = useMemo(() => wallets
    .filter((w) => {
      const name = (w.label || '').toLowerCase();
      const address = (w.address || '').toLowerCase();
      const matchesSearch = !searchQuery
        || name.includes(searchQuery.toLowerCase())
        || address.includes(searchQuery.toLowerCase());
      const matchesSignal = signalFilter === 'all' || w.signal === signalFilter.toUpperCase();
      return matchesSearch && matchesSignal;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'balance') return (b.balance ?? 0) - (a.balance ?? 0);
      if (sortBy === 'name') return (a.label || '').localeCompare(b.label || '');
      return new Date(b.last_scanned || 0).getTime() - new Date(a.last_scanned || 0).getTime();
    }), [wallets, searchQuery, signalFilter, sortBy]);

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
      <div className="flex-shrink-0 bg-bg-surface border-b border-border-subtle px-5 py-2.5 flex items-center gap-3">
        {/* Search */}
        <div className="relative w-[200px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-2.5 top-2.5 stroke-text-muted pointer-events-none">
            <circle cx="6.2" cy="6.2" r="4.4" strokeWidth="1.2" />
            <path d="M9.7 9.7L12.2 12.2" strokeWidth="1.2" />
          </svg>
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search wallets..."
            className="w-full pl-8 pr-8"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-secondary"
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

        {/* Scan stage indicator */}
        {scanStageMessage ? (
          <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono">
            <Spinner size="sm" />
            {scanStageMessage}
            {activeAddress && (
              <span className="opacity-60">
                {activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}
              </span>
            )}
          </div>
        ) : null}

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-3 relative" ref={sortMenuRef}>
          <button
            type="button"
            onClick={() => setSortOpen((prev) => !prev)}
            className="text-[12px] text-text-secondary bg-bg-overlay border border-border-default rounded-lg px-3 py-1.5 min-w-[130px] text-left"
          >
            {SORT_LABEL[sortBy]}
          </button>
          {sortOpen ? (
            <div className="absolute top-9 left-0 bg-bg-overlay border border-border-default rounded-lg text-[12px] text-text-secondary min-w-[130px] z-20 shadow-lg">
              {Object.entries(SORT_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSortBy(key); setSortOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-bg-elevated first:rounded-t-lg last:rounded-b-lg"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <span className="text-[11px] text-text-muted whitespace-nowrap">
            {filteredWallets.length} / {wallets.length}
          </span>

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

      {/* Main area: table + detail panel */}
      <div className="flex-1 min-h-0 p-5 overflow-hidden">
        <div className="h-full min-h-0 flex gap-0">
          <div className="flex-1 min-h-0 min-w-0">
            <WalletTable
              wallets={filteredWallets}
              loading={loading}
              error={error}
              selectedWallet={selectedWallet}
              scanningIds={scanningIds}
              onSelectWallet={handleSelectWallet}
              onScanWallet={handleScan}
              onRetry={refetch}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          </div>
          {selectedWallet ? (
            <WalletDetailPanel
              wallet={selectedWallet}
              onClose={() => setSelectedWallet(null)}
              onRescan={() => handleScan(selectedWallet)}
              onRemove={handleRemoveWallet}
            />
          ) : null}
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

      <ToastStack items={toasts} onDismiss={removeToast} />
    </div>
  );
}
