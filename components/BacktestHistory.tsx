'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui';
import { fmtUSD, fmtPct, colorForValue } from '@/lib/format';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User;
  onClose: () => void;
}

interface BacktestRow {
  id: string;
  name: string;
  symbol: string;
  network: string;
  days: number;
  capital: number;
  created_at: string;
  backtest_results: {
    id: string;
    strategy_name: string;
    strategy_type: string;
    strategy_color: string;
    annual_apr: number;
    total_fees: number;
    net_pnl: number;
  }[];
}

export default function BacktestHistory({ user, onClose }: Props) {
  const { loadBacktests, deleteBacktest } = useSupabaseSync(user);
  const [rows, setRows] = useState<BacktestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBacktests().then(({ data, error: err }) => {
      setRows((data as BacktestRow[]) ?? []);
      if (err) setError(err.message);
      setLoading(false);
    });
  }, [loadBacktests]);

  async function handleDelete(id: string) {
    await deleteBacktest(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#111] border border-[#222] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <h2 className="font-mono font-bold text-sm text-[#c8f135] uppercase tracking-wider">
            Backtests guardados
          </h2>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#ccc] transition-colors font-mono text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="text-center py-12 text-xs font-mono text-[#444] animate-pulse">
              Cargando…
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12 text-xs font-mono text-[#ff5252]">
              Error: {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="text-center py-12 text-xs font-mono text-[#444]">
              No tienes backtests guardados aún.
            </div>
          )}

          {!loading && rows.map((row) => (
            <div
              key={row.id}
              className="border border-[#1a1a1a] rounded-lg p-4 mb-3 hover:border-[#2a2a2a] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-bold text-[#ccc]">{row.name}</div>
                  <div className="text-xs font-mono text-[#444] mt-0.5">
                    {row.symbol} · {row.network} · {row.days}d · ${(row.capital / 1000).toFixed(0)}K
                  </div>
                  <div className="text-xs font-mono text-[#333] mt-0.5">
                    {new Date(row.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="text-xs font-mono text-[#333] hover:text-[#ff5252] transition-colors mt-0.5"
                >
                  ✕
                </button>
              </div>

              {row.backtest_results?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.backtest_results.map((res) => (
                    <div
                      key={res.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono"
                      style={{
                        backgroundColor: `${res.strategy_color}12`,
                        border: `1px solid ${res.strategy_color}33`,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: res.strategy_color }}
                      />
                      <span style={{ color: res.strategy_color }}>{res.strategy_name}</span>
                      <span className="text-[#555] mx-1">·</span>
                      <span style={{ color: colorForValue(res.annual_apr) }}>
                        {fmtPct(res.annual_apr)}
                      </span>
                      <span className="text-[#555] mx-1">·</span>
                      <span style={{ color: colorForValue(res.net_pnl) }}>
                        {fmtUSD(res.net_pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#1a1a1a]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
