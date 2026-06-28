import { useState } from 'react';
import { postTrading } from '@/hooks/useTradingData';
import EdgeQualityBadge from '@/components/trading/EdgeQualityBadge';
import EquityChart from '@/components/trading/EquityChart';
import KpiCard from '@/components/trading/KpiCard';

const ASSETS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'NVDA', 'TSLA', 'AAPL', 'SPY', 'QQQ'];

export default function BacktestPage() {
  const [asset, setAsset] = useState('BTC/USD');
  const [days, setDays] = useState(30);
  const [riskPct, setRiskPct] = useState(0.02);
  const [minVotes, setMinVotes] = useState(2);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setRunning(true); setError(null);
    try {
      const res = await postTrading('/api/trading/backtest',
        { asset, days: Number(days), risk_pct: Number(riskPct), min_votes: Number(minVotes) });
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const stats = result?.stats;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Backtester</h1>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Asset</span>
          <select value={asset} onChange={(e) => setAsset(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
            {ASSETS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Period: {days}d</span>
          <input type="range" min={7} max={90} value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Risk: {(riskPct * 100).toFixed(0)}%</span>
          <input type="range" min={0.005} max={0.05} step={0.005} value={riskPct} onChange={(e) => setRiskPct(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Min confluence: {minVotes}</span>
          <input type="range" min={1} max={7} value={minVotes} onChange={(e) => setMinVotes(e.target.value)} />
        </label>
        <button onClick={run} disabled={running}
                className="rounded-lg bg-emerald-500/90 px-4 py-2 font-semibold text-black disabled:opacity-50">
          {running ? 'Running…' : 'Run Backtest'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {result && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-muted">{result.trades.length} trades over {result.days}d {result.cached ? '· cached' : ''}</div>
            {result.edge_quality && <EdgeQualityBadge edge={result.edge_quality} />}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Return" value={stats ? `${stats.total_return_pct >= 0 ? '+' : ''}${stats.total_return_pct.toFixed(2)}%` : '—'} tone={stats?.total_return_pct >= 0 ? 'good' : 'bad'} />
            <KpiCard label="Win Rate" value={stats ? `${stats.win_rate.toFixed(0)}%` : '—'} />
            <KpiCard label="Profit Factor" value={stats ? stats.profit_factor.toFixed(2) : '—'} />
            <KpiCard label="Max DD" value={stats ? `${stats.max_drawdown.toFixed(1)}%` : '—'} tone="bad" />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 text-sm font-semibold">Equity</div>
            <EquityChart equity={result.equity} startingCapital={result.starting_capital} />
          </div>
        </>
      )}
    </div>
  );
}
