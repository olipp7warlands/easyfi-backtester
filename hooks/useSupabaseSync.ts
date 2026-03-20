'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BacktestParams, StratResult, Strategy } from '@/types';
import type { User } from '@supabase/supabase-js';

export function useSupabaseSync(user: User | null) {
  const saveBacktest = useCallback(
    async (
      params: BacktestParams,
      results: StratResult[],
      name: string = 'Backtest',
    ) => {
      console.log('=== saveBacktest START ===');
      console.log('user:', user?.id);
      console.log('name:', name);

      if (!user) {
        console.error('NO USER - aborting');
        return { error: new Error('Not authenticated') };
      }

      try {
        const insertData = {
          user_id:     user.id,
          name:        name,
          symbol:      params.symbol,
          network:     params.network,
          days:        params.days,
          fee_tier:    params.feeTier,
          capital:     params.capital,
          daily_vol:   params.dailyVol,
          tvl:         params.tvl,
          gas_cost:    params.gasCost,
          slippage:    params.slippage,
          rebal_hours: params.rebalHours,
        };
        console.log('insertData:', JSON.stringify(insertData));

        const { data: bt, error: btErr } = await supabase
          .from('backtests')
          .insert(insertData)
          .select('id')
          .single();

        console.log('bt:', JSON.stringify(bt));
        console.log('btErr:', JSON.stringify(btErr));

        if (btErr) {
          console.error('BACKTEST INSERT FAILED:', btErr.message, btErr.code, btErr.details);
          return { error: btErr };
        }
        if (!bt) {
          console.error('NO BT RETURNED');
          return { error: new Error('No backtest returned') };
        }

        const rows = results.map((r) => ({
          backtest_id:      bt.id,
          strategy_name:    r.strategy.name,
          strategy_type:    r.strategy.type,
          strategy_color:   r.strategy.color,
          annual_apr:       r.metrics.annualAPR,
          total_fees:       r.metrics.totalFees,
          total_il:         r.metrics.totalIL,
          final_value:      r.metrics.finalValue,
          rebal_count:      r.metrics.rebalCount,
          pct_in_range:     r.metrics.pctInRange,
          total_rebal_cost: r.metrics.totalRebalCost,
          net_pnl:          r.metrics.netPnl,
        }));

        console.log('inserting results rows:', rows.length);
        console.log('first row sample:', JSON.stringify(rows[0]));

        const { error: resErr } = await supabase
          .from('backtest_results')
          .insert(rows);

        console.log('resErr:', JSON.stringify(resErr));

        if (resErr) {
          console.error('RESULTS INSERT FAILED:', resErr.message, resErr.code, resErr.details);
          return { error: resErr };
        }

        console.log('=== saveBacktest SUCCESS ===', bt.id);
        return { error: null, backtestId: bt.id };

      } catch (err) {
        console.error('=== saveBacktest EXCEPTION ===', err);
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    [user],
  );

  const saveStrategy = useCallback(async (strategy: Strategy) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('strategies').insert({
      user_id:    user.id,
      name:       strategy.name,
      type:       strategy.type,
      color:      strategy.color,
      range_pct:  strategy.rangePct,
      abs_lo:     strategy.absLo ?? null,
      abs_hi:     strategy.absHi ?? null,
      compounding: strategy.compounding,
    });
    return { error };
  }, [user]);

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

  return { saveBacktest, saveStrategy, loadBacktests, deleteBacktest };
}
