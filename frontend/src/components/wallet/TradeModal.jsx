import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Redirects to the full Invest page — unified swap flow with ERC-20 approvals. */
export default function TradeModal({ isOpen, onClose, defaultToken }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const sym = defaultToken?.symbol?.toUpperCase();
    const params = new URLSearchParams();
    if (sym && sym !== 'ETH') {
      params.set('to', sym);
      params.set('from', 'USDC');
    }
    navigate(`/invest${params.toString() ? `?${params}` : ''}`);
    onClose?.();
  }, [isOpen, defaultToken?.symbol, navigate, onClose]);

  return null;
}
