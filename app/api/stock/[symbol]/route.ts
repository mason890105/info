import { NextRequest, NextResponse } from "next/server";
import {
  getQuote,
  getDailyCandles,
  getIncomeStatements,
  getBalanceSheets,
  getCashFlows,
  getRSI,
  getMACD,
  getSMA,
  getEMA,
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
        const [rsi, macd, sma50, sma200, ema20] = await Promise.all([
          getRSI(symbol),
          getMACD(symbol),
          getSMA(symbol, 50),
          getSMA(symbol, 200),
          getEMA(symbol, 20),
        ]);
        return NextResponse.json({ rsi, macd, sma50, sma200, ema20 });
      }

      default:
        return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }
  } catch (err) {
    console.error(`[FMP] ${symbol} ${tab}`, err);
    return NextResponse.json(
      { error: "資料取得失敗，請稍後再試" },
      { status: 500 }
    );
  }
}