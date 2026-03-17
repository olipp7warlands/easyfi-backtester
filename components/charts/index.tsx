'use client';

import {
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { fmtDate, fmtUSD, fmtPrice } from '@/lib/format';
import type { StratResult } from '@/types';

// ── 0. PriceChart — terminal-style price + fees sub-chart ────────────────────
export function PriceChart({
  results,
  entryPrice,
  currentPrice,
}: {
  results: StratResult[];
  entryPrice: number;
  currentPrice: number;
}) {
  if (!results.length) return null;

  const lpResults = results.filter((r) => r.strategy.type !== 'hold');

  // Build merged price + dailyFees dataset
  const map = new Map<number, Record<string, number>>();
  for (const p of results[0].points) {
    map.set(p.time, { time: p.time, price: p.price });
  }
  for (const r of lpResults) {
    for (const p of r.points) {
      const row = map.get(p.time);
      if (row) row[`dfee_${r.strategy.id}`] = p.dailyFees;
    }
  }
  const data = Array.from(map.values()).sort((a, b) => a.time - b.time);

  // Initial range bounds per LP strategy
  const rangeBands = lpResults.flatMap((r) => {
    const pct = r.strategy.rangePct / 100;
    const lo = r.strategy.absLo ?? entryPrice * (1 - pct);
    const hi = r.strategy.absHi ?? entryPrice * (1 + pct);
    return [
      <ReferenceLine key={`lo-${r.strategy.id}`} y={lo} stroke={r.strategy.color}
        strokeDasharray="3 5" strokeOpacity={0.65} strokeWidth={1} />,
      <ReferenceLine key={`hi-${r.strategy.id}`} y={hi} stroke={r.strategy.color}
        strokeDasharray="3 5" strokeOpacity={0.65} strokeWidth={1} />,
    ];
  });

  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-4">
      <h3 className="text-xs font-mono font-bold text-[#555] uppercase tracking-wider mb-1">
        Price History + Daily Fees
      </h3>

      {/* Legend row */}
      <div className="flex flex-wrap gap-3 mb-3">
        <span className="flex items-center gap-1 text-xs font-mono text-[#888]">
          <span className="inline-block w-3 h-0.5 bg-[#ccc]" /> Price
        </span>
        <span className="flex items-center gap-1 text-xs font-mono" style={{ color: '#ff8c42' }}>
          <span className="inline-block w-4 border-t border-dashed border-[#ff8c42]" /> Entry
        </span>
        <span className="flex items-center gap-1 text-xs font-mono" style={{ color: '#42a5f5' }}>
          <span className="inline-block w-4 border-t border-dashed border-[#42a5f5]" /> Current
        </span>
        {lpResults.map((r) => (
          <span key={r.strategy.id} className="flex items-center gap-1 text-xs font-mono"
            style={{ color: r.strategy.color }}>
            <span className="inline-block w-4 border-t border-dotted" style={{ borderColor: r.strategy.color }} />
            {r.strategy.name} range
          </span>
        ))}
      </div>

      {/* Top panel: price area */}
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} syncId="pricechart"
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ccc" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#ccc" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="time" tickFormatter={fmtDate} stroke={AXIS} tick={TICK} />
          <YAxis tickFormatter={(v) => fmtPrice(v)} stroke={AXIS} tick={TICK} width={72} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [fmtPrice(v), 'Price']}
            labelFormatter={(t) => fmtDate(t as number)}
          />
          <ReferenceLine y={entryPrice} stroke="#ff8c42" strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: `Entry ${fmtPrice(entryPrice)}`, fill: '#ff8c42', fontSize: 9, fontFamily: 'Courier New', position: 'insideTopRight' }} />
          <ReferenceLine y={currentPrice} stroke="#42a5f5" strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: `Now ${fmtPrice(currentPrice)}`, fill: '#42a5f5', fontSize: 9, fontFamily: 'Courier New', position: 'insideBottomRight' }} />
          {rangeBands}
          <Area type="monotone" dataKey="price" stroke="#888" fill="url(#priceGrad)"
            dot={false} strokeWidth={1.5} name="Price" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Bottom panel: daily fees bars */}
      {lpResults.length > 0 && (
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={data} syncId="pricechart"
            margin={{ top: 0, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="time" tickFormatter={fmtDate} stroke={AXIS} tick={TICK} />
            <YAxis tickFormatter={(v) => fmtUSD(v)} stroke={AXIS} tick={TICK} width={72} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any) => [fmtUSD(v), String(name).replace('dfee_', '')]}
              labelFormatter={(t) => fmtDate(t as number)}
            />
            {lpResults.map((r) => (
              <Bar key={r.strategy.id} dataKey={`dfee_${r.strategy.id}`}
                fill={r.strategy.color} fillOpacity={0.7}
                name={r.strategy.name} stackId="fees" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const GRID = '#1a1a1a';
const AXIS = '#333';
const TICK = { fill: '#555', fontSize: 10, fontFamily: 'Courier New' };
const TOOLTIP_STYLE = {
  backgroundColor: '#161616',
  border: '1px solid #2a2a2a',
  borderRadius: 4,
  fontFamily: 'Courier New, monospace',
  fontSize: 11,
  color: '#ccc',
};

function ChartBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-lg p-4">
      <h3 className="text-xs font-mono font-bold text-[#555] uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Merge all strategy points indexed by candle time */
function mergeByTime(results: StratResult[]) {
  if (!results.length) return [];
  const map = new Map<number, Record<string, number>>();

  for (const r of results) {
    for (const p of r.points) {
      if (!map.has(p.time)) map.set(p.time, { time: p.time, price: p.price });
      const row = map.get(p.time)!;
      row[`mv_${r.strategy.id}`] = p.marketValue;
      row[`fees_${r.strategy.id}`] = p.feesAccum;
      row[`il_${r.strategy.id}`] = p.ilDollar;
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
}

// ── 1. Performance Chart ─────────────────────────────────────────────────────
export function PerfChart({ results }: { results: StratResult[] }) {
  const data = mergeByTime(results);
  return (
    <ChartBox title="Portfolio Value Over Time">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="time" tickFormatter={fmtDate} stroke={AXIS} tick={TICK} />
          <YAxis tickFormatter={(v) => fmtUSD(v)} stroke={AXIS} tick={TICK} width={80} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [fmtUSD(v), String(name).replace('mv_', '')]}
            labelFormatter={(t) => fmtDate(t as number)}
          />
          <Legend
            formatter={(v) => v.replace('mv_', '')}
            wrapperStyle={{ fontSize: 10, fontFamily: 'Courier New' }}
          />
          {results.map((r) => (
            <Line
              key={r.strategy.id}
              type="monotone"
              dataKey={`mv_${r.strategy.id}`}
              stroke={r.strategy.color}
              dot={false}
              strokeWidth={1.5}
              name={r.strategy.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

// ── 2. Fees Chart ─────────────────────────────────────────────────────────────
export function FeesChart({ results }: { results: StratResult[] }) {
  const data = mergeByTime(results);
  return (
    <ChartBox title="Cumulative Fees Over Time">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="time" tickFormatter={fmtDate} stroke={AXIS} tick={TICK} />
          <YAxis tickFormatter={(v) => fmtUSD(v)} stroke={AXIS} tick={TICK} width={80} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [fmtUSD(v), String(name).replace('fees_', '')]}
            labelFormatter={(t) => fmtDate(t as number)}
          />
          <Legend
            formatter={(v) => v.replace('fees_', '')}
            wrapperStyle={{ fontSize: 10, fontFamily: 'Courier New' }}
          />
          {results
            .filter((r) => r.strategy.type !== 'hold')
            .map((r) => (
              <Area
                key={r.strategy.id}
                type="monotone"
                dataKey={`fees_${r.strategy.id}`}
                stroke={r.strategy.color}
                fill={`${r.strategy.color}18`}
                dot={false}
                strokeWidth={1.5}
                name={r.strategy.name}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

// ── 3. IL Chart ───────────────────────────────────────────────────────────────
export function ILChart({ results }: { results: StratResult[] }) {
  const data = mergeByTime(results);
  return (
    <ChartBox title="Impermanent Loss Over Time">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="time" tickFormatter={fmtDate} stroke={AXIS} tick={TICK} />
          <YAxis tickFormatter={(v) => fmtUSD(v)} stroke={AXIS} tick={TICK} width={80} />
          <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [fmtUSD(v), String(name).replace('il_', '')]}
            labelFormatter={(t) => fmtDate(t as number)}
          />
          <Legend
            formatter={(v) => v.replace('il_', '')}
            wrapperStyle={{ fontSize: 10, fontFamily: 'Courier New' }}
          />
          {results
            .filter((r) => r.strategy.type !== 'hold')
            .map((r) => (
              <Line
                key={r.strategy.id}
                type="monotone"
                dataKey={`il_${r.strategy.id}`}
                stroke={r.strategy.color}
                dot={false}
                strokeWidth={1.5}
                name={r.strategy.name}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

// ── 4. Comparison Bar Chart ───────────────────────────────────────────────────
export function ComparisonBarChart({ results }: { results: StratResult[] }) {
  const data = results.map((r) => ({
    name: r.strategy.name.length > 10 ? r.strategy.name.slice(0, 10) + '…' : r.strategy.name,
    Fees: r.metrics.totalFees,
    IL: r.metrics.totalIL,
    Costs: r.metrics.totalRebalCost,
  }));

  return (
    <ChartBox title="Fees vs IL vs Costs">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="name" stroke={AXIS} tick={TICK} />
          <YAxis tickFormatter={(v) => fmtUSD(v)} stroke={AXIS} tick={TICK} width={80} />
          <ReferenceLine y={0} stroke="#444" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => fmtUSD(v)}
          />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'Courier New' }} />
          <Bar dataKey="Fees" fill="#c8f135" radius={[2, 2, 0, 0]} />
          <Bar dataKey="IL" fill="#ff5252" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Costs" fill="#ff8c42" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

// ── 5. Price + Range Chart ────────────────────────────────────────────────────
export function PriceRangeChart({
  results,
  entryPrice,
  currentPrice,
}: {
  results: StratResult[];
  entryPrice: number;
  currentPrice: number;
}) {
  const priceData = (results[0]?.points ?? []).map((p) => ({
    time: p.time,
    price: p.price,
  }));

  return (
    <ChartBox title="Price & Strategy Ranges">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={priceData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="time" tickFormatter={fmtDate} stroke={AXIS} tick={TICK} />
          <YAxis
            tickFormatter={(v) => fmtPrice(v)}
            stroke={AXIS}
            tick={TICK}
            width={72}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [fmtPrice(v), 'Price']}
            labelFormatter={(t) => fmtDate(t as number)}
          />
          <ReferenceLine
            y={entryPrice}
            stroke="#ff8c42"
            strokeDasharray="5 3"
            label={{ value: 'Entry', fill: '#ff8c42', fontSize: 9, fontFamily: 'Courier New' }}
          />
          <ReferenceLine
            y={currentPrice}
            stroke="#42a5f5"
            strokeDasharray="5 3"
            label={{ value: 'Now', fill: '#42a5f5', fontSize: 9, fontFamily: 'Courier New' }}
          />
          {results
            .filter((r) => r.strategy.type !== 'hold')
            .flatMap((r) => {
              const pct = r.strategy.rangePct / 100;
              const lo =
                r.strategy.absLo !== undefined
                  ? r.strategy.absLo
                  : entryPrice * (1 - pct);
              const hi =
                r.strategy.absHi !== undefined
                  ? r.strategy.absHi
                  : entryPrice * (1 + pct);
              return [
                <ReferenceLine
                  key={`lo-${r.strategy.id}`}
                  y={lo}
                  stroke={r.strategy.color}
                  strokeDasharray="2 4"
                  strokeOpacity={0.7}
                />,
                <ReferenceLine
                  key={`hi-${r.strategy.id}`}
                  y={hi}
                  stroke={r.strategy.color}
                  strokeDasharray="2 4"
                  strokeOpacity={0.7}
                />,
              ];
            })}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#ccc"
            dot={false}
            strokeWidth={1.5}
            name="Price"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

// ── 6. PnL Chart ──────────────────────────────────────────────────────────────
export function PnlChart({
  results,
  capital,
}: {
  results: StratResult[];
  capital: number;
}) {
  const raw = mergeByTime(results);
  const data = raw.map((d) => {
    const row: Record<string, number> = { time: d.time };
    for (const r of results) {
      row[`pnl_${r.strategy.id}`] = (d[`mv_${r.strategy.id}`] ?? capital) - capital;
    }
    return row;
  });

  return (
    <ChartBox title="Net PnL Over Time">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="time" tickFormatter={fmtDate} stroke={AXIS} tick={TICK} />
          <YAxis tickFormatter={(v) => fmtUSD(v)} stroke={AXIS} tick={TICK} width={80} />
          <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [fmtUSD(v), String(name).replace('pnl_', '')]}
            labelFormatter={(t) => fmtDate(t as number)}
          />
          <Legend
            formatter={(v) => v.replace('pnl_', '')}
            wrapperStyle={{ fontSize: 10, fontFamily: 'Courier New' }}
          />
          {results.map((r) => (
            <Line
              key={r.strategy.id}
              type="monotone"
              dataKey={`pnl_${r.strategy.id}`}
              stroke={r.strategy.color}
              dot={false}
              strokeWidth={1.5}
              name={r.strategy.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
