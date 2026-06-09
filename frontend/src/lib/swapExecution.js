/**
 * Shared swap execution — ERC-20 approve + DefiLlama swap via MetaMask.
 */
import {
  sendTransaction,
  waitForTransaction,
  getTokenAllowance,
  approveToken,
  getTokenBalance,
  getWalletBalance,
} from './web3';
import {
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS,
  isNativeToken,
  toTokenUnits,
} from './tokens';

export async function getSpendableBalance(address, tokenSymbol) {
  if (isNativeToken(tokenSymbol)) {
    return getWalletBalance(address);
  }
  return getTokenBalance(TOKEN_ADDRESSES[tokenSymbol], address, TOKEN_DECIMALS[tokenSymbol]);
}

export async function ensureTokenApproval({ owner, tokenSymbol, spender, amountRaw }) {
  if (isNativeToken(tokenSymbol)) return null;

  const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
  const allowance = await getTokenAllowance(tokenAddress, owner, spender);
  const needed = BigInt(amountRaw);
  if (BigInt(allowance) >= needed) return null;

  const approveHash = await approveToken(tokenAddress, spender, amountRaw);
  await waitForTransaction(approveHash);
  return approveHash;
}

export async function executeSwap({ from, quote, fromToken, amount }) {
  const tx = quote?.tx;
  if (!tx?.to || !tx?.data) {
    throw new Error('Invalid quote — missing transaction data.');
  }

  const amountRaw = toTokenUnits(amount, fromToken);
  const approveHash = await ensureTokenApproval({
    owner: from,
    tokenSymbol: fromToken,
    spender: tx.to,
    amountRaw,
  });

  const swapHash = await sendTransaction({
    from,
    to: tx.to,
    data: tx.data,
    value: tx.value ?? '0x0',
    gas: tx.gas,
  });

  const receipt = await waitForTransaction(swapHash);
  return { swapHash, approveHash, receipt };
}

export function validateSwapInputs({ amount, fromToken, balance, isConnected, isMainnet }) {
  if (!isConnected) return 'Connect MetaMask to trade.';
  if (!isMainnet) return 'Switch to Ethereum Mainnet.';
  const n = parseFloat(amount);
  if (!amount || Number.isNaN(n) || n <= 0) return 'Enter a valid amount.';
  if (balance != null && n > balance) return `Insufficient ${fromToken} balance.`;
  return null;
}
