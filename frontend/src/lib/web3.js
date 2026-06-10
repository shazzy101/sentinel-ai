import { CHAIN_ID_MAINNET } from './tokens';

export const ERROR_MESSAGES = {
  NO_METAMASK: {
    title: 'MetaMask Required',
    message: 'Install MetaMask from metamask.io to execute trades.',
    action: 'Install MetaMask →',
    href: 'https://metamask.io',
  },
  WRONG_NETWORK: {
    title: 'Wrong Network',
    message: 'Please switch MetaMask to Ethereum Mainnet to trade.',
    action: 'Switch Network',
  },
  INSUFFICIENT_FUNDS: {
    title: 'Insufficient Funds',
    message: "You don't have enough ETH to complete this trade.",
  },
  REJECTED: {
    title: 'Connection Cancelled',
    message: 'You rejected the MetaMask connection request.',
  },
};

/** @type {import('ethers').Eip1193Provider | null} */
let cachedMetaMaskProvider = null;
let discoveryStarted = false;

function pickMetaMaskFromEthereum(ethereum) {
  if (!ethereum) return null;
  // Rabby and some wallets spoof isMetaMask — prefer explicit MetaMask flags
  const isRealMetaMask = (p) => p?.isMetaMask && !p?.isRabby && !p?.isBraveWallet;
  if (isRealMetaMask(ethereum)) return ethereum;
  if (Array.isArray(ethereum.providers)) {
    const mm = ethereum.providers.find(isRealMetaMask);
    if (mm) return mm;
  }
  return null;
}

/** Discover MetaMask via EIP-6963 (avoids wrong wallet when multiple extensions installed). */
export function initMetaMaskDiscovery() {
  if (typeof window === 'undefined' || discoveryStarted) return;
  discoveryStarted = true;

  cachedMetaMaskProvider = pickMetaMaskFromEthereum(window.ethereum);

  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail || {};
    const rdns = info?.rdns || '';
    const name = info?.name || '';
    if (rdns === 'io.metamask' || name === 'MetaMask') {
      cachedMetaMaskProvider = provider;
    }
  });

  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

/** Returns the MetaMask EIP-1193 provider, or null if not installed. */
export function getMetaMaskProvider() {
  if (typeof window === 'undefined') return null;
  if (!discoveryStarted) initMetaMaskDiscovery();
  if (cachedMetaMaskProvider) return cachedMetaMaskProvider;
  cachedMetaMaskProvider = pickMetaMaskFromEthereum(window.ethereum);
  return cachedMetaMaskProvider;
}

export function isMetaMaskInstalled() {
  return Boolean(getMetaMaskProvider());
}

export async function connectWallet() {
  const provider = getMetaMaskProvider();
  if (!provider) {
    const err = new Error(ERROR_MESSAGES.NO_METAMASK.message);
    err.code = 'NO_METAMASK';
    throw err;
  }

  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) {
      throw new Error('No accounts found in MetaMask');
    }

    const address = accounts[0];

    // Connect succeeds even on wrong network — user can switch before trading
    try {
      await ensureMainnet(provider);
    } catch (netErr) {
      if (netErr.code !== 'REJECTED' && netErr.code !== 4001) {
        netErr.networkWarning = true;
        throw netErr;
      }
    }

    return address;
  } catch (err) {
    if (err.code === 4001) {
      const e = new Error(ERROR_MESSAGES.REJECTED.message);
      e.code = 'REJECTED';
      throw e;
    }
    throw err;
  }
}

export async function getChainId(provider = getMetaMaskProvider()) {
  if (!provider) return null;
  const hex = await provider.request({ method: 'eth_chainId' });
  return parseInt(hex, 16);
}

export async function ensureMainnet(provider = getMetaMaskProvider()) {
  if (!provider) {
    const err = new Error(ERROR_MESSAGES.NO_METAMASK.message);
    err.code = 'NO_METAMASK';
    throw err;
  }
  const chainId = await getChainId(provider);
  if (chainId === CHAIN_ID_MAINNET) return;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    });
  } catch (err) {
    if (err.code === 4001) {
      const e = new Error('Network switch cancelled. Switch to Ethereum Mainnet to trade.');
      e.code = 'REJECTED';
      throw e;
    }
    if (err.code === 4902) {
      throw new Error('Please add Ethereum Mainnet to MetaMask.');
    }
    throw new Error('Switch to Ethereum Mainnet to trade.');
  }
}

