'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Box, FieldLabel, Input, Select, Button, Badge } from './ui';
import type { Strategy, StrategyType } from '@/types';

interface Props {
  strategies: Strategy[];
  onAdd: (s: Strategy) => void;
  onUpdate: (id: string, updates: Partial<Strategy>) => void;
  onRemove: (id: string) => void;
}

const TYPE_OPTIONS: { value: StrategyType; label: string }[] = [
  { value: 'hold', label: 'Hold (50/50)' },
  { value: 'fixed', label: 'Fixed Range' },
  { value: 'dyn', label: 'Dynamic' },
  { value: 'scalp', label: 'Scalp' },
];

const TYPE_COLORS: Record<StrategyType, string> = {
  hold: '#94a3b8',
  fixed: '#c8f135',
  dyn: '#e066ff',
  scalp: '#ff8c42',
};

const PRESET_COLORS = [
  '#c8f135', '#e066ff', '#42a5f5', '#ff8c42',
  '#ff5252', '#94a3b8', '#00e5ff', '#ff6b6b',
];

function newId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function StrategyBuilder({ strategies, onAdd, onUpdate, onRemove }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleAdd() {
    const id = newId();
    const type: StrategyType = 'fixed';
    onAdd({
      id,
      name: `Estrategia ${strategies.length + 1}`,
      type,
      color: PRESET_COLORS[strategies.length % PRESET_COLORS.length],
      rangePct: 5,
      compounding: false,
      compoundPct: 100,
    });
    setExpandedId(id);
  }

  return (
    <Box>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono font-bold text-[#c8f135] uppercase tracking-wider">
          Estrategias
        </h3>
        <Button size="sm" variant="primary" onClick={handleAdd}>
          + Añadir
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {strategies.map((s) => (
          <div
            key={s.id}
            className="border border-[#222] rounded overflow-hidden"
            style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
          >
            {/* Row header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-mono text-sm text-[#ccc] flex-1 truncate">{s.name}</span>
              <Badge color={TYPE_COLORS[s.type]}>{s.type}</Badge>
              <span className="text-xs text-[#444]">{expandedId === s.id ? '▲' : '▼'}</span>
            </div>

            {/* Editor */}
            {expandedId === s.id && (
              <div className="px-3 pb-3 bg-[#0d0d0d] border-t border-[#222]">
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {/* Name */}
                  <div className="col-span-2">
                    <FieldLabel>Name</FieldLabel>
                    <Input
                      value={s.name}
                      onChange={(v) => onUpdate(s.id, { name: v })}
                      placeholder="e.g. ETH Wide Range"
                    />
                    {s.name.trim().length < 3 && (
                      <div className="text-[10px] font-mono text-[#444] mt-1">
                        Mínimo 3 caracteres para identificar la estrategia
                      </div>
                    )}
                  </div>

                  {/* Type */}
                  <div>
                    <FieldLabel>Type</FieldLabel>
                    <Select
                      value={s.type}
                      onChange={(v) => onUpdate(s.id, { type: v as StrategyType })}
                      options={TYPE_OPTIONS}
                    />
                  </div>

                  {/* Range % */}
                  {s.type !== 'hold' && (
                    <div>
                      <FieldLabel>Rango ±%</FieldLabel>
                      <Input
                        type="number"
                        value={s.rangePct}
                        onChange={(v) =>
                          onUpdate(s.id, { rangePct: parseFloat(v) || 1 })
                        }
                        min={0.1}
                        max={50}
                        step={0.5}
                      />
                    </div>
                  )}

                  {/* Abs bounds (fixed only) */}
                  {s.type === 'fixed' && (
                    <>
                      <div>
                        <FieldLabel>Abs Low ($)</FieldLabel>
                        <Input
                          type="number"
                          value={s.absLo ?? ''}
                          onChange={(v) =>
                            onUpdate(s.id, { absLo: parseFloat(v) || undefined })
                          }
                          placeholder="auto"
                        />
                      </div>
                      <div>
                        <FieldLabel>Abs High ($)</FieldLabel>
                        <Input
                          type="number"
                          value={s.absHi ?? ''}
                          onChange={(v) =>
                            onUpdate(s.id, { absHi: parseFloat(v) || undefined })
                          }
                          placeholder="auto"
                        />
                      </div>
                    </>
                  )}

                  {/* Color picker */}
                  <div className="col-span-2">
                    <FieldLabel>Color</FieldLabel>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          className={clsx(
                            'w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110',
                            s.color === c ? 'border-white scale-110' : 'border-transparent',
                          )}
                          style={{ backgroundColor: c }}
                          onClick={() => onUpdate(s.id, { color: c })}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Compounding */}
                  {s.type !== 'hold' && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id={`comp-${s.id}`}
                          checked={s.compounding}
                          onChange={(e) =>
                            onUpdate(s.id, { compounding: e.target.checked })
                          }
                          className="accent-[#c8f135] w-4 h-4 cursor-pointer"
                        />
                        <label
                          htmlFor={`comp-${s.id}`}
                          className="text-xs font-mono text-[#888] cursor-pointer"
                        >
                          Reinvertir fees en la posición
                        </label>
                      </div>
                      {s.compounding && (
                        <div className="pl-6">
                          <div className="flex justify-between items-center mb-1">
                            <FieldLabel className="mb-0">% fees a reinvertir</FieldLabel>
                            <span className="text-xs font-mono text-[#c8f135]">
                              Reinvertir {s.compoundPct ?? 100}% · Retirar {100 - (s.compoundPct ?? 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            step={10}
                            value={s.compoundPct ?? 100}
                            onChange={(e) =>
                              onUpdate(s.id, { compoundPct: Number(e.target.value) })
                            }
                            className="w-full cursor-pointer h-1 rounded appearance-none bg-[#333] accent-[#c8f135]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="danger" onClick={() => onRemove(s.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {strategies.length === 0 && (
          <div className="text-center py-6 text-[#444] font-mono text-xs">
            Sin estrategias. Haz clic en + Añadir para crear una.
          </div>
        )}
      </div>
    </Box>
  );
}
