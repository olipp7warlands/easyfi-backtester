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
import { Box, Button, FieldLabel, Input, RangeSlider, Select } from '@/components/ui';
import { fmtUSD, fmtPct } from '@/lib/format';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  capital: number;
  feeTier: number;
  dailyVol: number;
  tvl: number;
  lastBacktestApr?: number; // daily APR from backtest
  currentPrice?: number;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  label: string;
  changePct: number;
}

interface SimResult {
  totalFees: number;
  feesWithdrawn: number;
  capitalFinalLP: number; // LP position value (no IL applied yet)
  capitalTotal: number;   // at static price
  apr: number;
  roi: number;
}

interface RebalanceStep {
  segmento: number;
  precioInicio: number;
  precioFin: number;
  ilSegmento: number;
  capitalAntes: number;
  capitalDespues: number;
  feesSegmento: number;
  gasSegmento: number;
}

interface CustomScenarioResult {
  capitalFinal: number;
  feesTotales: number;
  gasTotales: number;
  ilTotalFactor: number;
  rebalanceHistory: RebalanceStep[];
}

// ─── Math ────────────────────────────────────────────────────────────────────

function ilFactor(p0: number, p1: number): number {
  if (p0 <= 0 || p1 <= 0) return 0;
  const r = p1 / p0;
  return (2 * Math.sqrt(r)) / (1 + r);
}

