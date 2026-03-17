import type { Candle } from '@/types';

export function getInterval(days: number): string {
  if (days <= 30) return '1h';
  if (days <= 90) return '4h';
  return '1d';
}

export function getHoursPerCandle(interval: string): number {
  switch (interval) {
    case '1h': return 1;
    case '4h': return 4;
    case '1d': return 24;
    default: return 1;
  }
}

export async function fetchCandles(symbol: string, days: number): Promise<Candle[]> {
  const interval = getInterval(days);
  const hoursPerCandle = getHoursPerCandle(interval);
  const limit = Math.min(1000, Math.ceil(days * 24 / hoursPerCandle));
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  const url =
    `https://api.binance.com/api/v3/klines` +
    `?symbol=${symbol}&interval=${interval}` +
    `&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error ${response.status}: ${await response.text()}`);
  }

  const data: unknown[][] = await response.json();
  return data.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}
