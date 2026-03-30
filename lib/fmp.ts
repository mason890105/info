import Redis from "ioredis";

const FMP_KEY = process.env.FMP_API_KEY!;
const FMP_BASE = "https://financialmodelingprep.com/stable";

// ── 快取層：有 REDIS_URL 用 Redis，沒有用 in-memory Map ──
const memCache = new Map<string, { data: string; exp: number }>();

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    redis.on("error", () => { redis = null; });
  } catch { redis = null; }
}

async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  // 嘗試 Redis
  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit) as T;
      const data = await fetcher();
      await redis.setex(key, ttl, JSON.stringify(data));
      return data;
    } catch {}
  }
  // fallback: in-memory
  const now = Date.now();
  const mem = memCache.get(key);
  if (mem && mem.exp > now) return JSON.parse(mem.data) as T;
  const data = await fetcher();
  memCache.set(key, { data: JSON.stringify(data), exp: now + ttl * 1000 });
  return data;
}

async function fmpFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", FMP_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FMP Error ${res.status}: ${path} - ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface Quote {
  symbol: string; name: string; price: number; change: number;
  changePercentage: number; dayHigh: number; dayLow: number;
  volume: number; marketCap: number; open: number; previousClose: number;
  pe?: number; priceEarningsRatio?: number; exchange?: string;
}

export async function getQuote(symbol: string): Promise<Quote> {
  return cached(`quote:${symbol}`, TTL.quote, async () => {
    const data = await fmpFetch<Quote[]>(`/quote`, { symbol: symbol.toUpperCase() });
    return data[0];
  });
}

export async function getBatchQuotes(symbols: string[]): Promise<Quote[]> {
  const key = `quote:batch:${symbols.sort().join(",")}`;
  return cached(key, TTL.quote, () =>
    fmpFetch<Quote[]>(`/quote`, { symbol: symbols.map(s => s.toUpperCase()).join(",") })
  );
}

export interface Candle {
  symbol: string; date: string; open: number; high: number;
  low: number; close: number; volume: number; change: number; changePercent: number;
}

export async function getDailyCandles(symbol: string, from?: string, to?: string): Promise<Candle[]> {
  const params: Record<string, string> = { symbol: symbol.toUpperCase() };
  if (from) params.from = from;
  if (to) params.to = to;
  return cached(`candles:daily:${symbol}:${from}:${to}`, TTL.candles, async () => {
    const data = await fmpFetch<Candle[]>(`/historical-price-eod/full`, params);
    return data ?? [];
  });
}

export interface IncomeStatement {
  date: string; symbol: string; revenue: number; grossProfit: number;
  grossProfitRatio: number; operatingIncome: number; operatingIncomeRatio: number;
  netIncome: number; eps: number; ebitda: number;
}
export interface BalanceSheet {
  date: string; totalAssets: number; totalLiabilities: number;
  totalStockholdersEquity: number; cashAndCashEquivalents: number; totalDebt: number;
  totalCurrentAssets: number; totalCurrentLiabilities: number;
}
export interface CashFlowStatement {
  date: string; operatingCashFlow: number; capitalExpenditure: number;
  freeCashFlow: number; dividendsPaid: number; commonStockRepurchased?: number;
}

type Period = "annual" | "quarter";

export async function getIncomeStatements(symbol: string, period: Period = "quarter", limit = 8): Promise<IncomeStatement[]> {
  return cached(`income:${symbol}:${period}:${limit}`, TTL.financials, () =>
    fmpFetch<IncomeStatement[]>(`/income-statement`, { symbol: symbol.toUpperCase(), period, limit: String(limit) })
  );
}
export async function getBalanceSheets(symbol: string, period: Period = "quarter", limit = 8): Promise<BalanceSheet[]> {
  return cached(`balance:${symbol}:${period}:${limit}`, TTL.financials, () =>
    fmpFetch<BalanceSheet[]>(`/balance-sheet-statement`, { symbol: symbol.toUpperCase(), period, limit: String(limit) })
  );
}
export async function getCashFlows(symbol: string, period: Period = "quarter", limit = 8): Promise<CashFlowStatement[]> {
  return cached(`cashflow:${symbol}:${period}:${limit}`, TTL.financials, () =>
    fmpFetch<CashFlowStatement[]>(`/cash-flow-statement`, { symbol: symbol.toUpperCase(), period, limit: String(limit) })
  );
}

export interface IndicatorPoint {
  date: string;
  open?: number; high?: number; low?: number; close?: number; volume?: number;
  sma?: number; ema?: number; rsi?: number;
  macd?: number; signal?: number; histogram?: number;
  obv?: number;
}

export async function getRSI(symbol: string, period = 14): Promise<IndicatorPoint[]> {
  return cached(`rsi:${symbol}:${period}`, TTL.indicator, () =>
    fmpFetch<IndicatorPoint[]>(`/technical-indicators/rsi`, {
      symbol: symbol.toUpperCase(), periodLength: String(period), timeframe: "1day",
    })
  );
}

export async function getSMA(symbol: string, period = 50): Promise<IndicatorPoint[]> {
  return cached(`sma:${symbol}:${period}`, TTL.indicator, () =>
    fmpFetch<IndicatorPoint[]>(`/technical-indicators/sma`, {
      symbol: symbol.toUpperCase(), periodLength: String(period), timeframe: "1day",
    })
  );
}

export async function getEMA(symbol: string, period = 20): Promise<IndicatorPoint[]> {
  return cached(`ema:${symbol}:${period}`, TTL.indicator, () =>
    fmpFetch<IndicatorPoint[]>(`/technical-indicators/ema`, {
      symbol: symbol.toUpperCase(), periodLength: String(period), timeframe: "1day",
    })
  );
}

export async function getMACD(symbol: string): Promise<IndicatorPoint[]> {
  return cached(`macd:${symbol}`, TTL.indicator, () =>
    fmpFetch<IndicatorPoint[]>(`/technical-indicators/macd`, {
      symbol: symbol.toUpperCase(), timeframe: "1day",
    })
  );
}

export async function getOBV(symbol: string): Promise<IndicatorPoint[]> {
  return cached(`obv:${symbol}`, TTL.indicator, () =>
    fmpFetch<IndicatorPoint[]>(`/technical-indicators/obv`, {
      symbol: symbol.toUpperCase(), timeframe: "1day",
    })
  );
}

export async function clearStockCache(symbol: string): Promise<void> {
  const patterns = [
    `quote:${symbol}`, `candles:*:${symbol}*`,
    `income:${symbol}*`, `balance:${symbol}*`, `cashflow:${symbol}*`,
    `rsi:${symbol}*`, `macd:${symbol}`, `obv:${symbol}`,
    `sma:${symbol}*`, `ema:${symbol}*`,
  ];
  for (const pattern of patterns) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
    } catch {}
  }
}