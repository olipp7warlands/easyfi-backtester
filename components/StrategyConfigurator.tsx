'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import { Button, Badge } from './ui';
import { recommendStrategies } from '@/lib/recommend';
import { fetchCandles } from '@/lib/binance';
import { fmtDate, fmtPrice, fmtUSD } from '@/lib/format';
import { NETWORKS } from '@/lib/constants';
import type { BacktestParams, Strategy, Candle, Network } from '@/types';
import type {
  UserProfile, RecommendedStrategy,
  TimeHorizon, Preference, Volatility,
} from '@/lib/recommend';

interface Props {
  params: BacktestParams;
  onAddStrategy: (s: Strategy) => void;
  onRunBacktest: () => void;
  onGoToConfig: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1 as const, label: 'Perfil' },
    { n: 2 as const, label: 'Recomendación' },
    { n: 3 as const, label: 'Preview' },
  ];
  return (
    <div className="flex items-center mb-8">
      {steps.map(({ n, label }, i) => (
        <div key={n} className="flex items-center flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <div className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all',
              step === n ? 'bg-[#c8f135] text-black'
                : step > n ? 'border border-[#c8f135] text-[#c8f135]'
                : 'border border-[#333] text-[#444]',
            )}>
              {step > n ? '✓' : n}
            </div>
            <span className={clsx(
              'text-xs font-mono transition-colors',
              step === n ? 'text-[#c8f135]' : step > n ? 'text-[#888]' : 'text-[#444]',
            )}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={clsx(
              'flex-1 h-px mx-3 transition-colors',
              step > n ? 'bg-[#c8f13544]' : 'bg-[#1f1f1f]',
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function OptionBtn({
  label, sub, selected, onClick,
}: {
  label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all font-mono',
        selected
          ? 'border-[#c8f135] bg-[#c8f13512] text-[#c8f135]'
          : 'border-[#222] bg-[#111] text-[#777] hover:border-[#444] hover:text-[#ccc]',
      )}
    >
      <span className="font-bold text-sm leading-tight">{label}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </button>
  );
}

function QuestionBlock({
  q, children,
}: {
  q: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="text-sm font-mono text-[#ccc] mb-3 font-bold">{q}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FitBar({ score }: { score: number }) {
  const color = score >= 80 ? '#c8f135' : score >= 60 ? '#ff8c42' : '#ff5252';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-mono text-[#555]">Fit Score</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {score}/100
        </span>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: color, transition: 'width 0.6s ease' }}
        />
      </div>
    </div>
  );
}

function RecCard({
  rec, onSelect,
}: {
  rec: RecommendedStrategy; onSelect: () => void;
}) {
  const riskColor = { low: '#c8f135', medium: '#ff8c42', high: '#ff5252' }[rec.riskLevel];
  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4 border-2"
      style={{ borderColor: rec.strategy.color, backgroundColor: `${rec.strategy.color}08` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rec.strategy.color }} />
          <span className="font-mono font-bold text-sm" style={{ color: rec.strategy.color }}>
            {rec.strategy.name}
          </span>
        </div>
        <Badge color={riskColor}>{rec.riskLevel}</Badge>
      </div>

      {/* APR */}
      <div>
        <div className="text-xs font-mono text-[#555] mb-0.5">APR proyectado</div>
        <div className="text-2xl font-mono font-bold" style={{ color: '#c8f135' }}>
          ~{rec.projectedAPR}%
        </div>
      </div>

      <FitBar score={rec.fitScore} />

      {/* Reasoning */}
      <div>
        <div className="text-xs font-mono text-[#444] uppercase tracking-wider mb-1.5">
          Por qué encaja
        </div>
        <ul className="flex flex-col gap-1.5">
          {rec.reasoning.map((r, i) => (
            <li key={i} className="flex gap-1.5 text-xs font-mono text-[#aaa] leading-snug">
              <span className="text-[#c8f135] shrink-0 mt-px">+</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Tradeoffs */}
      <div>
        <div className="text-xs font-mono text-[#444] uppercase tracking-wider mb-1.5">
          Contras
        </div>
        <ul className="flex flex-col gap-1.5">
          {rec.tradeoffs.map((t, i) => (
            <li key={i} className="flex gap-1.5 text-xs font-mono text-[#777] leading-snug">
              <span className="text-[#ff5252] shrink-0 mt-px">−</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <Button variant="primary" onClick={onSelect} size="sm" className="mt-auto w-full">
        Usar esta estrategia →
      </Button>
    </div>
  );
}

function MiniChart({
  candles, strategy, entryPrice,
}: {
  candles: Candle[]; strategy: Strategy; entryPrice: number;
}) {
  const pct = strategy.rangePct / 100;
  const lo = strategy.absLo ?? entryPrice * (1 - pct);
  const hi = strategy.absHi ?? entryPrice * (1 + pct);
  const currentPrice = candles[candles.length - 1]?.close ?? 0;
  const data = candles.map((c) => ({ time: c.time, price: c.close }));
  const TICK = { fill: '#444', fontSize: 9, fontFamily: 'Courier New' };
  const TT = { backgroundColor: '#161616', border: '1px solid #2a2a2a', borderRadius: 4, fontFamily: 'Courier New', fontSize: 10, color: '#ccc' };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="miniPriceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#888" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#888" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis dataKey="time" tickFormatter={fmtDate} stroke="#222" tick={TICK} />
        <YAxis tickFormatter={(v) => fmtPrice(v)} stroke="#222" tick={TICK} width={60} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={TT}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [fmtPrice(v), 'Precio']}
          labelFormatter={(t) => fmtDate(t as number)}
        />
        {/* Strategy range band */}
        <ReferenceArea
          y1={lo} y2={hi}
          fill={strategy.color} fillOpacity={0.12}
          stroke={strategy.color} strokeOpacity={0.4} strokeDasharray="3 4"
        />
        <ReferenceLine y={entryPrice} stroke="#ff8c42" strokeDasharray="5 3" strokeWidth={1.5}
          label={{ value: `Entry ${fmtPrice(entryPrice)}`, fill: '#ff8c42', fontSize: 8, fontFamily: 'Courier New', position: 'insideTopRight' }} />
        <ReferenceLine y={currentPrice} stroke="#42a5f5" strokeDasharray="5 3" strokeWidth={1.5}
          label={{ value: `Now ${fmtPrice(currentPrice)}`, fill: '#42a5f5', fontSize: 8, fontFamily: 'Courier New', position: 'insideBottomRight' }} />
        <Area type="monotone" dataKey="price" stroke="#888" fill="url(#miniPriceGrad)"
          dot={false} strokeWidth={1.5} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function QuickEstimates({
  rec, params,
}: {
  rec: RecommendedStrategy; params: BacktestParams;
}) {
  const { strategy } = rec;
  const pctInRange =
    strategy.type === 'scalp' ? 45
    : strategy.type === 'dyn' ? 75
    : strategy.rangePct >= 10 ? 90
    : strategy.rangePct >= 5  ? 70 : 55;

  const dailyFee = (params.capital / params.tvl) * params.dailyVol * params.feeTier * (pctInRange / 100);
  const total30 = dailyFee * 30;

  const ilLabel =
    strategy.rangePct <= 3 ? 'Medio'
    : strategy.rangePct <= 7 ? 'Bajo'
    : 'Muy bajo';

  const rebalLabel =
    strategy.type === 'scalp' ? '10–30 / mes'
    : strategy.type === 'dyn'  ? '3–8 / mes'
    : 'Ninguno';

  const items = [
    { label: 'Fees estimados / 30d', value: fmtUSD(total30), color: '#c8f135' },
    { label: '% Tiempo en rango',    value: `~${pctInRange}%`,               color: '#ccc' },
    { label: 'IL esperado',          value: ilLabel,                          color: '#ff8c42' },
    { label: 'Rebalanceos',          value: rebalLabel,                       color: '#888' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {items.map(({ label, value, color }) => (
        <div key={label} className="bg-[#0d0d0d] rounded-lg p-3 border border-[#1a1a1a]">
          <div className="text-xs font-mono text-[#555] mb-1">{label}</div>
          <div className="text-base font-mono font-bold" style={{ color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function StrategyConfigurator({
  params, onAddStrategy, onRunBacktest, onGoToConfig,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    network: params.network,
  });
  const [recs, setRecs] = useState<RecommendedStrategy[]>([]);
  const [selected, setSelected] = useState<RecommendedStrategy | null>(null);
  const [previewCandles, setPreviewCandles] = useState<Candle[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const complete = !!(profile.network && profile.timeHorizon && profile.preference && profile.volatility);

  function goStep2() {
    if (!complete) return;
    setRecs(recommendStrategies(profile as UserProfile));
    setStep(2);
  }

  async function selectRec(rec: RecommendedStrategy) {
    setSelected(rec);
    setStep(3);
    setLoadingPreview(true);
    try {
      const candles = await fetchCandles(params.symbol, 30);
      setPreviewCandles(candles);
    } catch { /* show empty chart */ }
    finally { setLoadingPreview(false); }
  }

  function handleRunBacktest() {
    if (!selected) return;
    onAddStrategy(selected.strategy);
    onRunBacktest();
  }

  function handleGoToConfig() {
    if (!selected) return;
    onAddStrategy(selected.strategy);
    onGoToConfig();
  }

  const entryPrice = previewCandles[0]?.close ?? 0;
  const networkName = NETWORKS.find((n) => n.value === params.network)?.label ?? params.network;

  return (
    <div className="max-w-4xl mx-auto">
      <StepIndicator step={step} />

      {/* ── STEP 1: PERFIL ── */}
      {step === 1 && (
        <div className="bg-[#111] border border-[#222] rounded-lg p-6">
          <h2 className="text-base font-mono font-bold text-[#c8f135] mb-6 uppercase tracking-wider">
            Perfil de inversor
          </h2>

          <QuestionBlock q="Q1 — ¿En qué red operas?">
            {NETWORKS.map((n) => (
              <OptionBtn
                key={n.value}
                label={n.label}
                sub={`gas ~$${n.gasUSD}`}
                selected={profile.network === n.value}
                onClick={() => setProfile((p) => ({ ...p, network: n.value as Network }))}
              />
            ))}
          </QuestionBlock>

          <QuestionBlock q="Q2 — ¿Cuánto tiempo dejas el capital?">
            {([
              { v: 'short',  label: '1–2 semanas', sub: 'corto plazo' },
              { v: 'medium', label: '1 mes',        sub: 'medio plazo' },
              { v: 'long',   label: '3+ meses',     sub: 'largo plazo' },
            ] as { v: TimeHorizon; label: string; sub: string }[]).map(({ v, label, sub }) => (
              <OptionBtn key={v} label={label} sub={sub}
                selected={profile.timeHorizon === v}
                onClick={() => setProfile((p) => ({ ...p, timeHorizon: v }))} />
            ))}
          </QuestionBlock>

          <QuestionBlock q="Q3 — ¿Qué prefieres?">
            {([
              { v: 'fees',     label: 'Máximos fees',          sub: 'más rebalanceos' },
              { v: 'balanced', label: 'Fees / Estabilidad',    sub: 'equilibrio' },
              { v: 'passive',  label: 'Mínimo mantenimiento',  sub: 'set & forget' },
            ] as { v: Preference; label: string; sub: string }[]).map(({ v, label, sub }) => (
              <OptionBtn key={v} label={label} sub={sub}
                selected={profile.preference === v}
                onClick={() => setProfile((p) => ({ ...p, preference: v }))} />
            ))}
          </QuestionBlock>

          <QuestionBlock q="Q4 — ¿Volatilidad esperada del par?">
            {([
              { v: 'low',    label: 'Baja',   sub: 'stablecoins' },
              { v: 'medium', label: 'Media',  sub: 'ETH, BTC' },
              { v: 'high',   label: 'Alta',   sub: 'alts' },
            ] as { v: Volatility; label: string; sub: string }[]).map(({ v, label, sub }) => (
              <OptionBtn key={v} label={label} sub={sub}
                selected={profile.volatility === v}
                onClick={() => setProfile((p) => ({ ...p, volatility: v }))} />
            ))}
          </QuestionBlock>

          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#1a1a1a]">
            <Button
              variant="primary" size="lg"
              onClick={goStep2} disabled={!complete}
            >
              Ver recomendaciones →
            </Button>
            {!complete && (
              <span className="text-xs font-mono text-[#444]">
                Completa todas las preguntas para continuar
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: RECOMENDACIÓN ── */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-mono font-bold text-[#c8f135] uppercase tracking-wider">
                Estrategias recomendadas
              </h2>
              <p className="text-xs font-mono text-[#555] mt-0.5">
                {networkName} · {params.symbol} · basado en tu perfil
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              ← Perfil
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recs.map((rec) => (
              <RecCard key={rec.strategy.id} rec={rec} onSelect={() => selectRec(rec)} />
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW ── */}
      {step === 3 && selected && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-mono font-bold uppercase tracking-wider"
                style={{ color: selected.strategy.color }}>
                {selected.strategy.name}
              </h2>
              <p className="text-xs font-mono text-[#555] mt-0.5">
                Preview · {params.symbol} · últimos 30 días
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              ← Ver otras
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mini chart */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-4">
              <div className="text-xs font-mono text-[#555] uppercase tracking-wider mb-3">
                Precio + rango de la estrategia
              </div>
              {loadingPreview ? (
                <div className="h-[220px] flex items-center justify-center">
                  <span className="text-xs font-mono text-[#444] animate-pulse">
                    Cargando datos de precio…
                  </span>
                </div>
              ) : previewCandles.length > 0 ? (
                <MiniChart
                  candles={previewCandles}
                  strategy={selected.strategy}
                  entryPrice={entryPrice}
                />
              ) : (
                <div className="h-[220px] flex items-center justify-center">
                  <span className="text-xs font-mono text-[#333]">
                    Sin datos de precio disponibles
                  </span>
                </div>
              )}

              {/* Range info */}
              <div className="flex gap-4 mt-3 pt-3 border-t border-[#1a1a1a]">
                {(['lo', 'hi'] as const).map((side) => {
                  const pct = selected.strategy.rangePct / 100;
                  const price = side === 'lo'
                    ? (selected.strategy.absLo ?? entryPrice * (1 - pct))
                    : (selected.strategy.absHi ?? entryPrice * (1 + pct));
                  return (
                    <div key={side}>
                      <div className="text-xs font-mono text-[#444]">
                        {side === 'lo' ? 'Límite bajo' : 'Límite alto'}
                      </div>
                      <div className="text-sm font-mono font-bold" style={{ color: selected.strategy.color }}>
                        {entryPrice > 0 ? fmtPrice(price) : `${side === 'lo' ? '-' : '+'}${selected.strategy.rangePct}%`}
                      </div>
                    </div>
                  );
                })}
                <div>
                  <div className="text-xs font-mono text-[#444]">APR proyectado</div>
                  <div className="text-sm font-mono font-bold text-[#c8f135]">
                    ~{selected.projectedAPR}%
                  </div>
                </div>
              </div>
            </div>

            {/* Estimates + actions */}
            <div className="flex flex-col gap-4">
              <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                <div className="text-xs font-mono text-[#555] uppercase tracking-wider mb-1">
                  Estimaciones rápidas
                </div>
                <p className="text-xs font-mono text-[#333] mb-2">
                  Basadas en vol ${(params.dailyVol / 1e6).toFixed(0)}M/d · TVL ${(params.tvl / 1e6).toFixed(0)}M · capital ${(params.capital / 1e3).toFixed(0)}K
                </p>
                <QuickEstimates rec={selected} params={params} />
              </div>

              {/* Fit summary */}
              <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                <FitBar score={selected.fitScore} />
                <ul className="mt-3 flex flex-col gap-1.5">
                  {selected.reasoning.map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-xs font-mono text-[#aaa] leading-snug">
                      <span className="text-[#c8f135] shrink-0">+</span>{r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="lg" className="w-full" onClick={handleRunBacktest}>
                  ▶ Ejecutar backtest con esta estrategia
                </Button>
                <Button variant="secondary" size="md" className="w-full" onClick={handleGoToConfig}>
                  Añadir a configuración y revisar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
