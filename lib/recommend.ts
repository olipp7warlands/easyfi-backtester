import type { Strategy, Network } from '@/types';

export type TimeHorizon = 'short' | 'medium' | 'long';
export type Preference  = 'fees' | 'balanced' | 'passive';
export type Volatility  = 'low' | 'medium' | 'high';
export type RiskLevel   = 'low' | 'medium' | 'high';

export type UserProfile = {
  network: Network;
  timeHorizon: TimeHorizon;
  preference: Preference;
  volatility: Volatility;
};

export type RecommendedStrategy = {
  strategy: Strategy;
  fitScore: number;
  reasoning: string[];
  tradeoffs: string[];
  riskLevel: RiskLevel;
  projectedAPR: number;
};

type CandidateTemplate = {
  id: string;
  name: string;
  color: string;
  type: Strategy['type'];
  rangePct: number;
  compounding: boolean;
  baseScore: number;
  riskLevel: RiskLevel;
  baseAPR: Record<Volatility, number>;
};

const CANDIDATES: CandidateTemplate[] = [
  {
    id: 'fixed-15',  name: 'Fixed ±15%',    color: '#94a3b8',
    type: 'fixed',   rangePct: 15, compounding: false,
    baseScore: 40,   riskLevel: 'low',
    baseAPR: { low: 10, medium: 14, high: 18 },
  },
  {
    id: 'fixed-7',   name: 'Fixed ±7%',     color: '#42a5f5',
    type: 'fixed',   rangePct: 7,  compounding: false,
    baseScore: 55,   riskLevel: 'low',
    baseAPR: { low: 20, medium: 28, high: 22 },
  },
  {
    id: 'fixed-5',   name: 'Fixed ±5%',     color: '#c8f135',
    type: 'fixed',   rangePct: 5,  compounding: false,
    baseScore: 55,   riskLevel: 'medium',
    baseAPR: { low: 28, medium: 35, high: 26 },
  },
  {
    id: 'fixed-3',   name: 'Fixed ±3%',     color: '#00e5ff',
    type: 'fixed',   rangePct: 3,  compounding: false,
    baseScore: 45,   riskLevel: 'medium',
    baseAPR: { low: 42, medium: 22, high: 10 },
  },
  {
    id: 'dyn-7',     name: 'Dyn ±7%',       color: '#e066ff',
    type: 'dyn',     rangePct: 7,  compounding: true,
    baseScore: 55,   riskLevel: 'medium',
    baseAPR: { low: 32, medium: 50, high: 58 },
  },
  {
    id: 'dyn-5',     name: 'Dyn ±5%',       color: '#cc44ff',
    type: 'dyn',     rangePct: 5,  compounding: true,
    baseScore: 55,   riskLevel: 'medium',
    baseAPR: { low: 38, medium: 62, high: 75 },
  },
  {
    id: 'scalp-2',   name: 'Scalp ±2%',     color: '#ff8c42',
    type: 'scalp',   rangePct: 2,  compounding: true,
    baseScore: 45,   riskLevel: 'high',
    baseAPR: { low: 28, medium: 85, high: 120 },
  },
  {
    id: 'scalp-1.5', name: 'Scalp ±1.5%',   color: '#ff5e57',
    type: 'scalp',   rangePct: 1.5, compounding: true,
    baseScore: 40,   riskLevel: 'high',
    baseAPR: { low: 18, medium: 105, high: 160 },
  },
];

function score(c: CandidateTemplate, p: UserProfile): number {
  let s = c.baseScore;

  // Network
  if (p.network === 'ethereum') {
    if (c.type === 'scalp') s -= 50;
    if (c.type === 'dyn')   s -= 20;
    if (c.type === 'fixed') s += 10;
  } else if (['arbitrum', 'base', 'optimism'].includes(p.network)) {
    if (c.type === 'scalp') s += 25;
    if (c.type === 'dyn')   s += 15;
  } else if (p.network === 'polygon') {
    if (c.type === 'scalp') s += 18;
    if (c.type === 'dyn')   s += 10;
  }

  // Time horizon
  if (p.timeHorizon === 'short') {
    if (c.rangePct >= 7)    s += 25;
    if (c.rangePct <= 2)    s -= 20;
    if (c.type === 'fixed') s += 10;
    if (c.type === 'scalp') s -= 12;
    if (c.type === 'dyn')   s -= 5;
  } else if (p.timeHorizon === 'medium') {
    if (c.type === 'dyn')   s += 15;
    if (c.rangePct >= 5 && c.rangePct <= 7 && c.type === 'fixed') s += 15;
  } else {
    if (c.type === 'dyn')                           s += 25;
    if (c.type === 'fixed' && c.rangePct <= 7)      s -= 15;
    if (c.type === 'scalp')                         s -= 5;
  }

  // Preference
  if (p.preference === 'fees') {
    if (c.type === 'scalp')    s += 30;
    if (c.type === 'dyn')      s += 20;
    if (c.rangePct >= 15)      s -= 10;
  } else if (p.preference === 'balanced') {
    if (c.type === 'dyn')      s += 20;
    if (c.rangePct >= 5 && c.rangePct <= 7) s += 15;
    if (c.type === 'scalp')    s -= 5;
  } else {
    if (c.type === 'fixed')    s += 25;
    if (c.type === 'dyn')      s -= 15;
    if (c.type === 'scalp')    s -= 30;
  }

  // Volatility
  if (p.volatility === 'low') {
    if (c.rangePct <= 3)       s += 25;
    if (c.rangePct === 5)      s += 15;
    if (c.rangePct >= 7)       s -= 5;
    if (c.type === 'scalp')    s -= 15;
  } else if (p.volatility === 'medium') {
    if (c.rangePct >= 5 && c.rangePct <= 7) s += 20;
    if (c.type === 'dyn' && c.rangePct === 5) s += 15;
    if (c.rangePct >= 15)      s -= 10;
  } else {
    if (c.type === 'scalp')    s += 25;
    if (c.type === 'dyn')      s += 20;
    if (c.type === 'fixed' && c.rangePct <= 5) s -= 25;
    if (c.type === 'fixed' && c.rangePct >= 7) s += 10;
  }

  return Math.max(0, Math.min(100, s));
}

