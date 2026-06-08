import { useCallback, useEffect, useRef, useState } from 'react';
import { sendTransaction, waitForTransaction } from '../lib/web3';
import { saveTrade, updateTrade } from '../lib/tradeHistory';

/**
 * Submit swap tx via MetaMask and track confirmation in real time.
 */
export function useTransaction() {
  const [status, setStatus] = useState('idle'); // idle | pending | confirming | success | error
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const tradeIdRef = useRef(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
    setReceipt(null);
    tradeIdRef.current = null;
  }, []);

  const execute = useCallback(async ({ from, quote, tradeMeta }) => {
    reset();
    setStatus('pending');

    const record = saveTrade({
      ...tradeMeta,
      status: 'pending',
    });
    tradeIdRef.current = record.id;

    try {
      const hash = await sendTransaction({
        from,
        to: quote.tx?.to,
        data: quote.tx?.data,
        value: quote.tx?.value ?? '0x0',
        gas: quote.tx?.gas,
      });

      setTxHash(hash);
      setStatus('confirming');
      updateTrade(record.id, { txHash: hash, status: 'confirming' });

      const rcpt = await waitForTransaction(hash);
      setReceipt(rcpt);
      setStatus('success');
      updateTrade(record.id, {
        status: 'confirmed',
        blockNumber: parseInt(rcpt.blockNumber, 16),
        confirmedAt: new Date().toISOString(),
      });

      return { hash, receipt: rcpt };
    } catch (err) {
      setError(err.message);
      setStatus('error');
      if (tradeIdRef.current) {
        updateTrade(tradeIdRef.current, { status: 'failed', error: err.message });
      }
      throw err;
    }
  }, [reset]);

  return { status, txHash, error, receipt, execute, reset, isBusy: status === 'pending' || status === 'confirming' };
}

/** Listen for trade history updates across tabs/components */
export function useTradeHistory() {
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sentinel-trade-history') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const refresh = () => {
      try {
        setHistory(JSON.parse(localStorage.getItem('sentinel-trade-history') || '[]'));
      } catch {
        setHistory([]);
      }
    };
    window.addEventListener('sentinel-trade-updated', refresh);
    return () => window.removeEventListener('sentinel-trade-updated', refresh);
  }, []);

  return history;
}
