'use client';

import { Box, Badge } from './ui';
import { fmtUSD, fmtPct, colorForValue } from '@/lib/format';
import type { StratResult } from '@/types';

interface Props {
  results: StratResult[];
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#1a1a1a] last:border-0">
      <span className="text-xs font-mono text-[#555]">{label}</span>
      <span className="text-xs font-mono" style={{ color: color ?? '#ccc' }}>
        {value}
      </span>
    </div>
  );
}

export default function SummaryCards({ results }: Props) {
  if (results.length === 0) return null;

  const maxAPR = Math.max(
    ...results
      .filter((r) => r.strategy.type !== 'hold')
      .map((r) => r.metrics.annualAPR),
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
      {results.map((r) => {
        const { metrics, strategy } = r;
        const isBest =
          strategy.type !== 'hold' && metrics.annualAPR === maxAPR && maxAPR > 0;
        const pctInRangeColor =
          metrics.pctInRange >= 70
            ? '#c8f135'
            : metrics.pctInRange >= 40
            ? '#ff8c42'
            : '#ff5252';

        return (
          <Box key={strategy.id} className="relative">
            {isBest && (
              <Badge className="absolute top-3 right-3" color="#c8f135">
                BEST
              </Badge>
            )}

            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: strategy.color }}
              />
              <span
                className="font-mono text-sm font-bold truncate"
                style={{ color: strategy.color }}
              >
                {strategy.name}
              </span>
            </div>

            {/* Hero metric */}
            <div className="mb-3">
              <div className="text-xs font-mono text-[#555] mb-0.5">Annual APR</div>
              <div
                className="text-2xl font-mono font-bold"
                style={{ color: colorForValue(metrics.annualAPR) }}
              >
                {fmtPct(metrics.annualAPR)}
              </div>
            </div>

            <StatRow
              label="Total Fees"
              value={fmtUSD(metrics.totalFees)}
              color="#c8f135"
            />
            <StatRow
              label="IL"
              value={fmtUSD(-metrics.totalIL)}
              color={colorForValue(-metrics.totalIL)}
            />
            <StatRow
              label="Final Value"
              value={fmtUSD(metrics.finalValue)}
              color={colorForValue(metrics.netPnl)}
            />
            <StatRow
              label="Rebalances"
              value={String(metrics.rebalCount)}
            />
            <StatRow
              label="% In Range"
              value={`${metrics.pctInRange.toFixed(1)}%`}
              color={pctInRangeColor}
            />
          </Box>
        );
      })}
    </div>
  );
}
