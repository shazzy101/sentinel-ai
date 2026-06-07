import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AddWalletModal({ open, onClose, onSubmit, isScanning }) {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [tags, setTags] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const trimmedAddress = address.trim();
  const isLength42 = trimmedAddress.length === 42;
  const isValidAddress = isLength42 && trimmedAddress.startsWith('0x');
  const showError = isLength42 && !trimmedAddress.startsWith('0x');

  const helperText = useMemo(() => {
    if (!trimmedAddress.length) return '';
    if (trimmedAddress.length < 42) return `${trimmedAddress.length} / 42`;
    if (showError) return 'Must be a valid Ethereum address (0x...)';
    return '';
  }, [trimmedAddress, showError]);

  useEffect(() => {
    if (!isValidAddress) { setPreview(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    setPreview(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/wallets/${trimmedAddress}`);
        const body = await res.json();
        if (!cancelled) {
          if (body.success && body.data?.wallet) {
            const w = body.data.wallet;
            setPreview({ balance: w.balance, txCount: null, found: true });
          } else {
            setPreview({ found: false });
          }
        }
      } catch {
        if (!cancelled) setPreview({ found: false });
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isValidAddress, trimmedAddress]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="px-5 pt-5 pb-3 border-b border-border-subtle flex items-center">
        <h2 className="font-display text-[16px] font-bold text-text-primary">Add wallet</h2>
        <Button variant="icon" className="ml-auto" onClick={onClose}>✕</Button>
      </div>

      <form
        className="px-5 pb-5 pt-4 flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!isValidAddress || isScanning) return;
          await onSubmit({
            address: trimmedAddress,
            label: label.trim(),
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          });
          setAddress('');
          setLabel('');
          setTags('');
        }}
      >
        <div>
          <label className="text-[11px] uppercase tracking-[1px] text-text-muted mb-1.5 block">Address</label>
          <div className="relative">
            <Input
              mono
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x..."
              error={showError}
              className="w-full pr-8"
            />
            {isValidAddress ? <span className="absolute right-3 top-2.5 text-green">✓</span> : null}
          </div>
          {helperText ? (
            <div className={`text-[10px] mt-1 ${showError ? 'text-red' : 'text-text-muted'} text-right`.trim()}>
              {helperText}
            </div>
          ) : null}
          {previewLoading && (
            <div className="flex items-center gap-2 mt-2 text-[11px] text-text-muted">
              <Spinner size="sm" />
              Looking up address...
            </div>
          )}
          {!previewLoading && preview?.found && (
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="text-green">✓</span>
              <span className="text-text-secondary font-mono">
                {preview.balance != null
                  ? `${Number(preview.balance).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`
                  : 'Wallet found'}
              </span>
            </div>
          )}
          {!previewLoading && preview && !preview.found && (
            <div className="flex items-center gap-2 mt-2 text-[11px] text-amber">
              ⚠ Not yet in watchlist — will be scanned fresh
            </div>
          )}
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[1px] text-text-muted mb-1.5 block">
            Label <span className="text-[10px] text-text-muted normal-case">(optional)</span>
          </label>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Paradigm Fund"
            className="w-full"
          />
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[1px] text-text-muted mb-1.5 block">
            Tags <span className="text-[10px] text-text-muted normal-case">(optional)</span>
          </label>
          <Input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="defi, whale, fund"
            className="w-full"
          />
          <div className="text-[10px] text-text-muted mt-1">Comma-separated</div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border-subtle mt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1 justify-center" type="submit" disabled={!isValidAddress || isScanning}>
            {isScanning ? <><Spinner size="sm" /> Scanning...</> : 'Add & scan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
