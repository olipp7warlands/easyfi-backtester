import type { Candle, Strategy, SimConfig, SimPoint, Metrics, StratResult, BacktestParams, RebalanceEvent } from '@/types';

export function calcILFactor(p0: number, p1: number): number {
  if (p0 === 0) return 1;
  const ratio = p1 / p0;
  return (2 * Math.sqrt(ratio)) / (1 + ratio);
}

export function calcFeePerCandle(
  capital: number,
  tvl: number,
  dailyVol: number,
  feeTier: number,
  hoursPerCandle: number,
): number {
  if (tvl === 0) return 0;
  return (capital / tvl) * dailyVol * feeTier * (hoursPerCandle / 24);
}

function getRangeBounds(
  strategy: Strategy,
  entryPrice: number,
): { lo: number; hi: number } {
  if (
    strategy.type === 'fixed' &&
    strategy.absLo !== undefined &&
    strategy.absHi !== undefined
  ) {
    return { lo: strategy.absLo, hi: strategy.absHi };
  }
  const pct = strategy.rangePct / 100;
  return {
    lo: entryPrice * (1 - pct),
    hi: entryPrice * (1 + pct),
  };
}

export function simulateStrategy(
  strategy: Strategy,
  candles: Candle[],
  config: SimConfig,
  hoursPerCandle: number,
): { points: SimPoint[]; entryPrice: number; totalRebalCost: number; rebalanceHistory: RebalanceEvent[] } {
  if (candles.length === 0)
    return { points: [], entryPrice: 0, totalRebalCost: 0, rebalanceHistory: [] };

  const { capital, feeTier, dailyVol, tvl, gasCostPerRebal, slippage } = config;
  const rebalHours = strategy.rebalHours ?? config.rebalHours;
  const entryPrice = candles[0].close;

  let rangeLo = 0;
  let rangeHi = Infinity;
  if (strategy.type !== 'hold') {
    const bounds = getRangeBounds(strategy, entryPrice);
    rangeLo = bounds.lo;
    rangeHi = bounds.hi;
  }

  // Fraction of fees to reinvest (0 when not compounding)
  const compoundFraction = strategy.compounding ? (strategy.compoundPct ?? 100) / 100 : 0;

  let feesAccum = 0;
  let liquidFeesAccum = 0;
  let reinvestedFeesAccum = 0;
  let effectiveCapital = capital;
  let totalRebalCost = 0;
  let hoursSinceLastRebal = 0;
  let p0 = entryPrice;
  let rebalCount = 0;
  const points: SimPoint[] = [];
  const rebalanceHistory: RebalanceEvent[] = [];

  for (const candle of candles) {
    const price = candle.close;
    const inRange =
      strategy.type === 'hold' ? true : price >= rangeLo && price <= rangeHi;

    // Fees — only LP strategies earn fees, only when in range
    const feeCandle =
      strategy.type !== 'hold' && inRange
        ? calcFeePerCandle(effectiveCapital, tvl, dailyVol, feeTier, hoursPerCandle)
        : 0;

    const feesToReinvest = feeCandle * compoundFraction;
    const feesLiquid = feeCandle - feesToReinvest;

    feesAccum += feeCandle;
    liquidFeesAccum += feesLiquid;
    reinvestedFeesAccum += feesToReinvest;
    if (strategy.compounding) effectiveCapital += feesToReinvest;

    // IL
    const ilFactor = calcILFactor(p0, price);
    const ilDollar = effectiveCapital * (1 - ilFactor);

    // Market value
    let marketValue: number;
    if (strategy.type === 'hold') {
      // 50/50 HODL: half USD + half asset
      marketValue = capital * 0.5 + capital * 0.5 * (price / entryPrice);
    } else if (inRange) {
      marketValue = effectiveCapital * ilFactor + feesAccum;
    } else {
      marketValue = effectiveCapital * (price / p0) + feesAccum;
    }

    // Rebalancing (dyn / scalp only, when out of range)
    let rebalanced = false;
    if ((strategy.type === 'dyn' || strategy.type === 'scalp') && !inRange) {
      hoursSinceLastRebal += hoursPerCandle;
      if (hoursSinceLastRebal >= rebalHours) {
        const prevLo = rangeLo;
        const prevHi = rangeHi;
        const cost = effectiveCapital * slippage + gasCostPerRebal;
        totalRebalCost += cost;
        effectiveCapital -= cost;
        // Reset range around current price
        const pct = strategy.rangePct / 100;
        const newLo = price * (1 - pct);
        const newHi = price * (1 + pct);
        rebalanceHistory.push({
          index: rebalCount++,
          time: candle.time,
          price,
          prevLo,
          prevHi,
          newLo,
          newHi,
          gasCost: cost,
          feesAtPoint: feesAccum,
        });
        rangeLo = newLo;
        rangeHi = newHi;
        p0 = price;
        hoursSinceLastRebal = 0;
        rebalanced = true;
      }
    } else {
      if (inRange) hoursSinceLastRebal = 0;
      else hoursSinceLastRebal += hoursPerCandle;
    }

    points.push({
      time: candle.time, price, inRange, feesAccum, dailyFees: feeCandle,
      marketValue, ilDollar, rebalanced,
      liquidFees: liquidFeesAccum, reinvestedFees: reinvestedFeesAccum,
    });
  }

  return { points, entryPrice, totalRebalCost, rebalanceHistory };
}

export function computeMetrics(
  points: SimPoint[],
  capital: number,
  days: number,
  totalRebalCost: number,
): Metrics {
  if (points.length === 0) {
    return {
      totalFees: 0, totalIL: 0, finalValue: capital,
      rebalCount: 0, pctInRange: 0, dailyAPR: 0,
      annualAPR: 0, totalRebalCost: 0, netPnl: 0,
      liquidFees: 0, reinvestedFees: 0,
    };
  }

  const last = points[points.length - 1];
  const totalFees = last.feesAccum;
  const totalIL = last.ilDollar;
  const finalValue = last.marketValue;
  const rebalCount = points.filter((p) => p.rebalanced).length;
  const inRangeCount = points.filter((p) => p.inRange).length;
  const pctInRange = (inRangeCount / points.length) * 100;
  const netPnl = finalValue - capital;
  const dailyAPR = days > 0 ? (totalFees / capital / days) * 100 : 0;
  const annualAPR = dailyAPR * 365;
  const liquidFees = last.liquidFees;
  const reinvestedFees = last.reinvestedFees;

  return {
    totalFees, totalIL, finalValue, rebalCount,
    pctInRange, dailyAPR, annualAPR, totalRebalCost, netPnl,
    liquidFees, reinvestedFees,
  };
}

export function runBacktest(
  strategies: Strategy[],
  candles: Candle[],
  params: BacktestParams,
  hoursPerCandle: number,
): { results: StratResult[]; entryPrice: number; currentPrice: number } {
  const config: SimConfig = {
    capital: params.capital,
    feeTier: params.feeTier,
    dailyVol: params.dailyVol,
    tvl: params.tvl,
    gasCostPerRebal: params.gasCost,
    slippage: params.slippage,
    rebalHours: params.rebalHours,
  };

  const entryPrice = candles[0]?.close ?? 0;
  const currentPrice = candles[candles.length - 1]?.close ?? 0;

  const results: StratResult[] = strategies.map((strategy) => {
    const { points, totalRebalCost, rebalanceHistory } = simulateStrategy(
      strategy, candles, config, hoursPerCandle,
    );
    const metrics = computeMetrics(points, params.capital, params.days, totalRebalCost);
    return { strategy, points, metrics, rebalanceHistory };
  });

  return { results, entryPrice, currentPrice };
}
