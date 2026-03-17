import type { Network } from '@/types';
import { POOL_MAP, DEFAULT_POOL_VOLUME, DEFAULT_POOL_TVL } from '@/lib/constants';

export interface PoolInfo {
  dailyVol: number;
  tvl: number;
  source: string;
}

const SUBGRAPH_URLS: Record<Network, string> = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal',
  base:     'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-base',
  optimism: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis',
  polygon:  'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
};

/** Normalize Binance pair → POOL_MAP key (e.g. ETHUSDT → ETHUSDC or ETHUSDT) */
function pairToPoolKey(pair: string): string {
  // Try exact match first, then USDC variant
  return pair;
}

/** Try USDC variant of the pair key */
function pairToUsdcKey(pair: string): string {
  return pair.replace('USDT', 'USDC').replace('BUSD', 'USDC');
}

function tokenFromPair(pair: string): string {
  return pair.replace('USDT', '').replace('USDC', '').replace('BUSD', '');
}

async function querySubgraph(url: string, query: string): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? 'Subgraph error');
  return json.data;
}

/** Fetch by specific pool address — most accurate */
async function fetchByAddress(url: string, address: string): Promise<PoolInfo> {
  const query = `{
    poolDayDatas(
      first: 7
      orderBy: date
      orderDirection: desc
      where: { pool: "${address.toLowerCase()}" }
    ) {
      date
      volumeUSD
      tvlUSD
      feesUSD
    }
  }`;

  const data = await querySubgraph(url, query) as { poolDayDatas: { volumeUSD: string; tvlUSD: string }[] };
  const days = data.poolDayDatas ?? [];
  if (days.length === 0) throw new Error('No day data for pool address');

  const dailyVol = days.reduce((s, d) => s + parseFloat(d.volumeUSD), 0) / days.length;
  const tvl = parseFloat(days[0].tvlUSD);
  return { dailyVol, tvl, source: 'Subgraph (address)' };
}

/** Fetch by token symbol — fallback when no pool address */
async function fetchBySymbol(url: string, pair: string): Promise<PoolInfo> {
  const token = tokenFromPair(pair);
  const query = `{
    pools(
      first: 5
      orderBy: totalValueLockedUSD
      orderDirection: desc
      where: { token0_: { symbol_contains_nocase: "${token}" } }
    ) {
      totalValueLockedUSD
      poolDayData(first: 7 orderBy: date orderDirection: desc) {
        volumeUSD
      }
    }
  }`;

  const data = await querySubgraph(url, query) as {
    pools: { totalValueLockedUSD: string; poolDayData: { volumeUSD: string }[] }[]
  };
  const pool = data.pools?.[0];
  if (!pool) throw new Error(`No pool for ${pair}`);

  const tvl = parseFloat(pool.totalValueLockedUSD);
  const days = pool.poolDayData ?? [];
  const dailyVol = days.length > 0
    ? days.reduce((s, d) => s + parseFloat(d.volumeUSD), 0) / days.length
    : tvl * 0.05;

  return { dailyVol, tvl, source: 'Subgraph (symbol)' };
}

export async function fetchFromSubgraph(pair: string, network: Network = 'ethereum'): Promise<PoolInfo> {
  const url = SUBGRAPH_URLS[network];
  const networkPools = POOL_MAP[network] ?? {};

  // Try exact key, then USDC variant
  const poolInfo = networkPools[pairToPoolKey(pair)] ?? networkPools[pairToUsdcKey(pair)];

  if (poolInfo) {
    try {
      return await fetchByAddress(url, poolInfo.address);
    } catch {
      // Fall through to symbol search
    }
  }

  return fetchBySymbol(url, pair);
}

export async function fetchFromDefiLlama(pair: string): Promise<PoolInfo> {
  const res = await fetch('https://yields.llama.fi/pools');
  if (!res.ok) throw new Error('DefiLlama fetch failed');

  const data: { data: Record<string, unknown>[] } = await res.json();
  const token = tokenFromPair(pair).toLowerCase();

  const pool = (data.data ?? []).find(
    (p) =>
      p['project'] === 'uniswap-v3' &&
      typeof p['symbol'] === 'string' &&
      (p['symbol'] as string).toLowerCase().includes(token),
  );
  if (!pool) throw new Error(`No DefiLlama pool for ${pair}`);

  const tvl = (pool['tvlUsd'] as number) || 1_000_000;
  const apy = (pool['apy'] as number) || 50;
  return { dailyVol: (tvl * apy) / 365 / 100, tvl, source: 'DefiLlama' };
}

export async function fetchPoolInfo(pair: string, network: Network = 'ethereum'): Promise<PoolInfo> {
  try {
    return await fetchFromSubgraph(pair, network);
  } catch {
    try {
      return await fetchFromDefiLlama(pair);
    } catch {
      return {
        dailyVol: DEFAULT_POOL_VOLUME[pair] ?? 10_000_000,
        tvl:      DEFAULT_POOL_TVL[pair]    ?? 50_000_000,
        source: 'default',
      };
    }
  }
}
