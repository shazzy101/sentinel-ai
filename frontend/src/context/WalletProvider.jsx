import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  connectWallet as connect,
  ensureMainnet,
  getWalletBalance,
  getExistingWallet,
  subscribeWallet,
  getChainId,
  initMetaMaskDiscovery,
  isMetaMaskInstalled,
  ERROR_MESSAGES,
} from '../lib/web3';
import { CHAIN_ID_MAINNET } from '../lib/tokens';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  // Tracked as state (not captured at memo time) so it flips to true when an
  // EIP-6963 provider announces itself shortly after page load.
  const [isInstalled, setIsInstalled] = useState(() => isMetaMaskInstalled());

  useEffect(() => {
    const update = () => setIsInstalled(isMetaMaskInstalled());
    window.addEventListener('eip6963:announceProvider', update);
    const t = setTimeout(update, 700); // providers may announce async after load
    return () => { window.removeEventListener('eip6963:announceProvider', update); clearTimeout(t); };
  }, []);

  const refreshBalance = useCallback(async (addr) => {
    if (!addr || !isMetaMaskInstalled()) {
      setBalance(null);
      return;
    }
    try {
      const bal = await getWalletBalance(addr);
      setBalance(bal);
    } catch {
      setBalance(null);
    }
  }, []);

  const refreshChain = useCallback(async () => {
    const id = await getChainId();
    setChainId(id);
  }, []);

  useEffect(() => {
    initMetaMaskDiscovery();

    let cancelled = false;
    async function restore() {
      try {
        const addr = await getExistingWallet();
        if (cancelled) return;
        if (addr) {
          setAddress(addr);
          await refreshBalance(addr);
          await refreshChain();
        }
      } catch { /* ignore */ }
    }

    restore();
    // EIP-6963 providers may announce shortly after load
    const retry = setTimeout(() => { if (!cancelled) restore(); }, 600);

    const unsubscribe = subscribeWallet({
      onAccounts: (addr) => {
        setAddress(addr);
        setError(null);
        refreshBalance(addr);
      },
      onChain: () => {
        refreshChain();
        getExistingWallet().then((addr) => { if (!cancelled) refreshBalance(addr); });
      },
    });

    return () => {
      cancelled = true;
      clearTimeout(retry);
      unsubscribe();
    };
  }, [refreshBalance, refreshChain]);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await connect();
      setAddress(addr);
      await refreshBalance(addr);
      await refreshChain();
      return addr;
    } catch (err) {
      const msg = err.code === 'NO_METAMASK'
        ? ERROR_MESSAGES.NO_METAMASK.message
        : err.code === 'REJECTED'
          ? ERROR_MESSAGES.REJECTED.message
          : err.message;
      setError(msg);
      return null;
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance, refreshChain]);

  const switchToMainnet = useCallback(async () => {
    setError(null);
    try {
      await ensureMainnet();
      await refreshChain();
      return true;
    } catch (err) {
      const msg = err.code === 'REJECTED'
        ? 'Network switch cancelled.'
        : err.message;
      setError(msg);
      return false;
    }
  }, [refreshChain]);

  const clearError = useCallback(() => setError(null), []);

  const clearLocalWallet = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setError(null);
  }, []);

  useEffect(() => {
    const onAuthSignedOut = () => clearLocalWallet();
    window.addEventListener('hadaleum-auth-signed-out', onAuthSignedOut);
    return () => window.removeEventListener('hadaleum-auth-signed-out', onAuthSignedOut);
  }, [clearLocalWallet]);

  const value = useMemo(() => ({
    address,
    balance,
    chainId,
    isMainnet: chainId === CHAIN_ID_MAINNET,
    isConnected: Boolean(address),
    isInstalled,
    connecting,
    error,
    connectWallet,
    switchToMainnet,
    clearError,
    clearLocalWallet,
    refreshBalance: () => refreshBalance(address),
  }), [address, balance, chainId, isInstalled, connecting, error, connectWallet, switchToMainnet, clearError, clearLocalWallet, refreshBalance]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider');
  return ctx;
}
