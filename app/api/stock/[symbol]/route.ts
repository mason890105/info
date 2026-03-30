import { NextRequest, NextResponse } from "next/server";
import {
  getQuote,
  getDailyCandles,
  getIncomeStatements,
  getBalanceSheets,
  getCashFlows,
  getMACD,
  getSMA,
  getEMA,
} from "@/lib/fmp";

// ── Yahoo Finance 歷史收盤價 ────────────────────────────────────────────────
async function yahooClose(ticker: string): Promise<number[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=15mo`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const closes: (number | null)[] =
      json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((c): c is number => c !== null && !isNaN(c));
  } catch {
    return [];
  }
}

// ── RS 相對強度計算 ────────────────────────────────────────────────────────
type RSKey = "m1" | "m3" | "y1";
interface RSEntry {
  stock: number;
  spy: number;
  diff: number;
  label: string;
}

function calcRS(stock: number[], spy: number[]): Record<RSKey, RSEntry> {
  const periods: { key: RSKey; days: number }[] = [
    { key: "m1", days: 21 },
    { key: "m3", days: 63 },
    { key: "y1", days: 252 },
  ];
  const result = {} as Record<RSKey, RSEntry>;
  for (const { key, days } of periods) {
    if (stock.length < days + 1 || spy.length < days + 1) {
      result[key] = { stock: 0, spy: 0, diff: 0, label: "資料不足" };
      continue;
    }
    const sLen = stock.length;
    const pLen = spy.length;
    const sRet = ((stock[sLen - 1] - stock[sLen - 1 - days]) / stock[sLen - 1 - days]) * 100;
    const pRet = ((spy[pLen - 1] - spy[pLen - 1 - days]) / spy[pLen - 1 - days]) * 100;
    const diff = sRet - pRet;
    const label =
      diff >= 10 ? "強勢★" : diff >= 3 ? "略強" : diff >= -3 ? "中立" : diff >= -10 ? "略弱" : "弱勢";
    result[key] = {
      stock: +sRet.toFixed(2),
      spy: +pRet.toFixed(2),
      diff: +diff.toFixed(2),
      label,
    };
  }
  return result;
}

// ── Main Handler ───────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const tab = req.nextUrl.searchParams.get("tab") ?? "overview";
  const period = (req.nextUrl.searchParams.get("period") ?? "quarter") as "annual" | "quarter";

  try {
    switch (tab) {
      case "overview": {
        const [quote, candles, stockH, spyH] = await Promise.all([
          getQuote(symbol),
          getDailyCandles(symbol),
          yahooClose(symbol),
          yahooClose("SPY"),
        ]);
        const rs = calcRS(stockH, spyH);
        return NextResponse.json({ quote, candles, rs });
      }

      case "financials": {
        const [income, balance, cashflow] = await Promise.all([
          getIncomeStatements(symbol, period),
          getBalanceSheets(symbol, period),
          getCashFlows(symbol, period),
        ]);
        return NextResponse.json({ income, balance, cashflow });
      }

      case "indicators": {
        const [macd, sma50, sma200, ema20] = await Promise.all([
          getMACD(symbol),
          getSMA(symbol, 50),
          getSMA(symbol, 200),
          getEMA(symbol, 20),
        ]);
        return NextResponse.json({ macd, sma50, sma200, ema20 });
      }

      default:
        return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }
  } catch (err) {
    console.error(`[Stock API] ${symbol} ${tab}`, err);
    return NextResponse.json({ error: "資料取得失敗，請稍後再試" }, { status: 500 });
  }
}