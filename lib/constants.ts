import type { Strategy } from '@/types';

export const DEFAULT_STRATEGIES: Strategy[] = [
  {
    id: 'hold',
    name: 'Hold (50/50)',
    type: 'hold',
    color: '#94a3b8',
    rangePct: 100,
    compounding: false,
  },
  {
    id: 'fixed-5',
    name: 'Fixed ±5%',
    type: 'fixed',
    color: '#c8f135',
    rangePct: 5,
    compounding: false,
  },
  {
    id: 'fixed-7',
    name: 'Fixed ±7%',
    type: 'fixed',
    color: '#42a5f5',
    rangePct: 7,
    compounding: false,
  },
  {
    id: 'dyn-5',
    name: 'Dyn ±5%',
    type: 'dyn',
    color: '#e066ff',
    rangePct: 5,
    compounding: true,
  },
  {
    id: 'scalp-2',
    name: 'Scalp ±2%',
    type: 'scalp',
    color: '#ff8c42',
    rangePct: 2,
    compounding: true,
  },
];

export const STRATEGY_COLORS: Record<string, string> = {
  hold: '#94a3b8',
  fixed: '#c8f135',
  dyn: '#e066ff',
  scalp: '#ff8c42',
};

export const PAIRS = [
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'SOLUSDT', label: 'SOL/USDT' },
  { value: 'ARBUSDT', label: 'ARB/USDT' },
  { value: 'MATICUSDT', label: 'MATIC/USDT' },
  { value: 'LINKUSDT', label: 'LINK/USDT' },
  { value: 'UNIUSDT', label: 'UNI/USDT' },
  { value: 'OPUSDT', label: 'OP/USDT' },
];

export const FEE_TIERS = [
  { value: 0.0001, label: '0.01%' },
  { value: 0.0005, label: '0.05%' },
  { value: 0.003, label: '0.3%' },
  { value: 0.01, label: '1%' },
];

export const NETWORKS = [
  { value: 'ethereum', label: 'Ethereum', gasUSD: 25 },
  { value: 'arbitrum', label: 'Arbitrum', gasUSD: 0.5 },
  { value: 'base',     label: 'Base',     gasUSD: 0.1 },
  { value: 'optimism', label: 'Optimism', gasUSD: 0.3 },
  { value: 'polygon',  label: 'Polygon',  gasUSD: 0.05 },
];

export const POOL_MAP: Record<string, Record<string, { address: string; feeTier: number }>> = {
  ethereum: {
    ETHUSDC: { address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', feeTier: 0.0005 },
    ETHUSDT: { address: '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36', feeTier: 0.003  },
    BTCUSDC: { address: '0x99ac8ca7087fa4a2a1fb6357269965a2014abc35', feeTier: 0.003  },
    BTCUSDT: { address: '0x9db9e0e53058c89e5b94e29621a205198648425b', feeTier: 0.003  },
    SOLUSDT: { address: '0x127452f3f9cdc0389b0bf59ce6131aa3bd763598', feeTier: 0.003  },
    LINKUSDT:{ address: '0xa6cc3c2531fdaa6ae1a3ca84c2855806728693e8', feeTier: 0.003  },
  },
  arbitrum: {
    ETHUSDC: { address: '0xc6962004f452be9203591991d15f6b388e09e8d0', feeTier: 0.0005 },
    ETHUSDT: { address: '0x641c00a822e8b671738d32a431a4fb6074e5c79d', feeTier: 0.003  },
    BTCUSDC: { address: '0xa62ad78825e3a55a77823f00fe0050f567c1e4ee', feeTier: 0.003  },
    BTCUSDT: { address: '0x2f5e87c9312fa29aed5c179e456625d79015299c', feeTier: 0.003  },
    SOLUSDT: { address: '0xac70602c542c47a109a3994e6ab48810b4e78d73', feeTier: 0.003  },
    ARBUSDT: { address: '0xb0f6ca40411360c03d41c5ffc5f179b8403cdcf8', feeTier: 0.003  },
  },
  base: {
    ETHUSDC: { address: '0xd0b53d9277642d899df5c87a3966a349a798f224', feeTier: 0.0005 },
    ETHUSDT: { address: '0x4c36388be6f416a29c8d8eee81c771ce6be14b18', feeTier: 0.003  },
  },
  optimism: {
    ETHUSDC: { address: '0x85149247691df622eaf1a8bd0cafd40bc45154a9', feeTier: 0.0005 },
    OPUSDT:  { address: '0x68f5c0a2de713a54991e01858fd27a3832401849', feeTier: 0.003  },
  },
  polygon: {
    ETHUSDC: { address: '0x45dda9cb7c25131df268515131f647d726f50608', feeTier: 0.0005 },
    MATICUSDT:{ address: '0x9b08288c3be4f62bbf8d1c20ac9c5e6f9467d8b7', feeTier: 0.003 },
  },
};

export const DEFAULT_POOL_VOLUME: Record<string, number> = {
  ETHUSDT:  50_000_000,
  BTCUSDT:  30_000_000,
  SOLUSDT:  10_000_000,
  ARBUSDT:   5_000_000,
  MATICUSDT: 3_000_000,
  LINKUSDT:  2_000_000,
  UNIUSDT:   2_000_000,
  OPUSDT:    1_500_000,
};

export const DEFAULT_POOL_TVL: Record<string, number> = {
  ETHUSDT:  150_000_000,
  BTCUSDT:   80_000_000,
  SOLUSDT:   20_000_000,
  ARBUSDT:   10_000_000,
  MATICUSDT:  8_000_000,
  LINKUSDT:   5_000_000,
  UNIUSDT:    5_000_000,
  OPUSDT:     4_000_000,
};
