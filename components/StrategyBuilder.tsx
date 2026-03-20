'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Box, FieldLabel } from './ui';
import type { Strategy, StrategyType } from '@/types';
import type { User } from '@supabase/supabase-js';

interface Props {
  strategies: Strategy[];
  onAdd: (s: Strategy) => void;
  onUpdate: (id: string, updates: Partial<Strategy>) => void;
  onRemove: (id: string) => void;
  onSaveStrategy?: (s: Strategy) => Promise<{ error: unknown }>;
  user?: User | null;
  isConfigured?: boolean;
  highlightEmptyNames?: boolean;
}

const TYPE_OPTIONS: { value: StrategyType; label: string }[] = [
  { value: 'hold',  label: 'Hold (50/50)' },
  { value: 'fixed', label: 'Fixed Range' },
  { value: 'dyn',   label: 'Dynamic' },
  { value: 'scalp', label: 'Scalp' },
];

const PRESET_COLORS = [
  '#c8f135', '#e066ff', '#42a5f5', '#ff8c42',
  '#ff5252', '#94a3b8', '#00e5ff', '#ff6b6b',
];

function newId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function StrategyBuilder({
  strategies, onAdd, onUpdate, onRemove,
  onSaveStrategy, user, isConfigured, highlightEmptyNames,
}: Props) {
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  function handleAdd() {
    const id = newId();
    onAdd({
      id,
      name: '',
      type: 'fixed',
      color: PRESET_COLORS[strategies.length % PRESET_COLORS.length],
      rangePct: 5,
      compounding: false,
      compoundPct: 100,
    });
  }

  async function handleSaveStrategy(s: Strategy) {
    if (!onSaveStrategy) return;
    const { error } = await onSaveStrategy(s);
    if (!error) {
      setSavedIds((prev) => ({ ...prev, [s.id]: true }));
      setTimeout(() => setSavedIds((prev) => ({ ...prev, [s.id]: false })), 2000);
    }
  }

  const showSaveBtn = isConfigured && !!user;

  return (
    <Box>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono font-bold text-[#c8f135] uppercase tracking-wider">
          Estrategias
        </h3>
        <button
          onClick={handleAdd}
          className="px-3 py-1 text-xs font-mono rounded font-bold cursor-pointer transition-colors"
          style={{ backgroundColor: '#c8f135', color: '#000' }}
        >
          + Añadir
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {strategies.map((s) => {
          const nameEmpty = s.name.trim().length === 0;
          const showNameError = highlightEmptyNames && nameEmpty;
          const compoundPct = s.compoundPct ?? 100;

          return (
            <div
              key={s.id}
              className="border rounded-lg overflow-hidden"
              style={{
                borderColor: showNameError ? '#ff5252' : '#222',
                borderLeftColor: s.color,
                borderLeftWidth: 3,
              }}
            >
              {/* ── Header row ── */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#111]">
                {/* Color dot — click to toggle picker */}
                <button
                  onClick={() => setColorPickerOpen(colorPickerOpen === s.id ? null : s.id)}
                  className="w-4 h-4 rounded-full flex-shrink-0 border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: s.color,
                    borderColor: colorPickerOpen === s.id ? '#fff' : 'transparent',
                  }}
                  title="Cambiar color"
                />

                {/* Name input */}
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => onUpdate(s.id, { name: e.target.value })}
                  placeholder="ej: ETH Scalping ±2% Arbitrum"
                  className={clsx(
                    'flex-1 min-w-0 bg-transparent border-b text-sm font-mono text-[#ccc] placeholder-[#333]',
                    'focus:outline-none transition-colors py-0.5',
                    showNameError
                      ? 'border-[#ff5252]'
                      : 'border-[#333] focus:border-[#c8f135]',
                  )}
                />

                {/* Type select */}
                <select
                  value={s.type}
                  onChange={(e) => onUpdate(s.id, { type: e.target.value as StrategyType })}
                  className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs font-mono text-[#ccc] focus:outline-none focus:border-[#c8f135] cursor-pointer flex-shrink-0"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* Save button (authenticated only) */}
                {showSaveBtn && (
                  <button
                    onClick={() => handleSaveStrategy(s)}
                    disabled={nameEmpty}
                    title={savedIds[s.id] ? '✓ Guardada' : 'Guardar estrategia'}
                    className="text-xs font-mono px-1.5 py-1 rounded transition-colors disabled:opacity-30 flex-shrink-0"
                    style={{
                      color: savedIds[s.id] ? '#c8f135' : '#555',
                      backgroundColor: savedIds[s.id] ? '#0d1a00' : 'transparent',
                    }}
                  >
                    {savedIds[s.id] ? '✓' : '💾'}
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() => onRemove(s.id)}
                  className="text-[#444] hover:text-[#ff5252] transition-colors text-sm font-mono flex-shrink-0"
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>

              {/* ── Color picker (inline, collapsible) ── */}
              {colorPickerOpen === s.id && (
                <div className="px-3 py-2 bg-[#0d0d0d] border-t border-[#1a1a1a] flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { onUpdate(s.id, { color: c }); setColorPickerOpen(null); }}
                      className={clsx(
                        'w-5 h-5 rounded-full border-2 cursor-pointer transition-transform hover:scale-110',
                        s.color === c ? 'border-white scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}

              {/* ── Body ── */}
              <div className="px-3 py-3 bg-[#0d0d0d] border-t border-[#1a1a1a]">
                {/* Range row */}
                {s.type !== 'hold' && (
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <FieldLabel className="mb-0">Rango ±%</FieldLabel>
                      <input
                        type="number"
                        value={s.rangePct}
                        onChange={(e) => onUpdate(s.id, { rangePct: parseFloat(e.target.value) || 1 })}
                        min={0.1}
                        max={50}
                        step={0.5}
                        className="w-16 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs font-mono text-[#ccc] focus:outline-none focus:border-[#c8f135]"
                      />
                    </div>

                    {s.type === 'fixed' && (
                      <>
                        <div className="flex items-center gap-2">
                          <FieldLabel className="mb-0">Min $</FieldLabel>
                          <input
                            type="number"
                            value={s.absLo ?? ''}
                            onChange={(e) =>
                              onUpdate(s.id, { absLo: parseFloat(e.target.value) || undefined })
                            }
                            placeholder="auto"
                            className="w-24 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs font-mono text-[#ccc] focus:outline-none focus:border-[#c8f135]"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <FieldLabel className="mb-0">Max $</FieldLabel>
                          <input
                            type="number"
                            value={s.absHi ?? ''}
                            onChange={(e) =>
                              onUpdate(s.id, { absHi: parseFloat(e.target.value) || undefined })
                            }
                            placeholder="auto"
                            className="w-24 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs font-mono text-[#ccc] focus:outline-none focus:border-[#c8f135]"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Compounding row */}
                {s.type !== 'hold' && (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <FieldLabel className="mb-0">Compounding</FieldLabel>
                      <select
                        value={s.compounding ? 'yes' : 'no'}
                        onChange={(e) =>
                          onUpdate(s.id, { compounding: e.target.value === 'yes' })
                        }
                        className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs font-mono text-[#ccc] focus:outline-none focus:border-[#c8f135] cursor-pointer"
                      >
                        <option value="no">No</option>
                        <option value="yes">Sí</option>
                      </select>
                    </div>

                    {s.compounding && (
                      <div className="pl-2 mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <FieldLabel className="mb-0">% a reinvertir</FieldLabel>
                          <span className="text-xs font-mono text-[#c8f135]">
                            {compoundPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={10}
                          value={compoundPct}
                          onChange={(e) =>
                            onUpdate(s.id, { compoundPct: Number(e.target.value) })
                          }
                          className="w-full cursor-pointer h-1 rounded appearance-none bg-[#333] accent-[#c8f135]"
                        />
                        <div className="text-[10px] font-mono text-[#555] mt-1">
                          Reinvertir {compoundPct}%
                          {compoundPct < 100 && (
                            <> · Retirar {100 - compoundPct}% como beneficio líquido</>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {strategies.length === 0 && (
          <div className="text-center py-6 text-[#444] font-mono text-xs">
            Sin estrategias. Haz clic en + Añadir para crear una.
          </div>
        )}
      </div>
    </Box>
  );
}
