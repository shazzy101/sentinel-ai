export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed. Please install MetaMask to trade.');
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export async function getWalletBalance(address) {
  const balance = await window.ethereum.request({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  });
  return parseInt(balance, 16) / 1e18;
}

export async function sendTransaction(txData) {
  return window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [txData],
  });
}

export function formatWalletAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
