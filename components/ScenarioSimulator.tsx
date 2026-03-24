'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Box, FieldLabel, Input, RangeSlider } from '@/components/ui';
import { fmtUSD, fmtPct } from '@/lib/format';

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface Props {
  capital: number;
  feeTier: number;
  dailyVol: number;
  tvl: number;
  lastBacktestApr?: number;
  currentPrice?: number;
}

// ─────────────────────────────────────────────────────────────
// Core math
// ─────────────────────────────────────────────────────────────

function ilFactor(p0: number, p1: number): number {
  if (p0 <= 0 || p1 <= 0) return 0;
  const r = p1 / p0;
  return (2 * Math.sqrt(r)) / (1 + r);
}

interface SimResult {
  totalFees: number;
  feesWithdrawn: number;
  capitalFinalLP: number;
  capitalTotal: number;
  apr: number;
  roi: number;
}

function simulateStatic(
  capital: number,
  dailyAprPct: number,
  days: number,
): { r0: SimResult; r50: SimResult; r100: SimResult } {
  const rate = dailyAprPct / 100;

  // 0% compound – fees accumulate externally, LP stays at capital
  const fees0 = capital * rate * days;
  const r0: SimResult = {
    totalFees: fees0,
    feesWithdrawn: fees0,
    capitalFinalLP: capital,
    capitalTotal: capital + fees0,
    apr: days > 0 ? (fees0 / capital) * (365 / days) * 100 : 0,
    roi: (fees0 / capital) * 100,
  };

  // 100% compound – all fees reinvested daily
  const cap100 = capital * Math.pow(1 + rate, days);
  const r100: SimResult = {
    totalFees: cap100 - capital,
    feesWithdrawn: 0,
    capitalFinalLP: cap100,
    capitalTotal: cap100,
    apr: days > 0 ? (Math.pow(cap100 / capital, 365 / days) - 1) * 100 : 0,
    roi: ((cap100 - capital) / capital) * 100,
  };

  // 50% compound – day-by-day simulation
  let cap50 = capital;
  let withdrawn50 = 0;
  let totalFees50 = 0;
  for (let d = 0; d < days; d++) {
    const df = cap50 * rate;
    totalFees50 += df;
    cap50 += df * 0.5;
    withdrawn50 += df * 0.5;
  }
  const total50 = cap50 + withdrawn50;
  const r50: SimResult = {
    totalFees: totalFees50,
    feesWithdrawn: withdrawn50,
    capitalFinalLP: cap50,
    capitalTotal: total50,
    apr: days > 0 ? ((total50 - capital) / capital) * (365 / days) * 100 : 0,
    roi: ((total50 - capital) / capital) * 100,
  };

  return { r0, r50, r100 };
}

