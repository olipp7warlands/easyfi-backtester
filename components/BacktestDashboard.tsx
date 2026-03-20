'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui';
import { fmtUSD, fmtPct } from '@/lib/format';
import type { User } from '@supabase/supabase-js';
import type { BacktestParams, Network } from '@/types';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';

interface BacktestResult {
  strategy_name: string;
  strategy_type: string;
  strategy_color: string;
  annual_apr: number;
  total_fees: number;
  rebal_count: number;
}

interface BacktestRecord {
  id: string;
  name: string;
  symbol: string;
  network: string;
  days: number;
  fee_tier: number;
  capital: number;
  daily_vol: number;
  tvl: number;
  gas_cost: number;
  slippage: number;
  rebal_hours: number;
  entry_price: number | null;
  current_price: number | null;
  created_at: string;
  backtest_results: BacktestResult[];
}

interface Props {
  user: User;
  onLoadBacktest: (params: BacktestParams) => void;
  onNewTest: () => void;
}

function SkeletonCard() {
  return (
    <div className="bg-[#0d0d0d] border border-[#222] rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-[#1a1a1a] rounded w-48 mb-2" />
      <div className="h-3 bg-[#1a1a1a] rounded w-64 mb-4" />
      <div className="h-3 bg-[#1a1a1a] rounded w-32" />
    </div>
  );
}

export default function BacktestDashboard({ user, onLoadBacktest, onNewTest }: Props) {
  const { loadBacktests, deleteBacktest } = useSupabaseSync(user);
  const [backtests, setBacktests] = useState<BacktestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterPair, setFilterPair] = useState('Todos');

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await loadBacktests();
    setBacktests((data as BacktestRecord[]) ?? []);
    setLoading(false);
  }, [loadBacktests]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleDelete(id: string) {
    await deleteBacktest(id);
    setBacktests((prev) => prev.filter((b) => b.id !== id));
    setConfirmDelete(null);
  }

  function handleLoad(b: BacktestRecord) {
    const params: BacktestParams = {
      symbol: b.symbol,
      network: b.network as Network,
      days: b.days,
      feeTier: b.fee_tier,
      capital: b.capital,
      dailyVol: b.daily_vol,
      tvl: b.tvl,
      gasCost: b.gas_cost,
      slippage: b.slippage,
      rebalHours: b.rebal_hours,
    };
    onLoadBacktest(params);
  }

  // Unique pair labels from loaded backtests
  const pairs = ['Todos', ...Array.from(new Set(
    backtests.map((b) => b.symbol.replace('USDT', '').replace('USDC', ''))
  ))];

  const filtered = backtests
    .filter((b) =>
      filterPair === 'Todos' ||
      b.symbol.includes(filterPair)
    )
    .filter((b) =>
      !search || b.name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono font-bold text-[#c8f135] uppercase tracking-wider">
          Mis Backtests
        </h2>
        <Button variant="primary" size="sm" onClick={onNewTest}>
          + Nuevo test
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {pairs.map((p) => (
          <button
            key={p}
            onClick={() => setFilterPair(p)}
            className="px-3 py-1 text-xs font-mono rounded transition-colors"
            style={{
              backgroundColor: filterPair === p ? '#c8f13522' : '#111',
              color: filterPair === p ? '#c8f135' : '#555',
              border: filterPair === p ? '1px solid #c8f13544' : '1px solid #222',
            }}
          >
            {p}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar..."
          className="ml-auto bg-[#1a1a1a] border border-[#333] rounded px-3 py-1 text-xs font-mono text-[#ccc] focus:outline-none focus:border-[#c8f135] w-44"
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4 opacity-20">◎</div>
          <div className="text-[#444] font-mono text-sm mb-4">
            {backtests.length === 0
              ? 'No tienes backtests guardados. ¡Ejecuta tu primer análisis!'
              : 'Sin resultados para los filtros actuales.'}
          </div>
          {backtests.length === 0 && (
            <Button variant="primary" onClick={onNewTest}>
              Ir a Configuración
            </Button>
          )}
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => {
            const results = b.backtest_results ?? [];
            const bestAPR = results.length > 0
              ? Math.max(...results.map((r) => r.annual_apr ?? 0))
              : null;
            const bestResult = results.find((r) => r.annual_apr === bestAPR);
            const date = new Date(b.created_at).toLocaleDateString('es-ES', {
              day: 'numeric', month: 'short', year: 'numeric',
            });

            return (
              <div
                key={b.id}
                className="bg-[#0d0d0d] border border-[#222] rounded-lg p-4 hover:border-[#333] transition-colors"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm text-[#ccc] truncate">
                      {b.name}
                    </div>
                    <div className="text-xs font-mono text-[#555] mt-0.5">
                      {b.symbol.replace('USDT', '').replace('USDC', '')}/USDT · {b.network} · {fmtUSD(b.capital)} · {b.days}d
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[#444] flex-shrink-0">{date}</div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-xs font-mono text-[#555]">
                    {results.length} estrategia{results.length !== 1 ? 's' : ''}
                  </span>
                  {bestResult && bestAPR !== null && (
                    <>
                      <span className="text-[#333]">·</span>
                      <span
                        className="text-xs font-mono"
                        style={{ color: bestAPR >= 0 ? '#c8f135' : '#ff5252' }}
                      >
                        Mejor APR: {fmtPct(bestAPR)}
                      </span>
                      <span className="text-[#333]">·</span>
                      <span
                        className="text-xs font-mono"
                        style={{ color: bestResult.strategy_color }}
                      >
                        {bestResult.strategy_name}
                      </span>
                    </>
                  )}
                </div>

                {/* APR bar */}
                {bestAPR !== null && bestAPR > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, bestAPR / 2))}%`,
                          backgroundColor: bestResult?.strategy_color ?? '#c8f135',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleLoad(b)}>
                    📂 Cargar
                  </Button>
                  {confirmDelete === b.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-[#ff5252]">¿Eliminar?</span>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(b.id)}>
                        Sí
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(b.id)}>
                      🗑 Eliminar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
