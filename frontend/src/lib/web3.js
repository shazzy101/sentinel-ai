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
    title: 'Transaction Cancelled',
    message: 'You rejected the transaction in MetaMask.',
  },
};

export async function connectWallet() {
  if (!window.ethereum) {
    const err = new Error('MetaMask not installed. Please install MetaMask to trade.');
    err.code = 'NO_METAMASK';
    throw err;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in MetaMask');
    }
    await ensureMainnet();
    return accounts[0];
  } catch (err) {
    if (err.code === 4001) {
      const e = new Error('Connection rejected. Please approve MetaMask connection to continue.');
      e.code = 'REJECTED';
      throw e;
    }
    throw err;
  }
}

export async function getChainId() {
  if (!window.ethereum) return null;
  const hex = await window.ethereum.request({ method: 'eth_chainId' });
  return parseInt(hex, 16);
}

export async function ensureMainnet() {
  const chainId = await getChainId();
  if (chainId === CHAIN_ID_MAINNET) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    });
  } catch (err) {
    if (err.code === 4902) {
      throw new Error('Please add Ethereum Mainnet to MetaMask.');
    }
    throw new Error('Switch to Ethereum Mainnet to trade.');
  }
}

export async function getWalletBalance(address) {
  const balance = await window.ethereum.request({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  });
  return parseInt(balance, 16) / 1e18;
}

export async function sendTransaction(txData) {
  if (!window.ethereum) {
    const err = new Error('MetaMask not installed');
    err.code = 'NO_METAMASK';
    throw err;
  }
  try {
    return await window.ethereum.request({
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
export async function waitForTransaction(txHash, { timeoutMs = 180_000, intervalMs = 2_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await window.ethereum.request({
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
  if (!window.ethereum) return () => {};

  const onAccounts = (accounts) => callbacks.onAccounts?.(accounts[0] || null);
  const onChain = () => callbacks.onChain?.();

  window.ethereum.on?.('accountsChanged', onAccounts);
  window.ethereum.on?.('chainChanged', onChain);

  return () => {
    window.ethereum.removeListener?.('accountsChanged', onAccounts);
    window.ethereum.removeListener?.('chainChanged', onChain);
  };
}

export async function getExistingWallet() {
  if (!window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts[0] || null;
}

/** Convenience namespace for Invest / copy-trade flows */
export const web3 = {
  async connect() {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed. Please install MetaMask to use the trade feature.');
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  },
  async getBalance(address) {
    const hex = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    });
    return parseInt(hex, 16) / 1e18;
  },
  async sendTx(txData) {
    return sendTransaction(txData);
  },
  formatAddr(addr) {
    return formatWalletAddress(addr);
  },
  isInstalled() {
    return typeof window.ethereum !== 'undefined';
  },
};

const ERC20_ABI = {
  balanceOf: '0x70a08231', // balanceOf(address)
  allowance: '0xdd62ed3e', // allowance(address,address)
  approve: '0x095ea7b3', // approve(address,uint256)
};

function padAddress(addr) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padUint256(value) {
  const hex = BigInt(value).toString(16);
  return hex.padStart(64, '0');
}

async function ethCall(to, data) {
  return window.ethereum.request({
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
  const data = ERC20_ABI.approve + padAddress(spenderAddress) + padUint256(amountRaw);
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return sendTransaction({
    from: accounts[0],
    to: tokenAddress,
    data: `0x${data}`,
    value: '0x0',
  });
}
