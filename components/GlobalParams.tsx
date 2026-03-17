'use client';

import { useState } from 'react';
import { Box, FieldLabel, Input, Select, RangeSlider, Button } from './ui';
import { PAIRS, FEE_TIERS, NETWORKS } from '@/lib/constants';
import { fmtUSDCompact } from '@/lib/format';
import { fetchFromDefiLlama, fetchFromSubgraph } from '@/lib/poolData';
import type { BacktestParams, Network } from '@/types';

interface Props {
  params: BacktestParams;
  onUpdate: (updates: Partial<BacktestParams>) => void;
}

export default function GlobalParams({ params, onUpdate }: Props) {
  const [loadingVol, setLoadingVol] = useState<'defi' | 'sub' | null>(null);
  const [volMsg, setVolMsg] = useState<string>('');

  async function fetchVolData(
    source: 'defi' | 'sub',
    symbol = params.symbol,
    network: Network = params.network,
  ) {
    setLoadingVol(source);
    setVolMsg('');
    try {
      const info =
        source === 'defi'
          ? await fetchFromDefiLlama(symbol)
          : await fetchFromSubgraph(symbol, network);
      onUpdate({ dailyVol: Math.round(info.dailyVol), tvl: Math.round(info.tvl) });
      setVolMsg(`✓ ${info.source}`);
    } catch (err) {
      setVolMsg(`✗ ${err instanceof Error ? err.message : 'failed'}`);
    } finally {
      setLoadingVol(null);
    }
  }

  function handlePairChange(newSymbol: string) {
    onUpdate({ symbol: newSymbol });
    fetchVolData('sub', newSymbol, params.network);
  }

  function handleNetworkChange(newNetwork: Network) {
    onUpdate({ network: newNetwork });
    fetchVolData('sub', params.symbol, newNetwork);
  }

  const selectedNetwork = NETWORKS.find((n) => n.value === params.network);

  return (
    <Box>
      <h3 className="text-sm font-mono font-bold text-[#c8f135] mb-4 uppercase tracking-wider">
        Parámetros globales
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Network — full width, first */}
        <div className="col-span-2">
          <FieldLabel>Red</FieldLabel>
          <Select
            value={params.network}
            onChange={(v) => handleNetworkChange(v as Network)}
            options={NETWORKS.map((n) => ({
              value: n.value,
              label: `${n.label}  (gas ~$${n.gasUSD})`,
            }))}
          />
        </div>

        {/* Pair */}
        <div>
          <FieldLabel>Par</FieldLabel>
          <Select
            value={params.symbol}
            onChange={handlePairChange}
            options={PAIRS}
          />
        </div>

        {/* Fee Tier */}
        <div>
          <FieldLabel>Nivel de fee</FieldLabel>
          <Select
            value={params.feeTier}
            onChange={(v) => onUpdate({ feeTier: parseFloat(v) })}
            options={FEE_TIERS}
          />
        </div>

        {/* Capital slider */}
        <div className="col-span-2">
          <RangeSlider
            label="Capital"
            value={params.capital}
            onChange={(v) => onUpdate({ capital: v })}
            min={100}
            max={1_000_000}
            step={100}
            displayValue={fmtUSDCompact(params.capital)}
          />
        </div>

        {/* Days slider */}
        <div className="col-span-2">
          <RangeSlider
            label="Período del backtest"
            value={params.days}
            onChange={(v) => onUpdate({ days: v })}
            min={7}
            max={365}
            step={1}
            displayValue={`${params.days} días`}
          />
        </div>

        {/* Daily Volume */}
        <div>
          <FieldLabel>
            Volumen diario (USD)
            {loadingVol !== null && (
              <span className="ml-2 text-[#c8f135] animate-pulse">⟳</span>
            )}
          </FieldLabel>
          <Input
            type="number"
            value={params.dailyVol}
            onChange={(v) => onUpdate({ dailyVol: parseFloat(v) || 0 })}
          />
          <div className="text-xs font-mono text-[#555] mt-1">
            {fmtUSDCompact(params.dailyVol)}
          </div>
          <div className="flex gap-1 mt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchVolData('defi')}
              disabled={loadingVol !== null}
              className="flex-1"
            >
              {loadingVol === 'defi' ? '…' : 'DefiLlama'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchVolData('sub')}
              disabled={loadingVol !== null}
              className="flex-1"
            >
              {loadingVol === 'sub' ? '…' : 'Subgraph'}
            </Button>
          </div>
          {volMsg && (
            <div
              className="text-xs font-mono mt-1"
              style={{ color: volMsg.startsWith('✓') ? '#c8f135' : '#ff5252' }}
            >
              {volMsg}
            </div>
          )}
        </div>

        {/* TVL */}
        <div>
          <FieldLabel>TVL (USD)</FieldLabel>
          <Input
            type="number"
            value={params.tvl}
            onChange={(v) => onUpdate({ tvl: parseFloat(v) || 0 })}
          />
          <div className="text-xs font-mono text-[#555] mt-1">
            {fmtUSDCompact(params.tvl)}
          </div>
        </div>

        {/* Gas Cost */}
        <div>
          <FieldLabel>Gas / Rebalanceo ($)</FieldLabel>
          <Input
            type="number"
            value={params.gasCost}
            onChange={(v) => onUpdate({ gasCost: parseFloat(v) || 0 })}
            step={0.01}
            min={0}
          />
          {selectedNetwork && (
            <div className="text-xs font-mono text-[#555] mt-1">
              {selectedNetwork.label} por defecto
            </div>
          )}
        </div>

        {/* Slippage */}
        <div>
          <FieldLabel>Slippage (%)</FieldLabel>
          <Input
            type="number"
            value={(params.slippage * 100).toFixed(2)}
            onChange={(v) => onUpdate({ slippage: (parseFloat(v) || 0) / 100 })}
            step={0.01}
            min={0}
          />
        </div>

        {/* Rebalance interval */}
        <div className="col-span-2">
          <RangeSlider
            label="Intervalo de rebalanceo"
            value={params.rebalHours}
            onChange={(v) => onUpdate({ rebalHours: v })}
            min={1}
            max={24}
            step={1}
            displayValue={`${params.rebalHours}h`}
          />
        </div>
      </div>
    </Box>
  );
}