function buildReasoning(c: CandidateTemplate, p: UserProfile, s: number): string[] {
  const r: string[] = [];
  // Range width
  if (c.rangePct <= 3)
    r.push(`Rango ±${c.rangePct}% maximiza concentración de liquidez y fees cuando el precio es estable`);
  else if (c.rangePct <= 7)
    r.push(`Rango ±${c.rangePct}% equilibra fees y tiempo dentro del rango`);
  else
    r.push(`Rango ±${c.rangePct}% amplio minimiza la gestión activa necesaria`);
  // Time + type
  if (p.timeHorizon === 'short' && c.type === 'fixed')
    r.push('Sin rebalanceos: ideal para posición de corta duración');
  else if (p.timeHorizon === 'long' && c.type === 'dyn')
    r.push('Estrategia dinámica se adapta a grandes movimientos de precio a lo largo del tiempo');
  else if (c.type === 'dyn')
    r.push('Rebalanceo automático mantiene la posición en rango activamente');
  else if (c.type === 'scalp')
    r.push('Alta concentración genera máximas fees por dólar cuando el precio está en rango');
  // Network/volatility
  if (['arbitrum', 'base'].includes(p.network) && c.type === 'scalp')
    r.push(`Gas ultra-bajo en ${p.network} hace rentable el rebalanceo frecuente`);
  else if (p.network === 'ethereum' && c.type === 'fixed')
    r.push('Gas caro en Ethereum: Fixed elimina costes de rebalanceo');
  else if (p.volatility === 'high' && c.type === 'scalp')
    r.push('Alta volatilidad genera muchas operaciones → oportunidades de fee elevadas');
  else if (p.volatility === 'low' && c.rangePct <= 5)
    r.push('Volatilidad baja mantiene el precio dentro del rango la mayor parte del tiempo');
  // Fit summary
  if (s >= 80) r.push('Compatibilidad alta con tu perfil de inversor');
  return r.slice(0, 3);
}

function buildTradeoffs(c: CandidateTemplate, p: UserProfile): string[] {
  if (c.type === 'scalp') return [
    'Requiere monitoreo activo: el precio sale del rango frecuentemente',
    'Cada rebalanceo tiene coste de gas y slippage que reduce el rendimiento neto',
  ];
  if (c.type === 'dyn') return [
    'Cada rebalanceo tiene coste de gas + slippage; demasiados rebalanceos erosionan ganancias',
    'La eficiencia real depende de calibrar bien el intervalo de rebalanceo',
  ];
  // fixed
  if (c.rangePct <= 5) return [
    'Rango estrecho: el precio puede salir fácilmente y dejar de generar fees',
    p.timeHorizon === 'long'
      ? 'Posición fija puede quedar obsoleta con grandes movimientos a largo plazo'
      : 'IL puede impactar si el precio se mueve de forma significativa',
  ];
  return [
    'Rango amplio reduce la concentración de liquidez, disminuyendo el APR potencial',
    p.timeHorizon === 'long'
      ? 'Movimientos extremos a largo plazo pueden desplazar el precio del rango'
      : 'Menor fee rate en comparación con rangos más estrechos',
  ];
}

export function recommendStrategies(profile: UserProfile): RecommendedStrategy[] {
  const scored = CANDIDATES
    .map((c) => ({ c, s: score(c, profile) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  return scored.map(({ c, s }) => ({
    strategy: {
      id: `rec-${c.id}-${Math.random().toString(36).slice(2, 7)}`,
      name: c.name,
      type: c.type,
      color: c.color,
      rangePct: c.rangePct,
      compounding: c.compounding,
    },
    fitScore: s,
    reasoning: buildReasoning(c, profile, s),
    tradeoffs: buildTradeoffs(c, profile),
    riskLevel: c.riskLevel,
    projectedAPR: c.baseAPR[profile.volatility],
  }));
}