/** Binary-search the lowest price at which total value >= initial capital. */
function findBreakEven(
  capital: number,
  capitalFinalLP: number,
  feesWithdrawn: number,
  p0: number,
): number | null {
  if (p0 <= 0) return null;
  // If fees alone cover initial capital, always break even
  if (feesWithdrawn >= capital) return 0;
  // Sanity: at entry price (IL=1) must be profitable
  if (capitalFinalLP + feesWithdrawn < capital) return null;

  let lo = 0;
  let hi = p0;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const val = capitalFinalLP * ilFactor(p0, mid) + feesWithdrawn;
    if (val >= capital) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-mono font-bold text-[#444] uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

function CompTable({
  rows,
}: {
  rows: { label: string; vals: React.ReactNode[] }[];
}) {
  const headers = ['', '0% compound', '50% compound', '100% compound'];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-[#555] uppercase tracking-wider font-normal border-b border-[#222]"
                style={{ textAlign: i === 0 ? 'left' : 'right' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-[#0d0d0d]' : ''}>
              <td className="px-3 py-2 text-[#666]">{row.label}</td>
              {row.vals.map((v, vi) => (
                <td key={vi} className="px-3 py-2 text-right">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function positiveColor(v: number, base: number): string {
  if (v >= base) return '#c8f135';
  if (v >= base * 0.75) return '#ff8c42';
  return '#ff5252';
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function ScenarioSimulator({
  capital: initialCapital,
  lastBacktestApr,
  currentPrice,
}: Props) {
  const [capital, setCapital] = useState(initialCapital);
  const [dailyApr, setDailyApr] = useState(lastBacktestApr ?? 0.3);
  const [months, setMonths] = useState(12);
  const [entryPrice, setEntryPrice] = useState(currentPrice ?? 0);

  const days = months * 30;
  const p0 = entryPrice > 0 ? entryPrice : 1;

  const { r0, r50, r100 } = useMemo(
    () => simulateStatic(capital, dailyApr, days),
    [capital, dailyApr, days],
  );

  const be0 = useMemo(
    () => findBreakEven(capital, r0.capitalFinalLP, r0.feesWithdrawn, p0),
    [capital, r0, p0],
  );
  const be50 = useMemo(
    () => findBreakEven(capital, r50.capitalFinalLP, r50.feesWithdrawn, p0),
    [capital, r50, p0],
  );
  const be100 = useMemo(
    () => findBreakEven(capital, r100.capitalFinalLP, r100.feesWithdrawn, p0),
    [capital, r100, p0],
  );

  // Month-by-month chart data (pre-simulate 50% incrementally)
  const chartData = useMemo(() => {
    const rate = dailyApr / 100;
    // Build daily running totals for 50% compound
    const tot50: number[] = new Array(days + 1);
    tot50[0] = capital;
    let cap50 = capital;
    let withdrawn50 = 0;
    for (let d = 1; d <= days; d++) {
      const df = cap50 * rate;
      cap50 += df * 0.5;
      withdrawn50 += df * 0.5;
      tot50[d] = cap50 + withdrawn50;
    }

    return Array.from({ length: months + 1 }, (_, m) => {
      const d = Math.min(m * 30, days);
      return {
        month: m,
        hold: capital,
        c0: capital + capital * rate * d,
        c50: tot50[d],
        c100: capital * Math.pow(1 + rate, d),
      };
    });
  }, [capital, dailyApr, days, months]);

  // ── Section 3 data
  const drops = [0, -10, -25, -50, -75];

  // ── Helpers
  function beRow(label: string, be: number | null) {
    const hasPrice = entryPrice > 0;
    const cur = currentPrice ?? 0;
    return (
      <tr key={label} className="border-b border-[#1a1a1a]">
        <td className="px-3 py-3 text-[#666] w-36 whitespace-nowrap">{label}</td>
        <td className="px-3 py-3">
          {!hasPrice ? (
            <span className="text-[#444]">—</span>
          ) : be === null ? (
            <span className="text-[#444]">—</span>
          ) : be === 0 ? (
            <span style={{ color: '#c8f135' }}>✓ Siempre positivo</span>
          ) : (
            <>
              <span className="text-[#ccc]">ETH ≥ {fmtUSD(be)}</span>
              <span className="ml-2 text-[#555]">
                ({fmtPct(((be - entryPrice) / entryPrice) * 100)} desde entrada)
              </span>
            </>
          )}
        </td>
        <td className="px-3 py-3 text-right whitespace-nowrap">
          {hasPrice && be !== null && be > 0 && cur > 0 && (
            cur >= be ? (
              <span style={{ color: '#c8f135' }}>✓ Precio actual cubre</span>
            ) : (
              <span style={{ color: '#ff5252' }}>
                Faltan {fmtUSD(be - cur)} ({fmtPct(((be - cur) / cur) * 100)})
              </span>
            )
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Inputs ── */}
      <Box>
        <SectionTitle>Parámetros del simulador</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <FieldLabel>Capital inicial ($)</FieldLabel>
            <Input
              type="number"
              value={capital}
              onChange={(v) => setCapital(Math.max(1, Number(v)))}
              min={1}
              step={100}
            />
          </div>
          <div>
            <FieldLabel>APR diario estimado (%)</FieldLabel>
            <Input
              type="number"
              value={dailyApr}
              onChange={(v) => setDailyApr(Math.max(0.001, Number(v)))}
              min={0.001}
              max={100}
              step={0.01}
            />
            <p className="text-xs font-mono text-[#444] mt-1">
              ≈ {fmtPct(dailyApr * 365)} APR anual
            </p>
          </div>
          <div>
            <FieldLabel>Precio entrada ETH ($)</FieldLabel>
            <Input
              type="number"
              value={entryPrice}
              onChange={(v) => setEntryPrice(Math.max(0, Number(v)))}
              min={0}
              step={10}
            />
          </div>
          <div>
            <RangeSlider
              label="Período"
              value={months}
              onChange={setMonths}
              min={1}
              max={36}
              displayValue={`${months} mes${months !== 1 ? 'es' : ''}`}
            />
            <Input
              type="number"
              value={months}
              onChange={(v) => setMonths(Math.min(36, Math.max(1, Math.round(Number(v)))))}
              min={1}
              max={36}
              className="mt-2"
            />
          </div>
        </div>
      </Box>

      {/* ── Section 1: Static price ── */}
      <Box>
        <SectionTitle>1 — Precio estático (sin movimiento de ETH)</SectionTitle>
        <CompTable
          rows={[
            {
              label: 'Fees totales',
              vals: [r0, r50, r100].map((r, i) => (
                <span key={i} style={{ color: '#c8f135' }}>{fmtUSD(r.totalFees)}</span>
              )),
            },
            {
              label: 'Fees retirados',
              vals: [r0, r50, r100].map((r) => fmtUSD(r.feesWithdrawn)),
            },
            {
              label: 'Capital final LP',
              vals: [r0, r50, r100].map((r) => fmtUSD(r.capitalFinalLP)),
            },
            {
              label: 'Capital total',
              vals: [r0, r50, r100].map((r, i) => (
                <span key={i} style={{ color: positiveColor(r.capitalTotal, capital) }}>
                  {fmtUSD(r.capitalTotal)}
                </span>
              )),
            },
            {
              label: 'APR efectivo',
              vals: [r0, r50, r100].map((r, i) => (
                <span key={i} style={{ color: '#c8f135' }}>{fmtPct(r.apr)}</span>
              )),
            },
            {
              label: 'ROI total',
              vals: [r0, r50, r100].map((r, i) => (
                <span key={i} style={{ color: '#c8f135' }}>{fmtPct(r.roi)}</span>
              )),
            },
          ]}
        />
      </Box>

      {/* ── Section 2: Break-even ── */}
      <Box>
        <SectionTitle>2 — Punto de equilibrio</SectionTitle>
        {entryPrice <= 0 ? (
          <p className="text-xs font-mono text-[#555]">
            Introduce un precio de entrada para calcular el punto de equilibrio.
          </p>
        ) : (
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[#555] uppercase tracking-wider font-normal border-b border-[#222] w-36">
                  Estrategia
                </th>
                <th className="px-3 py-2 text-left text-[#555] uppercase tracking-wider font-normal border-b border-[#222]">
                  Precio mínimo de ETH
                </th>
                <th className="px-3 py-2 text-right text-[#555] uppercase tracking-wider font-normal border-b border-[#222]">
                  Estado actual
                </th>
              </tr>
            </thead>
            <tbody>
              {beRow('Sin compound', be0)}
              {beRow('50% compound', be50)}
              {beRow('100% compound', be100)}
            </tbody>
          </table>
        )}
      </Box>

      {/* ── Section 3: Drop scenarios ── */}
      <Box>
        <SectionTitle>3 — Escenarios de caída del precio</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[#555] uppercase tracking-wider font-normal border-b border-[#222]">
                  Caída ETH
                </th>
                {['0% compound', '50% compound', '100% compound'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-right text-[#555] uppercase tracking-wider font-normal border-b border-[#222]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drops.map((drop, ri) => {
                const p1 = p0 * (1 + drop / 100);
                const il = ilFactor(p0, p1);
                const v0 = r0.capitalFinalLP * il + r0.feesWithdrawn;
                const v50 = r50.capitalFinalLP * il + r50.feesWithdrawn;
                const v100 = r100.capitalFinalLP * il + r100.feesWithdrawn;
                return (
                  <tr key={drop} className={ri % 2 === 0 ? 'bg-[#0d0d0d]' : ''}>
                    <td className="px-3 py-2 text-[#888]">
                      {drop === 0 ? '±0%' : `${drop}%`}
                    </td>
                    {[v0, v50, v100].map((v, vi) => (
                      <td
                        key={vi}
                        className="px-3 py-2 text-right font-bold"
                        style={{ color: positiveColor(v, capital) }}
                      >
                        {fmtUSD(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs font-mono text-[#444] mt-3">
          Capital inicial: {fmtUSD(capital)} ·{' '}
          <span style={{ color: '#c8f135' }}>Verde</span> &gt; inicial ·{' '}
          <span style={{ color: '#ff8c42' }}>Naranja</span> 75–100% ·{' '}
          <span style={{ color: '#ff5252' }}>Rojo</span> &lt; 75%
        </p>
      </Box>

      {/* ── Section 4: Projection chart ── */}
      <Box>
        <SectionTitle>4 — Proyección mes a mes</SectionTitle>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 0, left: 10 }}
          >
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              stroke="#333"
              tick={{ fill: '#555', fontSize: 10, fontFamily: 'Courier New' }}
              tickFormatter={(v: number) => `M${v}`}
            />
            <YAxis
              stroke="#333"
              tick={{ fill: '#555', fontSize: 10, fontFamily: 'Courier New' }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`
              }
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111',
                border: '1px solid #333',
                borderRadius: 6,
                fontFamily: 'Courier New',
                fontSize: 11,
                color: '#ccc',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any) => [fmtUSD(Number(v)), String(name)]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(l: any) => `Mes ${l}`}
            />
            <Legend
              wrapperStyle={{
                fontFamily: 'Courier New',
                fontSize: 10,
                color: '#666',
              }}
            />
            <ReferenceLine
              y={capital}
              stroke="#ff5252"
              strokeDasharray="4 4"
              label={{
                value: 'Capital inicial',
                fill: '#ff5252',
                fontSize: 9,
                fontFamily: 'Courier New',
                position: 'insideTopRight',
              }}
            />
            <Line
              type="monotone"
              dataKey="hold"
              name="Hold (sin LP)"
              stroke="#555"
              dot={false}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="c0"
              name="0% compound"
              stroke="#42a5f5"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="c50"
              name="50% compound"
              stroke="#ff8c42"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="c100"
              name="100% compound"
              stroke="#c8f135"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </div>
  );
}
