'use client';

import { fmtUSD, fmtPct, fmtPrice, colorForValue } from '@/lib/format';
import type { StratResult } from '@/types';

interface Props {
  results: StratResult[];
  entryPrice: number;
  currentPrice: number;
  capital: number;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-2 text-left text-xs font-mono text-[#444] uppercase tracking-wider whitespace-nowrap border-b border-[#222]">
      {children}
    </th>
  );
}

function Td({
  children,
  color,
  align = 'right',
}: {
  children: React.ReactNode;
  color?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className="px-2 py-2 text-xs font-mono whitespace-nowrap"
      style={{ color: color ?? '#ccc', textAlign: align }}
    >
      {children}
    </td>
  );
}

const DASH = <span className="text-[#333]">—</span>;

export default function ResultsTable({
  results,
  entryPrice,
  currentPrice,
  capital,
}: Props) {
  if (results.length === 0) return null;

  return (
    <div className="overflow-x-auto border border-[#222] rounded-lg">
      <table className="w-full min-w-max">
        <thead>
          <tr className="bg-[#0d0d0d]">
            <Th>Strategy</Th>
            <Th>Provided</Th>
            <Th>Market Value</Th>
            <Th>IL ($)</Th>
            <Th>FEES ($)</Th>
            <Th>Daily APR</Th>
            <Th>Net IL PnL%</Th>
            <Th>%IL</Th>
            <Th>%APR</Th>
            <Th>Month APR%</Th>
            <Th>Annual APR</Th>
            <Th>Cap+Comp</Th>
            <Th>Rebalanceos</Th>
            <Th>Coste total</Th>
            <Th>% en rango</Th>
          </tr>
        </thead>
        <tbody>
          {/* Entry price row */}
          <tr className="bg-[#1a0a00] border-b border-[#2a1500]">
            <Td align="left" color="#ff8c42">
              ▶ Entry Price
            </Td>
            <Td color="#ff8c42">{fmtPrice(entryPrice)}</Td>
            {Array.from({ length: 13 }).map((_, i) => (
              <td key={i} className="px-2 py-2 text-center">{DASH}</td>
            ))}
          </tr>

          {/* Strategy rows */}
          {results.map((r) => {
            const { strategy, metrics } = r;
            const netPnlPct = ((metrics.finalValue - capital) / capital) * 100;
            const ilPct = (metrics.totalIL / capital) * 100;
            const monthAPR = metrics.dailyAPR * 30;
            const capComp = capital + metrics.totalFees;
            const pctInRangeColor =
              metrics.pctInRange >= 70
                ? '#c8f135'
                : metrics.pctInRange >= 40
                ? '#ff8c42'
                : '#ff5252';

            return (
              <tr
                key={strategy.id}
                className="border-b border-[#1a1a1a] hover:bg-[#111] transition-colors"
              >
                <Td align="left">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: strategy.color }}
                    />
                    <span style={{ color: strategy.color }}>{strategy.name}</span>
                  </div>
                </Td>
                <Td>{fmtUSD(capital)}</Td>
                <Td color={colorForValue(metrics.finalValue - capital)}>
                  {fmtUSD(metrics.finalValue)}
                </Td>
                <Td color={colorForValue(-metrics.totalIL)}>
                  {fmtUSD(-metrics.totalIL)}
                </Td>
                <Td color="#c8f135">{fmtUSD(metrics.totalFees)}</Td>
                <Td color={colorForValue(metrics.dailyAPR)}>
                  {fmtPct(metrics.dailyAPR)}
                </Td>
                <Td color={colorForValue(netPnlPct)}>{fmtPct(netPnlPct)}</Td>
                <Td color={colorForValue(-ilPct)}>{fmtPct(-ilPct)}</Td>
                <Td color={colorForValue(metrics.dailyAPR)}>
                  {fmtPct(metrics.dailyAPR)}
                </Td>
                <Td color={colorForValue(monthAPR)}>{fmtPct(monthAPR)}</Td>
                <Td color={colorForValue(metrics.annualAPR)}>
                  {fmtPct(metrics.annualAPR)}
                </Td>
                <Td>{fmtUSD(capComp)}</Td>
                <Td color={metrics.rebalCount > 0 ? '#ff8c42' : '#ccc'}>
                  {metrics.rebalCount}
                </Td>
                <Td color={metrics.totalRebalCost > 0 ? '#ff5252' : '#ccc'}>
                  {fmtUSD(metrics.totalRebalCost)}
                </Td>
                <Td color={pctInRangeColor}>
                  {metrics.pctInRange.toFixed(1)}%
                </Td>
              </tr>
            );
          })}

          {/* Current price row */}
          <tr className="bg-[#00101a] border-t border-[#003050]">
            <Td align="left" color="#42a5f5">
              ■ Current Price
            </Td>
            <Td color="#42a5f5">{fmtPrice(currentPrice)}</Td>
            {Array.from({ length: 13 }).map((_, i) => (
              <td key={i} className="px-2 py-2 text-center">{DASH}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
