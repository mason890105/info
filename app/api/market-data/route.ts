import { NextResponse } from "next/server";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

async function yahooQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price         = meta.regularMarketPrice ?? null;
    const prevClose     = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change        = price != null && prevClose != null ? price - prevClose : null;
    const changePercent = price != null && prevClose != null ? ((price - prevClose) / prevClose) * 100 : null;
    return { price, change, changePercent };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [vix, vvix, skew, gold, oil, dxy, t10y, spx, ndx, dji, rut, fng] = await Promise.all([
      yahooQuote("^VIX"),
      yahooQuote("^VVIX"),
      yahooQuote("^SKEW"),
      yahooQuote("GC=F"),       // 黃金期貨
      yahooQuote("CL=F"),       // 原油期貨
      yahooQuote("DX-Y.NYB"),   // 美元指數
      yahooQuote("^TNX"),       // 美債10Y
      yahooQuote("^GSPC"),      // S&P 500
      yahooQuote("^IXIC"),      // Nasdaq
      yahooQuote("^DJI"),       // 道瓊
      yahooQuote("^RUT"),       // 羅素2000
      fetch("https://api.alternative.me/fng/?limit=1").then(r => r.json()),
    ]);

    let fg: number | null = null;
    let fgLabel = "";
    try {
      fg = parseInt((fng as any)?.data?.[0]?.value ?? "");
      fgLabel = (fng as any)?.data?.[0]?.value_classification ?? "";
    } catch {}

    return NextResponse.json({
      // 大盤指數（給首頁用）
      indices: {
        spx:  spx  ? { price: spx.price,  change: spx.change,  changePercent: spx.changePercent  } : null,
        ndx:  ndx  ? { price: ndx.price,  change: ndx.change,  changePercent: ndx.changePercent  } : null,
        dji:  dji  ? { price: dji.price,  change: dji.change,  changePercent: dji.changePercent  } : null,
        rut:  rut  ? { price: rut.price,  change: rut.change,  changePercent: rut.changePercent  } : null,
      },
      // 大盤指標（給 /market 頁面用）
      vix:  vix  ? { value: vix.price,  change: vix.changePercent  } : {},
      vvix: vvix ? { value: vvix.price, change: vvix.changePercent } : {},
      skew: skew ? { value: skew.price, change: skew.changePercent } : {},
      gold: gold ? { value: gold.price, change: gold.changePercent } : {},
      oil:  oil  ? { value: oil.price,  change: oil.changePercent  } : {},
      dxy:  dxy  ? { value: dxy.price,  change: dxy.changePercent  } : {},
      t10y: t10y ? { value: t10y.price, change: t10y.changePercent } : {},
      rsi:  { value: null },
      mfi:  { value: null },
      fg:   { value: fg, label: fgLabel },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[market-data]", err);
    return NextResponse.json({ error: "資料取得失敗" }, { status: 500 });
  }
}