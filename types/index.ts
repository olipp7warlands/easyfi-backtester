export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type StrategyType = 'hold' | 'fixed' | 'dyn' | 'scalp';

export type Strategy = {
  id: string;
  name: string;
  type: StrategyType;
  color: string;
  rangePct: number;
  absLo?: number;
  absHi?: number;
  compounding: boolean;
};

export type SimConfig = {
  capital: number;
  feeTier: number;
  dailyVol: number;
  tvl: number;
  gasCostPerRebal: number;
  slippage: number;
  rebalHours: number;
};

export type SimPoint = {
  time: number;
  price: number;
  inRange: boolean;
  feesAccum: number;
  dailyFees: number;
  marketValue: number;
  ilDollar: number;
  rebalanced: boolean;
};

export type Metrics = {
  totalFees: number;
  totalIL: number;
  finalValue: number;
  rebalCount: number;
  pctInRange: number;
  dailyAPR: number;
  annualAPR: number;
  totalRebalCost: number;
  netPnl: number;
};

export interface RebalanceEvent {
  index: number;
  time: number;
  price: number;
  prevLo: number;
  prevHi: number;
  newLo: number;
  newHi: number;
  gasCost: number;
  feesAtPoint: number;
}

export type StratResult = {
  strategy: Strategy;
  points: SimPoint[];
  metrics: Metrics;
  rebalanceHistory: RebalanceEvent[];
};

export type Network = 'ethereum' | 'arbitrum' | 'base' | 'optimism' | 'polygon';

export type BacktestParams = {
  symbol: string;
  network: Network;
  days: number;
  feeTier: number;
  capital: number;
  dailyVol: number;
  tvl: number;
  gasCost: number;
  slippage: number;
  rebalHours: number;
};
