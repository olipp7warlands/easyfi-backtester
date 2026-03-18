'use client';

import { useState, useCallback } from 'react';
import { fetchCandles, getHoursPerCandle, getInterval } from '@/lib/binance';
import { runBacktest } from '@/lib/simulate';
import { DEFAULT_STRATEGIES, DEFAULT_POOL_VOLUME, DEFAULT_POOL_TVL, NETWORKS } from '@/lib/constants';
import type { Strategy, StratResult, BacktestParams, Candle, Network } from '@/types';

const DEFAULT_NETWORK = 'arbitrum';
const DEFAULT_GAS = NETWORKS.find((n) => n.value === DEFAULT_NETWORK)!.gasUSD;

const DEFAULT_PARAMS: BacktestParams = {
  symbol: 'ETHUSDT',
  network: DEFAULT_NETWORK,
  days: 30,
  feeTier: 0.003,
  capital: 10_000,
  dailyVol: DEFAULT_POOL_VOLUME['ETHUSDT'],
  tvl: DEFAULT_POOL_TVL['ETHUSDT'],
  gasCost: DEFAULT_GAS,
  slippage: 0.001,
  rebalHours: 4,
};

export function useBacktest() {
  const [params, setParams] = useState<BacktestParams>(DEFAULT_PARAMS);
  const [strategies, setStrategies] = useState<Strategy[]>(DEFAULT_STRATEGIES);
  const [results, setResults] = useState<StratResult[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [entryPrice, setEntryPrice] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (overrideStrategies?: Strategy[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const strats = overrideStrategies ?? strategies;
      const fetched = await fetchCandles(params.symbol, params.days);
      const interval = getInterval(params.days);
      const hoursPerCandle = getHoursPerCandle(interval);
      const { results: r, entryPrice: ep, currentPrice: cp } = runBacktest(
        strats, fetched, params, hoursPerCandle,
      );
      setCandles(fetched);
      setResults(r);
      setEntryPrice(ep);
      setCurrentPrice(cp);
      return { results: r, entryPrice: ep, currentPrice: cp };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [params, strategies]);

  const addStrategy = useCallback((strategy: Strategy) => {
    setStrategies((prev) => [...prev, strategy]);
  }, []);

  const updateStrategy = useCallback((id: string, updates: Partial<Strategy>) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  }, []);

  const removeStrategy = useCallback((id: string) => {
    setStrategies((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateParams = useCallback((updates: Partial<BacktestParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...updates };

      // Auto-update vol/tvl when pair changes
      if (updates.symbol && updates.symbol !== prev.symbol) {
        next.dailyVol = DEFAULT_POOL_VOLUME[updates.symbol] ?? 10_000_000;
        next.tvl      = DEFAULT_POOL_TVL[updates.symbol]    ?? 50_000_000;
      }

      // Auto-update gas when network changes
      if (updates.network && updates.network !== prev.network) {
        const net = NETWORKS.find((n) => n.value === updates.network);
        if (net) next.gasCost = net.gasUSD;
      }

      return next;
    });
  }, []);

  return {
    params, strategies, results, candles,
    entryPrice, currentPrice, isLoading, error,
    run, addStrategy, updateStrategy, removeStrategy, updateParams,
  };
}
