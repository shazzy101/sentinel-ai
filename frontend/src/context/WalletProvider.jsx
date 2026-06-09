import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  connectWallet as connect,
  ensureMainnet,
  getWalletBalance,
  getExistingWallet,
  subscribeWallet,
  getChainId,
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

  const refreshBalance = useCallback(async (addr) => {
    if (!addr || !window.ethereum) {
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
    return subscribeWallet({
      onAccounts: (addr) => {
        setAddress(addr);
        refreshBalance(addr);
      },
      onChain: () => {
        refreshChain();
        getExistingWallet().then((addr) => refreshBalance(addr));
      },
    });
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
      throw err;
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance, refreshChain]);

  const switchToMainnet = useCallback(async () => {
    setError(null);
    try {
      await ensureMainnet();
      await refreshChain();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshChain]);

  const value = useMemo(() => ({
    address,
    balance,
    chainId,
    isMainnet: chainId === CHAIN_ID_MAINNET,
    isConnected: Boolean(address),
    connecting,
    error,
    connectWallet,
    switchToMainnet,
    refreshBalance: () => refreshBalance(address),
  }), [address, balance, chainId, connecting, error, connectWallet, switchToMainnet, refreshBalance]);

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
