'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BacktestParams, StratResult } from '@/types';
import type { User } from '@supabase/supabase-js';

export function useSupabaseSync(user: User | null) {
  const saveBacktest = useCallback(
    async (
      params: BacktestParams,
      results: StratResult[],
      entryPrice: number,
      currentPrice: number,
      name: string = 'Backtest',
    ) => {
      console.log('saveBacktest called', { name, userId: user?.id });
      if (!user) return { error: new Error('Not authenticated') };

      // Insert backtest record
      const { data: bt, error: btError } = await supabase
        .from('backtests')
        .insert({
          user_id: user.id,
          name,
          symbol: params.symbol,
          network: params.network,
          days: params.days,
          fee_tier: params.feeTier,
          capital: params.capital,
          daily_vol: params.dailyVol,
          tvl: params.tvl,
          gas_cost: params.gasCost,
          slippage: params.slippage,
          rebal_hours: params.rebalHours,
          entry_price: entryPrice,
          current_price: currentPrice,
        })
        .select()
        .single();

      console.log('backtest insert result', JSON.stringify({ bt, btErr: btError }, null, 2));
      if (btError || !bt) return { error: btError };

      // Insert result rows
      const rows = results.map((r) => ({
        backtest_id: bt.id,
        strategy_name: r.strategy.name,
        strategy_type: r.strategy.type,
        strategy_color: r.strategy.color,
        annual_apr: r.metrics.annualAPR,
        total_fees: r.metrics.totalFees,
        total_il: r.metrics.totalIL,
        final_value: r.metrics.finalValue,
        rebal_count: r.metrics.rebalCount,
        pct_in_range: r.metrics.pctInRange,
        total_rebal_cost: r.metrics.totalRebalCost,
        net_pnl: r.metrics.netPnl,
      }));

      const { error: resError } = await supabase.from('backtest_results').insert(rows);
      console.log('results insert done', { resError });
      return { error: resError, backtestId: bt.id };
    },
    [user],
  );

  const loadBacktests = useCallback(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('backtests')
      .select(`
        *,
        backtest_results (
          strategy_name,
          strategy_type,
          strategy_color,
          annual_apr,
          total_fees,
          rebal_count
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    return { data: data ?? [], error };
  }, [user]);

  const deleteBacktest = useCallback(
    async (id: string) => {
      if (!user) return;
      await supabase.from('backtests').delete().eq('id', id).eq('user_id', user.id);
    },
    [user],
  );

  return { saveBacktest, loadBacktests, deleteBacktest };
}
