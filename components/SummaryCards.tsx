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

// ── P5: Strategy type descriptions ────────────────────────────────────────────
const DESCRIPTIONS: Record<string, string> = {
  hold:  'Sin LP. Solo tracking del precio del activo. Referencia base para comparar el resto de estrategias.',
  fixed: 'Rango estático desde el precio de entrada. Nunca rebalancea — cero coste de gas. Deja de generar fees si el precio sale del rango. Ideal para mercados laterales con poca volatilidad.',
  dyn:   'Rebalancea automáticamente cuando el precio sale del rango y ha pasado el intervalo configurado. Siempre generando fees. Coste: gas + slippage en cada rebalanceo.',
  scalp: 'Rango muy estrecho para maximizar la concentración de liquidez y fees por unidad. Alta frecuencia de rebalanceos. Solo rentable en redes con gas barato (Arbitrum, Base).',
};

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
    <div className="flex justify-between items-center py-1.5 border-b border-[#1a1a1a] last:border-0">
      <span className="text-xs font-mono text-[#555]">{label}</span>
      <span className="text-xs font-mono" style={{ color: color ?? '#ccc' }}>
        {value}
      </span>
    </div>
  );
}

// ── P5: ConfigTab with description paragraph ──────────────────────────────────
function ConfigTab({ r }: { r: StratResult }) {
  const { strategy, metrics } = r;
  const pctInRangeColor =
    metrics.pctInRange >= 70 ? '#c8f135' : metrics.pctInRange >= 40 ? '#ff8c42' : '#ff5252';
  const desc = DESCRIPTIONS[strategy.type];

  return (
    <div className="p-4">
      {desc && (
        <p className="text-xs font-mono text-[#666] leading-relaxed mb-4 pb-4 border-b border-[#1a1a1a]">
          {desc}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <div>
          <StatRow label="Tipo" value={strategy.type.toUpperCase()} />
          <StatRow label="Rango ±%" value={`${strategy.rangePct}%`} />
          {strategy.type === 'fixed' && strategy.absLo != null && (
            <StatRow label="Límite bajo" value={fmtPrice(strategy.absLo)} />
          )}
          {strategy.type === 'fixed' && strategy.absHi != null && (
            <StatRow label="Límite alto" value={fmtPrice(strategy.absHi)} />
          )}
          <StatRow
            label="Compounding"
            value={
              !strategy.compounding
                ? 'No'
                : `Sí (${strategy.compoundPct ?? 100}% reinvertido)`
            }
          />
        </div>
        <div>
          <StatRow label="Total Fees" value={fmtUSD(metrics.totalFees)} color="#c8f135" />
          {strategy.compounding && (strategy.compoundPct ?? 100) < 100 && (
            <>
              <StatRow label="Fees líquidos" value={fmtUSD(metrics.liquidFees)} color="#c8f135" />
              <StatRow label="Fees reinvertidos" value={fmtUSD(metrics.reinvestedFees)} color="#e066ff" />
            </>
          )}
          <StatRow label="IL" value={fmtUSD(-metrics.totalIL)} color={colorForValue(-metrics.totalIL)} />
          <StatRow label="Rebalanceos" value={String(metrics.rebalCount)} />
          <StatRow label="% En rango" value={`${metrics.pctInRange.toFixed(1)}%`} color={pctInRangeColor} />
          <StatRow label="Coste rebalanceos" value={fmtUSD(metrics.totalRebalCost)} color="#ff5252" />
        </div>
      </div>
    </div>
  );
}

// ── P6: RebalancesTab with mini chart + history table ─────────────────────────
function RebalancesTab({ r, candles }: { r: StratResult; candles: Candle[] }) {
  const { rebalanceHistory, strategy } = r;

  if (!rebalanceHistory || rebalanceHistory.length === 0) {
    return (
      <div className="p-6 text-center text-xs font-mono text-[#444]">
        Esta estrategia no rebalanceó durante el período.
      </div>
    );
  }

  const data = candles.map((c) => ({ time: c.time, price: c.close }));

  return (
    <div className="p-4">
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

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-1.5 text-[#444] font-normal pr-3">#</th>
              <th className="text-left py-1.5 text-[#444] font-normal pr-3">Fecha</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Precio</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Rango ant.</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Nuevo rango</th>
              <th className="text-right py-1.5 text-[#444] font-normal pr-3">Gas</th>
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function SummaryCards({ results, candles, capital }: Props) {
  // P3: hooks always before any early return
  const [openId, setOpenId] = useState<string | null>(null);
  const [tabMap, setTabMap] = useState<Record<string, 'config' | 'rebalances'>>({});

  if (results.length === 0) return null;

  const maxAPR = Math.max(
    ...results
      .filter((r) => r.strategy.type !== 'hold')
      .map((r) => r.metrics.annualAPR),
  );

  return (
    // P3: grid with items-start so open cards don't stretch closed ones
    <div className="grid gap-3 items-start sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {results.map((r) => {
        const { metrics, strategy } = r;
        const isOpen = openId === strategy.id;
        const isBest =
          strategy.type !== 'hold' && metrics.annualAPR === maxAPR && maxAPR > 0;
        const currentTab = tabMap[strategy.id] ?? 'config';

        const pctInRangeColor =
          metrics.pctInRange >= 70 ? '#c8f135' : metrics.pctInRange >= 40 ? '#ff8c42' : '#ff5252';

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
            className="border border-[#1a1a1a] rounded-lg overflow-hidden bg-[#0d0d0d]"
            style={{ borderLeftColor: strategy.color, borderLeftWidth: 3 }}
          >
            {/* Always-visible card body */}
            <div className="px-4 pt-4 pb-3 relative">
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

              <StatRow label="Total Fees" value={fmtUSD(metrics.totalFees)} color="#c8f135" />
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
              <StatRow label="Rebalanceos" value={String(metrics.rebalCount)} />
              <StatRow
                label="% En rango"
                value={`${metrics.pctInRange.toFixed(1)}%`}
                color={pctInRangeColor}
              />
            </div>

            {/* P3: "Ver más" button at the bottom of the card */}
            <div className="px-4 mt-3 pt-3 pb-4 border-t border-[#1a1a1a]">
              <button
                className="w-full py-2 px-4 rounded-md font-mono font-bold text-[11px] uppercase tracking-wider cursor-pointer transition-all text-center"
                style={{
                  color: '#c8f135',
                  backgroundColor: '#161f04',
                  border: '1px solid #2d3a0f',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d2a08';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#c8f13566';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#161f04';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#2d3a0f';
                }}
                onClick={() => setOpenId(openId === strategy.id ? null : strategy.id)}
              >
                {isOpen ? 'Ver menos ▲' : 'Ver más ▼'}
              </button>
            </div>

            {/* Accordion panel */}
            {isOpen && (
              <div className="border-t border-[#1a1a1a]">
                {/* P4: Narrative with labelled sections */}
                {narrative && (
                  <div className="px-4 py-3 bg-[#0a0a0a] border-b border-[#1a1a1a]">
                    <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-1">
                      💡 Qué pasó
                    </div>
                    <p className="text-xs font-mono text-[#888] leading-relaxed mb-3">
                      {narrative.whatHappened}
                    </p>
                    <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-1">
                      📊 Análisis
                    </div>
                    <p className="text-xs font-mono text-[#666] leading-relaxed">
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
                        borderBottom:
                          currentTab === t
                            ? `1px solid ${strategy.color}`
                            : '1px solid transparent',
                      }}
                    >
                      {t === 'config'
                        ? 'Configuración'
                        : `Rebalanceos (${r.rebalanceHistory?.length ?? 0})`}
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
