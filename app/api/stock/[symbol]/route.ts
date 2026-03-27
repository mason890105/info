import { NextRequest, NextResponse } from "next/server";
import {
  getQuote, getDailyCandles,
  getIncomeStatements, getBalanceSheets, getCashFlows,
  getSMA, getEMA,
} from "@/lib/fmp";

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
        const [quote, candles] = await Promise.all([
          getQuote(symbol),
          getDailyCandles(symbol),
        ]);
        return NextResponse.json({ quote, candles });
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
        const [sma10, sma20, sma50, sma200, ema8, ema21] = await Promise.all([
          getSMA(symbol, 10),
          getSMA(symbol, 20),
          getSMA(symbol, 50),
          getSMA(symbol, 200),
          getEMA(symbol, 8),
          getEMA(symbol, 21),
        ]);
        return NextResponse.json({ sma10, sma20, sma50, sma200, ema8, ema21 });
      }
      default:
        return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }
  } catch (err) {
    console.error(`[FMP] ${symbol} ${tab}`, err);
    return NextResponse.json({ error: "資料取得失敗，請稍後再試" }, { status: 500 });
  }
}