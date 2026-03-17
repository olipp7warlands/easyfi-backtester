'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Badge } from './ui';
import { supabase } from '@/lib/supabase';
import type { Strategy } from '@/types';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User;
  onLoad: (strategy: Strategy) => void;
  onClose: () => void;
}

interface SavedRow {
  id: string;
  name: string;
  type: string;
  color: string;
  range_pct: number;
  abs_lo: number | null;
  abs_hi: number | null;
  compounding: boolean;
  created_at: string;
}

function toStrategy(row: SavedRow): Strategy {
  return {
    id: Math.random().toString(36).slice(2, 9),
    name: row.name,
    type: row.type as Strategy['type'],
    color: row.color,
    rangePct: row.range_pct,
    absLo: row.abs_lo ?? undefined,
    absHi: row.abs_hi ?? undefined,
    compounding: row.compounding,
  };
}

export default function SavedStrategies({ user, onLoad, onClose }: Props) {
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('strategies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRows((data as SavedRow[]) ?? []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    await supabase.from('strategies').delete().eq('id', id).eq('user_id', user.id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const TYPE_COLORS: Record<string, string> = {
    hold: '#94a3b8',
    fixed: '#c8f135',
    dyn: '#e066ff',
    scalp: '#ff8c42',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#111] border border-[#222] rounded-lg w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <h2 className="font-mono font-bold text-sm text-[#c8f135] uppercase tracking-wider">
            Estrategias guardadas
          </h2>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#ccc] transition-colors font-mono text-sm"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="text-center py-8 text-xs font-mono text-[#444] animate-pulse">
              Cargando…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-center py-8 text-xs font-mono text-[#444]">
              No tienes estrategias guardadas.
            </div>
          )}
          {!loading && rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border border-[#1a1a1a] rounded-lg px-3 py-2.5 mb-2 hover:border-[#2a2a2a] transition-colors"
              style={{ borderLeftColor: row.color, borderLeftWidth: 3 }}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-[#ccc] truncate">{row.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge color={TYPE_COLORS[row.type] ?? '#ccc'}>{row.type}</Badge>
                  <span className="text-xs font-mono text-[#444]">±{row.range_pct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => { onLoad(toStrategy(row)); onClose(); }}>
                  Usar
                </Button>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="text-xs font-mono text-[#333] hover:text-[#ff5252] transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#1a1a1a]">
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
