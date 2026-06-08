import { useCallback, useEffect, useState } from 'react';
import {
  connectWallet as connect,
  getWalletBalance,
  getExistingWallet,
  subscribeWallet,
  getChainId,
} from '../lib/web3';
import { CHAIN_ID_MAINNET } from '../lib/tokens';

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const refreshBalance = useCallback(async (addr) => {
    if (!addr) {
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
    getExistingWallet().then((addr) => {
      setAddress(addr);
      refreshBalance(addr);
    });
    refreshChain();

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
      setError(err.message);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance, refreshChain]);

  return {
    address,
    balance,
    chainId,
    isMainnet: chainId === CHAIN_ID_MAINNET,
    connecting,
    error,
    connectWallet,
    refreshBalance: () => refreshBalance(address),
    isConnected: Boolean(address),
  };
}
