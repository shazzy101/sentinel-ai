import { ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * The honesty marker. Green when profit is spread across many trades; amber when
 * one trade is carrying the P&L. This is the core credibility signal of the product.
 */
export default function EdgeQualityBadge({ edge, size = 'md' }) {
  if (!edge) return null;
  const distributed = edge.distributed_edge;
  const pad = size === 'lg' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs';
  const Icon = distributed ? ShieldCheck : AlertTriangle;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-semibold ${pad} ${
        distributed
          ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
          : 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
      }`}
    >
      <Icon className="h-4 w-4" />
      {distributed
        ? 'Distributed Edge ✓'
        : 'Concentrated — one trade carrying P&L'}
      {typeof edge.profit_concentration === 'number' && (
        <span className="opacity-70">· top trade {edge.profit_concentration}%</span>
      )}
    </span>
  );
}
