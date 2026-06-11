import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Shared ETH price poller. A single module-level interval fans out to every
 * subscriber, so N components reading the ETH price make ONE CoinGecko request
 * per cycle instead of N. Returns the `ethereum` object ({ usd, usd_24h_change,
 * usd_market_cap, ... }) or null.
 */
let _price = null;
const _subscribers = new Set();
let _interval = null;
let _pollMs = 30000;

async function _refresh() {
  try {
    const d = await api.getEthPrice();
    if (d?.ethereum) {
      _price = d.ethereum;
      _subscribers.forEach((cb) => cb(_price));
    }
  } catch { /* keep last known price */ }
}

export function useEthPrice(pollMs = 30000) {
  const [price, setPrice] = useState(_price);

  useEffect(() => {
    _pollMs = pollMs;
    _subscribers.add(setPrice);
    if (_price) setPrice(_price);
    if (!_interval) {
      _refresh();
      _interval = setInterval(_refresh, _pollMs);
    }
    return () => {
      _subscribers.delete(setPrice);
      if (_subscribers.size === 0 && _interval) {
        clearInterval(_interval);
        _interval = null;
      }
    };
  }, [pollMs]);

  return price;
}