export async function getWalletBalance(address, provider = getMetaMaskProvider()) {
  if (!provider) return null;
  const balance = await provider.request({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  });
  return parseInt(balance, 16) / 1e18;
}

export async function sendTransaction(txData, provider = getMetaMaskProvider()) {
  if (!provider) {
    const err = new Error(ERROR_MESSAGES.NO_METAMASK.message);
    err.code = 'NO_METAMASK';
    throw err;
  }
  try {
    return await provider.request({
      method: 'eth_sendTransaction',
      params: [txData],
    });
  } catch (err) {
    if (err.code === 4001) {
      const e = new Error('Transaction rejected. You cancelled the MetaMask transaction.');
      e.code = 'REJECTED';
      throw e;
    }
    if (err.code === -32603) {
      const e = new Error('Transaction failed. You may have insufficient funds or gas.');
      e.code = 'INSUFFICIENT_FUNDS';
      throw e;
    }
    throw new Error(err.message || 'Transaction failed');
  }
}

/** Poll until tx is mined or timeout (default 3 min) */
export async function waitForTransaction(txHash, { timeoutMs = 180_000, intervalMs = 2_000, provider = getMetaMaskProvider() } = {}) {
  if (!provider) throw new Error('MetaMask not available');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
    if (receipt) {
      const status = parseInt(receipt.status, 16);
      if (status === 0) throw new Error('Transaction reverted on-chain.');
      return receipt;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Transaction confirmation timed out.');
}

export function formatWalletAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function subscribeWallet(callbacks) {
  const provider = getMetaMaskProvider();
  if (!provider) return () => {};

  const onAccounts = (accounts) => callbacks.onAccounts?.(accounts[0] || null);
  const onChain = () => callbacks.onChain?.();

  provider.on?.('accountsChanged', onAccounts);
  provider.on?.('chainChanged', onChain);

  return () => {
    provider.removeListener?.('accountsChanged', onAccounts);
    provider.removeListener?.('chainChanged', onChain);
  };
}

export async function getExistingWallet() {
  const provider = getMetaMaskProvider();
  if (!provider) return null;
  const accounts = await provider.request({ method: 'eth_accounts' });
  return accounts[0] || null;
}

/** Convenience namespace for Invest / copy-trade flows */
export const web3 = {
  async connect() {
    return connectWallet();
  },
  async getBalance(address) {
    return getWalletBalance(address);
  },
  async sendTx(txData) {
    return sendTransaction(txData);
  },
  formatAddr(addr) {
    return formatWalletAddress(addr);
  },
  isInstalled() {
    return isMetaMaskInstalled();
  },
};

const ERC20_ABI = {
  balanceOf: '0x70a08231',
  allowance: '0xdd62ed3e',
  approve: '0x095ea7b3',
};

function padAddress(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padUint256(value) {
  const hex = BigInt(value).toString(16);
  return hex.padStart(64, '0');
}

async function ethCall(to, data, provider = getMetaMaskProvider()) {
  return provider.request({
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  });
}

/** Read ERC-20 balance (returns human-readable float). */
export async function getTokenBalance(tokenAddress, ownerAddress, decimals = 18) {
  const data = ERC20_ABI.balanceOf + padAddress(ownerAddress);
  const result = await ethCall(tokenAddress, data);
  return parseInt(result || '0x0', 16) / Math.pow(10, decimals);
}

/** Read ERC-20 allowance as raw uint256 string. */
export async function getTokenAllowance(tokenAddress, ownerAddress, spenderAddress) {
  const data = ERC20_ABI.allowance + padAddress(ownerAddress) + padAddress(spenderAddress);
  const result = await ethCall(tokenAddress, data);
  return BigInt(result || '0x0').toString();
}

/** Send ERC-20 approve tx. Returns tx hash. */
export async function approveToken(tokenAddress, spenderAddress, amountRaw) {
  const provider = getMetaMaskProvider();
  const accounts = await provider.request({ method: 'eth_accounts' });
  const data = ERC20_ABI.approve + padAddress(spenderAddress) + padUint256(amountRaw);
  return sendTransaction({
    from: accounts[0],
    to: tokenAddress,
    data: `0x${data}`,
    value: '0x0',
  }, provider);
}
