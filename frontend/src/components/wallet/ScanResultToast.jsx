import Toast from '../ui/Toast';

export default function ScanResultToast({ walletName, score, onDismiss }) {
  return (
    <Toast
      type="success"
      message={`${walletName || 'Wallet'} scanned successfully (score ${score ?? 0})`}
      onDismiss={onDismiss}
    />
  );
}
