import { useWalletContext } from '../context/WalletProvider';

/** Shared MetaMask wallet state — use WalletProvider at app root. */
export function useWallet() {
  return useWalletContext();
}
