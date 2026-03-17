'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Badge } from './ui';
import { fmtUSD, fmtPct, fmtDate, fmtPrice, colorForValue } from '@/lib/format';
import { generateStrategyNarrative } from '@/lib/narrative';
import type { StratResult, Candle, RebalanceEvent } from '@/types';

interface Props {
  results: StratResult[];
  candles: Candle[];
  capital: number;
}

const TICK_STYLE = { fill: '#444', fontSize: 9, fontFamily: 'Courier New' };
const TT_STYLE = {
  backgroundColor: '#161616',
  border: '1px solid #2a2a2a',
  borderRadius: 4,
  fontFamily: 'Courier New',
  fontSize: 10,
  color: '#ccc',
};

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[#1a1a1a] last:border-0">
      <span className="text-xs font-mono text-[#555]">{label}</span>
      <span className="text-xs font-mono" style={{ color: color ?? '#ccc' }}>
        {value}
      </span>
    </div>
  );
}

function ConfigTab({ r }: { r: StratResult }) {
  const { strategy, metrics } = r;
  const pctInRangeColor =
    metrics.pctInRange >= 70 ? '#c8f135' : metrics.pctInRange >= 40 ? '#ff8c42' : '#ff5252';

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
      <div>
        <StatRow label="Tipo" value={strategy.type.toUpperCase()} />
        <StatRow label="Rango ±%" value={`${strategy.rangePct}%`} />
        {strategy.type === 'fixed' && strategy.absLo != null && (
          <StatRow label="Límite bajo" value={fmtPrice(strategy.absLo)} />
        )}
        {strategy.type === 'fixed' && strategy.absHi != null && (
          <StatRow label="Límite alto" value={fmtPrice(strategy.absHi)} />
        )}
        <StatRow label="Compounding" value={strategy.compounding ? 'Sí' : 'No'} />
      </div>
      <div>
        <StatRow label="Total Fees" value={fmtUSD(metrics.totalFees)} color="#c8f135" />
        <StatRow label="IL" value={fmtUSD(-metrics.totalIL)} color={colorForValue(-metrics.totalIL)} />
        <StatRow label="Rebalanceos" value={String(metrics.rebalCount)} />
        <StatRow label="% En rango" value={`${metrics.pctInRange.toFixed(1)}%`} color={pctInRangeColor} />
        <StatRow label="Coste rebalanceos" value={fmtUSD(metrics.totalRebalCost)} color="#ff5252" />
      </div>
    </div>
  );
}

