import type { StratResult, Candle } from '@/types';

export interface NarrativeResult {
  whatHappened: string;
  whyPerformed: string;
}

export function generateStrategyNarrative(
  result: StratResult,
  candles: Candle[],
  capital: number,
  isBest: boolean,
): NarrativeResult {
  const { metrics, strategy, rebalanceHistory } = result;
  const { totalFees, totalIL, netPnl, annualAPR, pctInRange, rebalCount } = metrics;

  const entryPrice = candles[0]?.close ?? 0;
  const exitPrice = candles[candles.length - 1]?.close ?? 0;
  const priceMovePct =
    entryPrice > 0
      ? Math.abs(((exitPrice - entryPrice) / entryPrice) * 100).toFixed(1)
      : '0';
  const priceMoveDir = exitPrice > entryPrice ? 'subió' : 'bajó';

  let whatHappened: string;
  if (strategy.type === 'hold') {
    const sign = netPnl >= 0 ? 'ganancia' : 'pérdida';
    whatHappened = `El precio ${priceMoveDir} un ${priceMovePct}% durante el período. El portfolio HODL 50/50 terminó con ${sign} de ${Math.abs(netPnl) >= 1 ? `$${Math.abs(netPnl).toFixed(0)}` : '<$1'}.`;
  } else {
    const inRangeStr =
      pctInRange >= 70
        ? 'la mayor parte del tiempo'
        : pctInRange >= 40
        ? 'parte del tiempo'
        : 'poco tiempo';
    whatHappened = `El precio estuvo dentro del rango ${inRangeStr} (${pctInRange.toFixed(1)}%). Se acumularon $${totalFees.toFixed(0)} en fees`;
    if (rebalCount > 0) {
      whatHappened += ` con ${rebalCount} rebalanceo${rebalCount > 1 ? 's' : ''}`;
      if (rebalanceHistory.length > 0) {
        const totalGas = rebalanceHistory.reduce((acc, e) => acc + e.gasCost, 0);
        whatHappened += ` (coste total $${totalGas.toFixed(0)})`;
      }
    }
    whatHappened += '.';
  }

  let whyPerformed: string;
  if (netPnl >= 0) {
    if (totalFees > Math.abs(totalIL)) {
      whyPerformed = `Los fees generados ($${totalFees.toFixed(0)}) superaron el impacto de la IL ($${totalIL.toFixed(0)}), resultando en rentabilidad positiva.`;
    } else {
      whyPerformed = `El movimiento favorable del precio compensó la IL y generó una ganancia neta de $${netPnl.toFixed(0)}.`;
    }
  } else {
    if (Math.abs(totalIL) > totalFees) {
      const outOfRangeNote = pctInRange < 50 ? ' El precio salió del rango con frecuencia.' : '';
      whyPerformed = `La IL ($${totalIL.toFixed(0)}) superó los fees generados ($${totalFees.toFixed(0)}), resultando en pérdida neta.${outOfRangeNote}`;
    } else {
      whyPerformed = `Los costes de rebalanceo y slippage redujeron la rentabilidad a pesar de los $${totalFees.toFixed(0)} en fees acumulados.`;
    }
  }

  if (isBest && strategy.type !== 'hold') {
    whyPerformed += ` Esta fue la estrategia más rentable del período con un APR anual de ${annualAPR.toFixed(1)}%.`;
  }

  // Suppress unused variable warning — capital may be used in future extensions
  void capital;

  return { whatHappened, whyPerformed };
}