function simulateStatic(
  capital: number,
  dailyAprPct: number,
  days: number,
): { r0: SimResult; r50: SimResult; r100: SimResult } {
  const rate = dailyAprPct / 100;

  // 0% compound – LP capital unchanged, all fees withdrawn
  const fees0 = capital * rate * days;
  const r0: SimResult = {
    totalFees: fees0,
    feesWithdrawn: fees0,
    capitalFinalLP: capital,
    capitalTotal: capital + fees0,
    apr: days > 0 ? (fees0 / capital) * (365 / days) * 100 : 0,
    roi: (fees0 / capital) * 100,
  };

  // 100% compound – all fees reinvested
  const cap100 = capital * Math.pow(1 + rate, days);
  const r100: SimResult = {
    totalFees: cap100 - capital,
    feesWithdrawn: 0,
    capitalFinalLP: cap100,
    capitalTotal: cap100,
    apr: days > 0 ? (Math.pow(cap100 / capital, 365 / days) - 1) * 100 : 0,
    roi: ((cap100 - capital) / capital) * 100,
  };

  // 50% compound – day-by-day
  let cap50 = capital, withdrawn50 = 0, totalFees50 = 0;
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

/** Binary-search for the lowest price at which totalValue >= initialCapital. */
function findBreakEven(
  capital: number,
  capitalFinalLP: number,
  feesWithdrawn: number,
  p0: number,
): number | null {
  if (p0 <= 0) return null;
  if (feesWithdrawn >= capital) return 0; // fees alone cover it
  if (capitalFinalLP + feesWithdrawn < capital) return null;
  let lo = 0, hi = p0;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (capitalFinalLP * ilFactor(p0, mid) + feesWithdrawn >= capital) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function simulateCustomScenario(
  capital: number,
  p0: number,
  pMin: number,
  pFinal: number,
  aprAnual: number,
  gasUSD: number,
  nRebalanceos: number,
): CustomScenarioResult {
  const dailyRate = aprAnual / 100 / 365;
  const daysPerSegment = 30 / Math.max(nRebalanceos, 1);
  let currentCapital = capital;
  let feesTotales = 0;
  let gasTotales = 0;
  const rebalanceHistory: RebalanceStep[] = [];

  // Fase 1 — Bajada de p0 a pMin en N segmentos
  for (let i = 0; i < nRebalanceos; i++) {
    const segStart = p0 + (pMin - p0) * (i / nRebalanceos);
    const segEnd   = p0 + (pMin - p0) * ((i + 1) / nRebalanceos);
    const il = ilFactor(segStart, Math.max(segEnd, 0.001));
    const fees = currentCapital * dailyRate * daysPerSegment;
    const capitalAntes = currentCapital;
    currentCapital = capitalAntes * il + fees - gasUSD;
    feesTotales += fees;
    gasTotales += gasUSD;
    rebalanceHistory.push({
      segmento: i + 1,
      precioInicio: segStart,
      precioFin: segEnd,
      ilSegmento: il,
      capitalAntes,
      capitalDespues: currentCapital,
      feesSegmento: fees,
      gasSegmento: gasUSD,
    });
  }

  // Fase 2 — Recuperación de pMin a pFinal
  const ilRecovery = ilFactor(Math.max(pMin, 0.001), Math.max(pFinal, 0.001));
  const feesRecovery = currentCapital * dailyRate * 30;
  currentCapital = currentCapital * ilRecovery + feesRecovery;
  feesTotales += feesRecovery;

  return {
    capitalFinal: currentCapital,
    feesTotales,
    gasTotales,
    ilTotalFactor: ilFactor(p0, Math.max(pFinal, 0.001)),
    rebalanceHistory,
  };
}

function simulateWithPriceMove(
  capital: number,
  dailyAprPct: number,
  days: number,
  p0: number,
  p1: number,
  compoundPct: number,
): number {
  if (days === 0) return capital * ilFactor(p0, Math.max(p1, 0.001));
  const rate = dailyAprPct / 100;
  let capitalEfectivo = capital;
  let feesRetirados = 0;
  for (let dia = 1; dia <= days; dia++) {
    const feeDia = capitalEfectivo * rate;
    capitalEfectivo += feeDia * (compoundPct / 100);
    feesRetirados += feeDia * (1 - compoundPct / 100);
  }
  const ilFinal = ilFactor(p0, Math.max(p1, 0.001));
  return capitalEfectivo * ilFinal + feesRetirados;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-mono font-bold text-[#444] uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

function positiveColor(v: number, base: number): string {
  if (v >= base) return '#c8f135';
  if (v >= base * 0.75) return '#ff8c42';
  return '#ff5252';
}

function newId(): string {
  return Math.random().toString(36).slice(2);
}

const PRESET_CHANGES = [-75, -50, -25, 0, 25, 50, 100];
const SC_COLORS = ['#e066ff', '#ff6b9d', '#ffd700'];

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScenarioSimulator({
  capital: initialCapital,
  lastBacktestApr,
  currentPrice,
}: Props) {
  // lastBacktestApr is a daily rate → convert to annual for display
  const defaultAnnualApr = (lastBacktestApr ?? 0.3) * 365;

  const [capital, setCapital] = useState(initialCapital);
  const [annualApr, setAnnualApr] = useState(defaultAnnualApr);
  const [months, setMonths] = useState(12);
  const [entryPrice, setEntryPrice] = useState(currentPrice ?? 0);
  const [finalPriceStr, setFinalPriceStr] = useState('');
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: newId(), label: 'Sin cambio', changePct: 0 },
    { id: newId(), label: '-25%', changePct: -25 },
    { id: newId(), label: '-50%', changePct: -50 },
  ]);

  // ── Sección 5 — estado ────────────────────────────────────────────────────
  const [sc5PrecioInicial, setSc5PrecioInicial] = useState(currentPrice ?? 0);
  const [sc5PrecioMinimo, setSc5PrecioMinimo]   = useState(0);
  const [sc5PrecioFinal, setSc5PrecioFinal]     = useState(currentPrice ?? 0);
  const [sc5Rango, setSc5Rango]                 = useState(10);
  const [sc5FeeTier, setSc5FeeTier]             = useState('0.0005');
  const [sc5AprAnual, setSc5AprAnual]           = useState(defaultAnnualApr);
  const [sc5GasUSD, setSc5GasUSD]               = useState(10);
  const [sc5NRebalanceos, setSc5NRebalanceos]   = useState(4);
  const [sc5Result, setSc5Result]               = useState<CustomScenarioResult | null>(null);

  // Derived rates
  const dailyApr = annualApr / 365;
  const monthlyApr = annualApr / 12;
  const days = months * 30;
  const p0 = entryPrice > 0 ? entryPrice : 1;

  // Final price logic
  const finalPriceNum = finalPriceStr !== '' ? Math.max(0, Number(finalPriceStr)) : 0;
  const finalPrice = finalPriceNum > 0 ? finalPriceNum : p0;
  const hasFinalPrice = finalPriceNum > 0 && Math.abs(finalPriceNum - p0) > 0.001;
  const il = hasFinalPrice ? ilFactor(p0, finalPrice) : 1;

  // Core simulation (static price)
  const { r0, r50, r100 } = useMemo(
    () => simulateStatic(capital, dailyApr, days),
    [capital, dailyApr, days],
  );

  // Capital totals with IL applied (for Section 1 display)
  const ct0 = r0.capitalFinalLP * il + r0.feesWithdrawn;
  const ct50 = r50.capitalFinalLP * il + r50.feesWithdrawn;
  const ct100 = r100.capitalFinalLP * il + r100.feesWithdrawn;

  // Break-even prices
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

  // Reference price for break-even status column
  const beComparisonPrice = hasFinalPrice ? finalPrice : (currentPrice ?? 0);

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const chartScenarios = scenarios.slice(0, 3);

    return Array.from({ length: months + 1 }, (_, m) => {
      const d = Math.min(m * 30, days);
      const frac = months > 0 ? m / months : 1;

      // Linearly interpolate price from entry to final
      const priceAtM = p0 + (finalPrice - p0) * frac;
      const safeP = Math.max(priceAtM, 0.001);

      // Hold value tracks price
      const holdVal = capital * (safeP / p0);

      // LP values using simulateWithPriceMove (IL applied correctly over compounded capital)
      const c0_m   = simulateWithPriceMove(capital, dailyApr, d, p0, safeP, 0);
      const c50_m  = simulateWithPriceMove(capital, dailyApr, d, p0, safeP, 50);
      const c100_m = simulateWithPriceMove(capital, dailyApr, d, p0, safeP, 100);

      const point: Record<string, number> = {
        month: m,
        hold: holdVal,
        c0: c0_m,
        c50: c50_m,
        c100: c100_m,
      };

      // Scenario lines: 0% compound LP value under each scenario's own price path
      chartScenarios.forEach((sc, si) => {
        const p1_sc = p0 * (1 + sc.changePct / 100);
        const priceAtM_sc = p0 + (p1_sc - p0) * frac;
        point[`sc${si}`] = simulateWithPriceMove(capital, dailyApr, d, p0, Math.max(priceAtM_sc, 0.001), 0);
      });

      return point;
    });
  }, [capital, dailyApr, days, months, finalPrice, p0, scenarios]);

  // ── Scenario management ───────────────────────────────────────────────────

  function addScenario() {
    setScenarios((prev) => [...prev, { id: newId(), label: 'Nuevo', changePct: 0 }]);
  }

  function removeScenario(id: string) {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }

  function updateScenario(id: string, patch: Partial<Omit<Scenario, 'id'>>) {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addPreset(pct: number) {
    if (scenarios.some((s) => s.changePct === pct)) return;
    const label = pct === 0 ? 'Sin cambio' : pct > 0 ? `+${pct}%` : `${pct}%`;
    setScenarios((prev) => [...prev, { id: newId(), label, changePct: pct }]);
  }

  // ── Sección 5 — handler ──────────────────────────────────────────────────

  function handleSimular() {
    const p0s  = sc5PrecioInicial > 0 ? sc5PrecioInicial : 1;
    const pMin = sc5PrecioMinimo  > 0 ? sc5PrecioMinimo  : 1;
    const pFin = sc5PrecioFinal   > 0 ? sc5PrecioFinal   : 1;
    const result = simulateCustomScenario(capital, p0s, pMin, pFin, sc5AprAnual, sc5GasUSD, sc5NRebalanceos);
    setSc5Result(result);

    // Verificación con el ejemplo del usuario
    const test = simulateCustomScenario(1000, 3000, 2250, 3000, 40, 10, 4);
    console.log('=== Verificación Escenario 5 ===');
    console.log('Inputs: capital=1000, p0=3000, pMin=2250, pFinal=3000, APR=40%, gas=$10, nRebal=4');
    console.log('capitalFinal:', test.capitalFinal.toFixed(2), '| feesTotales:', test.feesTotales.toFixed(2), '| gasTotales:', test.gasTotales.toFixed(2));
    test.rebalanceHistory.forEach((s) =>
      console.log(`  Seg ${s.segmento}: $${s.precioInicio.toFixed(0)}→$${s.precioFin.toFixed(0)} | IL=${s.ilSegmento.toFixed(4)} | cap: $${s.capitalAntes.toFixed(2)}→$${s.capitalDespues.toFixed(2)} | fees: $${s.feesSegmento.toFixed(2)}`)
    );
    console.log('================================');
  }

  // ── Break-even row renderer ───────────────────────────────────────────────

  function beRow(label: string, be: number | null) {
    return (
      <tr key={label} className="border-b border-[#1a1a1a]">
        <td className="px-3 py-3 text-[#666] w-36 whitespace-nowrap">{label}</td>
        <td className="px-3 py-3">
          {entryPrice <= 0 ? (
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
          {entryPrice > 0 && be !== null && be > 0 && beComparisonPrice > 0 && (
            beComparisonPrice >= be ? (
              <span style={{ color: '#c8f135' }}>
                ✓ {hasFinalPrice ? 'Precio final' : 'Precio actual'} cubre
              </span>
            ) : (
              <span style={{ color: '#ff5252' }}>
                Faltan {fmtUSD(be - beComparisonPrice)}{' '}
                ({fmtPct(((be - beComparisonPrice) / beComparisonPrice) * 100)})
              </span>
            )
          )}
        </td>
      </tr>
    );
  }

  // ── Section 1 rows (dynamically adds IL rows when finalPrice is set) ───────

  const sec1Rows: { label: string; vals: React.ReactNode[] }[] = [
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
      label: hasFinalPrice ? 'Capital LP (con IL)' : 'Capital final LP',
      vals: [r0, r50, r100].map((r) => fmtUSD(r.capitalFinalLP * il)),
    },
    ...(hasFinalPrice
      ? [
          {
            label: 'IL estimado ($)',
            vals: [r0, r50, r100].map((r, i) => (
              <span key={i} style={{ color: '#ff5252' }}>
                −{fmtUSD(r.capitalFinalLP * (1 - il))}
              </span>
            )),
          },
          {
            label: 'Efecto precio LP',
            vals: [r0, r50, r100].map((r, i) => {
              const delta = r.capitalFinalLP * (il - 1);
              return (
                <span key={i} style={{ color: delta >= 0 ? '#c8f135' : '#ff5252' }}>
                  {delta >= 0 ? '+' : ''}{fmtUSD(delta)}
                </span>
              );
            }),
          },
        ]
      : []),
    {
      label: 'Capital total',
      vals: [ct0, ct50, ct100].map((ct, i) => (
        <span key={i} style={{ color: positiveColor(ct, capital) }}>
          {fmtUSD(ct)}
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
      vals: [ct0, ct50, ct100].map((ct, i) => (
        <span key={i} style={{ color: positiveColor(ct, capital) }}>
          {fmtPct(((ct - capital) / capital) * 100)}
        </span>
      )),
    },
  ];

  const chartScenarios = scenarios.slice(0, 3);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Inputs ── */}
      <Box>
        <SectionTitle>Parámetros del simulador</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Capital */}
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

          {/* APR anual */}
          <div>
            <FieldLabel>APR anual estimado (%)</FieldLabel>
            <Input
              type="number"
              value={annualApr}
              onChange={(v) => setAnnualApr(Math.max(1, Number(v)))}
              min={1}
              max={500}
              step={0.1}
            />
            <p className="text-xs font-mono text-[#444] mt-1">
              ≈ {fmtPct(annualApr)} APR anual · {fmtPct(monthlyApr)} mensual · {fmtPct(dailyApr)} diario
            </p>
            {annualApr > 200 && (
              <p className="text-xs font-mono mt-1" style={{ color: '#ff8c42' }}>
                ⚠ APR muy alto — verifica que es % anual, no diario
              </p>
            )}
            <p className="text-xs font-mono text-[#333] mt-1">
              Introduce el APR anual esperado del pool.<br />
              Pools ETH-USDC típicos: 15-50% anual.<br />
              Puedes obtenerlo del backtest histórico.
            </p>
          </div>

          {/* Período */}
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
              onChange={(v) =>
                setMonths(Math.min(36, Math.max(1, Math.round(Number(v)))))
              }
              min={1}
              max={36}
              className="mt-2"
            />
          </div>

          {/* Precio entrada */}
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

          {/* Precio final (opcional) */}
          <div>
            <FieldLabel>Precio final ETH ($) — opcional</FieldLabel>
            <Input
              type="number"
              value={finalPriceStr}
              onChange={setFinalPriceStr}
              placeholder="dejar vacío = mismo precio"
              min={0}
              step={10}
            />
            {hasFinalPrice && entryPrice > 0 && (
              <p className="text-xs font-mono mt-1" style={{ color: positiveColor(finalPrice, p0) }}>
                {fmtPct(((finalPrice - p0) / p0) * 100)} desde entrada ·
                IL factor: {(il * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </Box>

      {/* ── Section 1: Proyección ── */}
      <Box>
        <SectionTitle>
          1 —{' '}
          {hasFinalPrice
            ? `Proyección con precio objetivo (${fmtUSD(finalPrice)})`
            : 'Precio estático (sin movimiento de ETH)'}
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr>
                {['', '0% compound', '50% compound', '100% compound'].map((h, i) => (
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
              {sec1Rows.map((row, ri) => (
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
                  {hasFinalPrice ? 'vs precio final' : 'Estado actual'}
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

      {/* ── Section 3: Custom scenarios ── */}
      <Box>
        <SectionTitle>3 — Escenarios de precio personalizables</SectionTitle>

        {/* Preset quick-add buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-mono text-[#555]">Añadir rápido:</span>
          {PRESET_CHANGES.map((pct) => {
            const exists = scenarios.some((s) => s.changePct === pct);
            const col = pct > 0 ? '#c8f135' : pct < 0 ? '#ff5252' : '#888';
            return (
              <button
                key={pct}
                onClick={() => addPreset(pct)}
                disabled={exists}
                className="px-2 py-1 text-xs font-mono rounded border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderColor: col, color: col, background: 'transparent' }}
              >
                {pct > 0 ? `+${pct}%` : pct === 0 ? '±0%' : `${pct}%`}
              </button>
            );
          })}
          <button
            onClick={addScenario}
            className="px-2 py-1 text-xs font-mono rounded border border-[#333] text-[#888] hover:border-[#c8f135] hover:text-[#c8f135] transition-all cursor-pointer"
          >
            + Añadir escenario
          </button>
        </div>

        {/* Scenario editor rows */}
        {scenarios.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {scenarios.map((sc) => (
              <div key={sc.id} className="flex items-center gap-2">
                <Input
                  value={sc.label}
                  onChange={(v) => updateScenario(sc.id, { label: v })}
                  placeholder="Etiqueta"
                  className="!w-32 flex-shrink-0"
                />
                <Input
                  type="number"
                  value={sc.changePct}
                  onChange={(v) => updateScenario(sc.id, { changePct: Number(v) })}
                  placeholder="ej: +50 o -30"
                  step={1}
                  className="!w-24 flex-shrink-0"
                />
                <span className="text-xs font-mono text-[#555]">%</span>
                <button
                  onClick={() => removeScenario(sc.id)}
                  className="text-xs font-mono text-[#444] hover:text-[#ff5252] transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Scenario results table */}
        {scenarios.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr>
                    {['Escenario', 'Hold (sin LP)', '0% compound', '50% compound', '100% compound'].map(
                      (h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-[#555] uppercase tracking-wider font-normal border-b border-[#222]"
                          style={{ textAlign: i === 0 ? 'left' : 'right' }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((sc, ri) => {
                    const p1 = p0 * (1 + sc.changePct / 100);
                    const holdV = capital * (1 + sc.changePct / 100);
                    const v0   = simulateWithPriceMove(capital, dailyApr, days, p0, p1, 0);
                    const v50  = simulateWithPriceMove(capital, dailyApr, days, p0, p1, 50);
                    const v100 = simulateWithPriceMove(capital, dailyApr, days, p0, p1, 100);
                    if (sc.changePct === 0) {
                      console.log('Verificación escenario 0%:');
                      console.log('  0% compound:', v0.toFixed(2), '(esperado: capital +', (capital * dailyApr / 100 * days).toFixed(2), 'en fees)');
                      console.log('  Hold:', holdV.toFixed(2), '(esperado:', capital.toFixed(2), ')');
                    }
                    return (
                      <tr key={sc.id} className={ri % 2 === 0 ? 'bg-[#0d0d0d]' : ''}>
                        <td className="px-3 py-2 text-[#888]">
                          {sc.label}
                          <span className="ml-2 text-[#444]">
                            ({sc.changePct >= 0 ? '+' : ''}{sc.changePct}%)
                          </span>
                        </td>
                        {/* Hold */}
                        <td
                          className="px-3 py-2 text-right"
                          style={{ color: positiveColor(holdV, capital) }}
                        >
                          {fmtUSD(holdV)}
                          <span className="ml-1 font-normal text-[#555]">
                            ({fmtPct(((holdV - capital) / capital) * 100)})
                          </span>
                        </td>
                        {/* LP strategies */}
                        {[v0, v50, v100].map((v, vi) => (
                          <td
                            key={vi}
                            className="px-3 py-2 text-right font-bold"
                            style={{ color: positiveColor(v, capital) }}
                          >
                            {fmtUSD(v)}
                            <span className="ml-1 font-normal text-[#555]">
                              ({fmtPct(((v - capital) / capital) * 100)})
                            </span>
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
          </>
        ) : (
          <p className="text-xs font-mono text-[#555]">
            Sin escenarios. Usa los botones rápidos o &quot;+ Añadir escenario&quot;.
          </p>
        )}
      </Box>

      {/* ── Section 4: Projection chart ── */}
      <Box>
        <SectionTitle>4 — Proyección mes a mes</SectionTitle>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
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
            <Legend wrapperStyle={{ fontFamily: 'Courier New', fontSize: 10, color: '#666' }} />
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
            {/* Base lines */}
            <Line type="monotone" dataKey="hold" name="Hold (sin LP)" stroke="#555" dot={false} strokeWidth={1.5} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="c0" name="0% compound" stroke="#42a5f5" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="c50" name="50% compound" stroke="#ff8c42" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="c100" name="100% compound" stroke="#c8f135" dot={false} strokeWidth={2} />
            {/* Scenario lines (up to 3, 0% compound LP under each scenario's price path) */}
            {chartScenarios.map((sc, si) => (
              <Line
                key={sc.id}
                type="monotone"
                dataKey={`sc${si}`}
                name={`${sc.label} (0%c)`}
                stroke={SC_COLORS[si]}
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="2 3"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {chartScenarios.length > 0 && (
          <p className="text-xs font-mono text-[#444] mt-2">
            Líneas punteadas: LP 0% compound bajo precio de cada escenario (máx. 3)
          </p>
        )}
      </Box>

      {/* ── Section 5: Simulación de escenario personalizado ── */}
      <Box>
        <SectionTitle>5 — Simulación de escenario personalizado</SectionTitle>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Panel izquierdo: inputs ── */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Precio inicial ($)</FieldLabel>
                <Input type="number" value={sc5PrecioInicial} onChange={(v) => setSc5PrecioInicial(Math.max(0, Number(v)))} min={0} step={10} />
              </div>
              <div>
                <FieldLabel>Precio mínimo / valle ($)</FieldLabel>
                <Input type="number" value={sc5PrecioMinimo} onChange={(v) => setSc5PrecioMinimo(Math.max(0, Number(v)))} min={0} step={10} />
              </div>
              <div>
                <FieldLabel>Precio final ($)</FieldLabel>
                <Input type="number" value={sc5PrecioFinal} onChange={(v) => setSc5PrecioFinal(Math.max(0, Number(v)))} min={0} step={10} />
              </div>
              <div>
                <FieldLabel>Rango inicial ±%</FieldLabel>
                <Input type="number" value={sc5Rango} onChange={(v) => setSc5Rango(Math.max(0, Number(v)))} min={0} max={100} step={1} />
                <p className="text-xs font-mono text-[#333] mt-1">Solo informativo</p>
              </div>
              <div>
                <FieldLabel>Fee tier</FieldLabel>
                <Select
                  value={sc5FeeTier}
                  onChange={setSc5FeeTier}
                  options={[
                    { value: '0.0001', label: '0.01% — Stable' },
                    { value: '0.0005', label: '0.05% — Standard' },
                    { value: '0.003',  label: '0.30% — ETH/stable' },
                    { value: '0.01',   label: '1.00% — Exotic' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel>APR anual estimado (%)</FieldLabel>
                <Input type="number" value={sc5AprAnual} onChange={(v) => setSc5AprAnual(Math.max(0.01, Number(v)))} min={0.01} max={500} step={0.1} />
              </div>
              <div>
                <FieldLabel>Gas por rebalanceo ($)</FieldLabel>
                <Input type="number" value={sc5GasUSD} onChange={(v) => setSc5GasUSD(Math.max(0, Number(v)))} min={0} step={1} />
              </div>
              <div>
                <FieldLabel>Capital (pre-relleno)</FieldLabel>
                <Input type="number" value={capital} onChange={() => {}} />
                <p className="text-xs font-mono text-[#333] mt-1">Editar en parámetros</p>
              </div>
            </div>
            <div>
              <RangeSlider
                label="Nº de rebalanceos durante la bajada"
                value={sc5NRebalanceos}
                onChange={setSc5NRebalanceos}
                min={1}
                max={10}
                displayValue={`${sc5NRebalanceos} rebalanceo${sc5NRebalanceos !== 1 ? 's' : ''}`}
              />
            </div>
            <Button onClick={handleSimular} variant="primary" size="md" className="mt-2 w-full">
              ▶ Simular escenario
            </Button>
          </div>

          {/* ── Panel derecho: resultados ── */}
          {sc5Result ? (() => {
            const { capitalFinal, feesTotales, gasTotales, ilTotalFactor } = sc5Result;
            const ilLoss = capital * (1 - ilTotalFactor);
            const delta  = capitalFinal - capital;
            const p0s    = sc5PrecioInicial > 0 ? sc5PrecioInicial : 1;
            const be     = findBreakEven(capital, capitalFinal, 0, p0s);
            const beRef  = sc5PrecioFinal > 0 ? sc5PrecioFinal : p0s;

            return (
              <div className="flex flex-col gap-4">

                {/* 2×2 metric grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Valor final', val: fmtUSD(capitalFinal), color: positiveColor(capitalFinal, capital) },
                    { label: 'Resultado vs inicial', val: `${delta >= 0 ? '+' : ''}${fmtPct((delta / capital) * 100)}`, color: positiveColor(capitalFinal, capital) },
                    { label: 'Fees totales', val: fmtUSD(feesTotales), color: '#c8f135' },
                    { label: 'Gas total', val: `−${fmtUSD(gasTotales)}`, color: '#ff8c42' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-[#0d0d0d] border border-[#222] rounded p-3">
                      <p className="text-xs font-mono text-[#555] uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-lg font-mono font-bold" style={{ color }}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Breakdown table */}
                <table className="w-full text-xs font-mono border-collapse">
                  <tbody>
                    {[
                      { label: 'Capital inicial',         val: fmtUSD(capital),       color: '#ccc' },
                      { label: 'IL total (factor)',        val: `×${ilTotalFactor.toFixed(4)} (−${fmtUSD(ilLoss)})`, color: '#ff5252' },
                      { label: 'Gas total',               val: `−${fmtUSD(gasTotales)}`, color: '#ff8c42' },
                      { label: 'Fees generadas',          val: `+${fmtUSD(feesTotales)}`, color: '#c8f135' },
                      { label: '─────────────────',       val: '──────────', color: '#333' },
                      { label: 'Valor final',             val: fmtUSD(capitalFinal), color: positiveColor(capitalFinal, capital) },
                      { label: 'Diferencia vs inicial',   val: `${delta >= 0 ? '+' : ''}${fmtUSD(delta)}`, color: positiveColor(capitalFinal, capital) },
                    ].map(({ label, val, color }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#0d0d0d]' : ''}>
                        <td className="px-3 py-2 text-[#666]">{label}</td>
                        <td className="px-3 py-2 text-right" style={{ color }}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Break-even */}
                <div className="bg-[#0d0d0d] border border-[#222] rounded p-3">
                  <p className="text-xs font-mono text-[#555] uppercase tracking-wider mb-2">Break-even ETH price</p>
                  {capitalFinal >= capital ? (
                    <p className="text-sm font-mono font-bold" style={{ color: '#c8f135' }}>✓ Posición en beneficio — no necesitas break-even</p>
                  ) : be === null ? (
                    <p className="text-sm font-mono text-[#555]">— No recuperable con movimiento de precio</p>
                  ) : be === 0 ? (
                    <p className="text-sm font-mono" style={{ color: '#c8f135' }}>✓ Fees cubren el capital</p>
                  ) : (
                    <>
                      <p className="text-sm font-mono font-bold" style={{ color: beRef >= be ? '#c8f135' : '#ff8c42' }}>
                        ETH ≥ {fmtUSD(be)}
                        <span className="ml-2 font-normal text-[#555]">
                          ({fmtPct(((be - p0s) / p0s) * 100)} desde precio inicial)
                        </span>
                      </p>
                      {beRef < be && (
                        <p className="text-xs font-mono mt-1" style={{ color: '#ff5252' }}>
                          Faltan {fmtUSD(be - beRef)} ({fmtPct(((be - beRef) / beRef) * 100)}) para cubrir
                        </p>
                      )}
                    </>
                  )}
                </div>

              </div>
            );
          })() : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs font-mono text-[#444]">Configura los parámetros y pulsa ▶ Simular escenario</p>
            </div>
          )}
        </div>

        {/* ── Tabla de rebalanceos ── */}
        {sc5Result && sc5Result.rebalanceHistory.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-mono text-[#555] uppercase tracking-wider mb-2">Historial de rebalanceos (fase 1 — bajada)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr>
                    {['#', 'Precio inicio', 'Precio fin', 'IL segmento', 'Capital antes', 'Fees', 'Gas', 'Capital tras rebal'].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-[#555] uppercase tracking-wider font-normal border-b border-[#222]" style={{ textAlign: i === 0 ? 'left' : 'right' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sc5Result.rebalanceHistory.map((s, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-[#0d0d0d]' : ''}>
                      <td className="px-3 py-2 text-[#666]">{s.segmento}</td>
                      <td className="px-3 py-2 text-right text-[#ccc]">{fmtUSD(s.precioInicio)}</td>
                      <td className="px-3 py-2 text-right text-[#ccc]">{fmtUSD(s.precioFin)}</td>
                      <td className="px-3 py-2 text-right" style={{ color: '#ff5252' }}>
                        −{fmtPct((1 - s.ilSegmento) * 100)}
                      </td>
                      <td className="px-3 py-2 text-right text-[#888]">{fmtUSD(s.capitalAntes)}</td>
                      <td className="px-3 py-2 text-right" style={{ color: '#c8f135' }}>+{fmtUSD(s.feesSegmento)}</td>
                      <td className="px-3 py-2 text-right" style={{ color: '#ff8c42' }}>−{fmtUSD(s.gasSegmento)}</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: positiveColor(s.capitalDespues, s.capitalAntes) }}>
                        {fmtUSD(s.capitalDespues)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Box>
    </div>
  );
}