function RebalancesTab({ r, candles }: { r: StratResult; candles: Candle[] }) {
  const { rebalanceHistory, strategy } = r;

  if (rebalanceHistory.length === 0) {
    return (
      <div className="p-4 text-center text-xs font-mono text-[#444] py-8">
        No hubo rebalanceos para esta estrategia.
      </div>
    );
  }

  const data = candles.map((c) => ({ time: c.time, price: c.close }));

  return (
    <div className="p-4">
      {/* Mini chart */}
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="time" tickFormatter={fmtDate} stroke="#222" tick={TICK_STYLE} />
          <YAxis
            tickFormatter={(v) => fmtPrice(v)}
            stroke="#222"
            tick={TICK_STYLE}
            width={60}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={TT_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [fmtPrice(v), 'Precio']}
            labelFormatter={(t) => fmtDate(t as number)}
          />
          <Line type="monotone" dataKey="price" stroke="#333" dot={false} strokeWidth={1} />
          {rebalanceHistory.map((ev: RebalanceEvent) => (
            <ReferenceLine
              key={ev.index}
              x={ev.time}
              stroke={strategy.color}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* History table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-1.5 text-[#444] font-normal pr-3">#</th>
              <th className="text-left py-1.5 text-[#444] font-normal pr-3">Fecha</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Precio</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Rango anterior</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Nuevo rango</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Coste</th>
              <th className="text-right py-1.5 text-[#444] font-normal">Fees acum.</th>
            </tr>
          </thead>
          <tbody>
            {rebalanceHistory.map((ev: RebalanceEvent) => (
              <tr key={ev.index} className="border-b border-[#0f0f0f] hover:bg-[#0d0d0d]">
                <td className="py-1.5 text-[#555] pr-3">{ev.index + 1}</td>
                <td className="py-1.5 text-[#777] pr-3">{fmtDate(ev.time)}</td>
                <td className="py-1.5 text-right text-[#ccc] pr-3">{fmtPrice(ev.price)}</td>
                <td className="py-1.5 text-right text-[#555] pr-3">
                  {fmtPrice(ev.prevLo)} – {fmtPrice(ev.prevHi)}
                </td>
                <td className="py-1.5 text-right text-[#777] pr-3">
                  {fmtPrice(ev.newLo)} – {fmtPrice(ev.newHi)}
                </td>
                <td className="py-1.5 text-right text-[#ff5252] pr-3">
                  -{fmtUSD(ev.gasCost)}
                </td>
                <td className="py-1.5 text-right text-[#c8f135]">
                  {fmtUSD(ev.feesAtPoint)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SummaryCards({ results, candles, capital }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tabMap, setTabMap] = useState<Record<string, 'config' | 'rebalances'>>({});

  if (results.length === 0) return null;

  const maxAPR = Math.max(
    ...results
      .filter((r) => r.strategy.type !== 'hold')
      .map((r) => r.metrics.annualAPR),
  );

  return (
    <div className="flex flex-col gap-2">
      {results.map((r) => {
        const { metrics, strategy } = r;
        const isOpen = openId === strategy.id;
        const isBest =
          strategy.type !== 'hold' && metrics.annualAPR === maxAPR && maxAPR > 0;
        const currentTab = tabMap[strategy.id] ?? 'config';

        const narrative =
          candles.length > 0
            ? generateStrategyNarrative(r, candles, capital, isBest)
            : null;

        function setTab(t: 'config' | 'rebalances') {
          setTabMap((prev) => ({ ...prev, [strategy.id]: t }));
        }

        return (
          <div
            key={strategy.id}
            className="border border-[#1a1a1a] rounded-lg overflow-hidden"
            style={{ borderLeftColor: strategy.color, borderLeftWidth: 3 }}
          >
            {/* Header row — always visible */}
            <div
              className="flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#0d0d0d] transition-colors"
              onClick={() => setOpenId(isOpen ? null : strategy.id)}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: strategy.color }}
              />
              <span
                className="font-mono text-sm font-bold"
                style={{ color: strategy.color }}
              >
                {strategy.name}
              </span>
              {isBest && (
                <Badge color="#c8f135">BEST</Badge>
              )}

              <div className="ml-auto flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="text-right">
                  <div className="text-[10px] font-mono text-[#555]">APR</div>
                  <div
                    className="text-sm font-mono font-bold"
                    style={{ color: colorForValue(metrics.annualAPR) }}
                  >
                    {fmtPct(metrics.annualAPR)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-[#555]">Fees</div>
                  <div className="text-sm font-mono" style={{ color: '#c8f135' }}>
                    {fmtUSD(metrics.totalFees)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-[#555]">Net PnL</div>
                  <div
                    className="text-sm font-mono"
                    style={{ color: colorForValue(metrics.netPnl) }}
                  >
                    {fmtUSD(metrics.netPnl)}
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-mono text-[#555]">En rango</div>
                  <div className="text-sm font-mono text-[#ccc]">
                    {metrics.pctInRange.toFixed(0)}%
                  </div>
                </div>
                <span className="text-xs text-[#444]">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-[#1a1a1a]">
                {/* Narrative block */}
                {narrative && (
                  <div className="px-4 py-3 bg-[#0a0a0a] border-b border-[#1a1a1a]">
                    <p className="text-xs font-mono text-[#888] leading-relaxed">
                      {narrative.whatHappened}
                    </p>
                    <p className="text-xs font-mono text-[#555] leading-relaxed mt-1.5">
                      {narrative.whyPerformed}
                    </p>
                  </div>
                )}

                {/* Tab bar */}
                <div className="flex border-b border-[#1a1a1a]">
                  {(['config', 'rebalances'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="px-4 py-2 text-xs font-mono transition-colors"
                      style={{
                        color: currentTab === t ? strategy.color : '#555',
                        borderBottom: currentTab === t ? `1px solid ${strategy.color}` : '1px solid transparent',
                      }}
                    >
                      {t === 'config'
                        ? 'Configuración'
                        : `Rebalanceos (${r.rebalanceHistory.length})`}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {currentTab === 'config' && <ConfigTab r={r} />}
                {currentTab === 'rebalances' && (
                  <RebalancesTab r={r} candles={candles} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
