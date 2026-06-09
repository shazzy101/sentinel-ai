import { useCallback, useEffect, useRef, useState } from 'react';
import { executeSwap } from '../lib/swapExecution';
import { saveTrade, updateTrade } from '../lib/tradeHistory';

/**
 * Submit swap tx via MetaMask with ERC-20 approval when needed.
 */
export function useTransaction() {
  const [status, setStatus] = useState('idle'); // idle | approving | pending | confirming | success | error
  const [txHash, setTxHash] = useState(null);
  const [approveHash, setApproveHash] = useState(null);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const tradeIdRef = useRef(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setApproveHash(null);
    setError(null);
    setReceipt(null);
    tradeIdRef.current = null;
  }, []);

  const execute = useCallback(async ({ from, quote, tradeMeta, fromToken, amount }) => {
    reset();
    setStatus('pending');

    const record = saveTrade({
      ...tradeMeta,
      status: 'pending',
    });
    tradeIdRef.current = record.id;

    try {
      setStatus('approving');
      const { swapHash, approveHash: approvalTx, receipt: rcpt } = await executeSwap({
        from,
        quote,
        fromToken,
        amount,
      });

      if (approvalTx) {
        setApproveHash(approvalTx);
        updateTrade(record.id, { approveHash: approvalTx });
      }

      setTxHash(swapHash);
      setStatus('confirming');
      updateTrade(record.id, { txHash: swapHash, status: 'confirming' });

      setReceipt(rcpt);
      setStatus('success');
      updateTrade(record.id, {
        status: 'confirmed',
        blockNumber: parseInt(rcpt.blockNumber, 16),
        confirmedAt: new Date().toISOString(),
      });

      return { hash: swapHash, receipt: rcpt };
    } catch (err) {
      setError(err.message);
      setStatus('error');
      if (tradeIdRef.current) {
        updateTrade(tradeIdRef.current, { status: 'failed', error: err.message });
      }
      throw err;
    }
  }, [reset]);

  return {
    status,
    txHash,
    approveHash,
    error,
    receipt,
    execute,
    reset,
    isBusy: ['pending', 'approving', 'confirming'].includes(status),
  };
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
