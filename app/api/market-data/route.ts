import { NextResponse } from "next/server";

const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";

// ── 抓單一報價 ────────────────────────────────────────────
async function yahooQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    const res = await fetch(`${YAHOO}/${encodeURIComponent(symbol)}?interval=1d&range=1d`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price     = meta.regularMarketPrice ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change    = price != null && prevClose != null ? price - prevClose : null;
    const changePct = price != null && prevClose != null ? ((price - prevClose) / prevClose) * 100 : null;
    return { price, change, changePercent: changePct };
  } catch { return null; }
}

// ── 抓歷史 OHLCV（計算 RSI / MFI / 均線）────────────────
async function yahooOHLCV(symbol: string): Promise<{
  high: number[]; low: number[]; close: number[]; volume: number[];
}> {
  try {
    const res = await fetch(
      `${YAHOO}/${encodeURIComponent(symbol)}?interval=1d&range=1y`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } }
    );
    if (!res.ok) return { high: [], low: [], close: [], volume: [] };
    const data = await res.json();
    const q = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!q) return { high: [], low: [], close: [], volume: [] };
    // 過濾掉 null
    const valid = q.close.map((_: any, i: number) =>
      q.close[i] != null && q.high[i] != null && q.low[i] != null
    );
    return {
      close:  q.close.filter((_: any, i: number) => valid[i]),
      high:   q.high.filter((_: any, i: number) => valid[i]),
      low:    q.low.filter((_: any, i: number) => valid[i]),
      volume: q.volume.filter((_: any, i: number) => valid[i]),
    };
  } catch { return { high: [], low: [], close: [], volume: [] }; }
}

// ── RSI 計算 ─────────────────────────────────────────────
function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
}

// ── MFI 計算 ─────────────────────────────────────────────
function calcMFI(high: number[], low: number[], close: number[], volume: number[], period = 14): number | null {
  if (close.length < period + 1) return null;
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3);
  let posFlow = 0, negFlow = 0;
  const start = tp.length - period;
  for (let i = start; i < tp.length; i++) {
    const mf = tp[i] * volume[i];
    if (tp[i] > tp[i - 1]) posFlow += mf; else negFlow += mf;
  }
  if (negFlow === 0) return 100;
  return parseFloat((100 - 100 / (1 + posFlow / negFlow)).toFixed(2));
}

// ── SMA 計算 ─────────────────────────────────────────────
function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
}

// ── 主 API ───────────────────────────────────────────────
export async function GET() {
  try {
    const [
      vix, vvix, skew, gold, oil, dxy, t10y,
      spx, ndx, dji, rut,
      spyData, fng,
    ] = await Promise.all([
      yahooQuote("^VIX"),
      yahooQuote("^VVIX"),
      yahooQuote("^SKEW"),
      yahooQuote("GC=F"),
      yahooQuote("CL=F"),
      yahooQuote("DX-Y.NYB"),
      yahooQuote("^TNX"),
      yahooQuote("^GSPC"),
      yahooQuote("^IXIC"),
      yahooQuote("^DJI"),
      yahooQuote("^RUT"),
      yahooOHLCV("SPY"),
      fetch("https://api.alternative.me/fng/?limit=1").then(r => r.json()),
    ]);

    // ── 技術指標計算 ───────────────────────────────────────
    const closes    = spyData.close;
    const spyPrice  = closes[closes.length - 1] ?? null;

    const rsi  = calcRSI(closes);
    const mfi  = calcMFI(spyData.high, spyData.low, closes, spyData.volume);
    const sma20  = calcSMA(closes, 20);   // 月線
    const sma50  = calcSMA(closes, 50);   // 季線
    const sma200 = calcSMA(closes, 200);  // 年線

    // 均線位置判斷
    const maStatus = spyPrice ? {
      price:    parseFloat(spyPrice.toFixed(2)),
      sma20,
      sma50,
      sma200,
      aboveSma20:  sma20  ? spyPrice > sma20  : null,
      aboveSma50:  sma50  ? spyPrice > sma50  : null,
      aboveSma200: sma200 ? spyPrice > sma200 : null,
      // 偏離幅度 %
      diffSma20:  sma20  ? parseFloat((((spyPrice - sma20)  / sma20)  * 100).toFixed(2)) : null,
      diffSma50:  sma50  ? parseFloat((((spyPrice - sma50)  / sma50)  * 100).toFixed(2)) : null,
      diffSma200: sma200 ? parseFloat((((spyPrice - sma200) / sma200) * 100).toFixed(2)) : null,
    } : null;

    // Fear & Greed
    let fg: number | null = null;
    let fgLabel = "";
    try {
      fg = parseInt((fng as any)?.data?.[0]?.value ?? "");
      fgLabel = (fng as any)?.data?.[0]?.value_classification ?? "";
    } catch {}

    return NextResponse.json({
      // 首頁用：大盤指數
      indices: {
        spx: spx ? { price: spx.price, change: spx.change, changePercent: spx.changePercent } : null,
        ndx: ndx ? { price: ndx.price, change: ndx.change, changePercent: ndx.changePercent } : null,
        dji: dji ? { price: dji.price, change: dji.change, changePercent: dji.changePercent } : null,
        rut: rut ? { price: rut.price, change: rut.change, changePercent: rut.changePercent } : null,
      },
      // 大盤位階頁用：指標
      vix:      vix  ? { value: vix.price,  change: vix.changePercent  } : {},
      vvix:     vvix ? { value: vvix.price, change: vvix.changePercent } : {},
      skew:     skew ? { value: skew.price, change: skew.changePercent } : {},
      gold:     gold ? { value: gold.price, change: gold.changePercent } : {},
      oil:      oil  ? { value: oil.price,  change: oil.changePercent  } : {},
      dxy:      dxy  ? { value: dxy.price,  change: dxy.changePercent  } : {},
      t10y:     t10y ? { value: t10y.price, change: t10y.changePercent } : {},
      rsi:      { value: rsi },
      mfi:      { value: mfi },
      fg:       { value: fg, label: fgLabel },
      maStatus, // SPY 月線/季線/年線位置
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[market-data]", err);
    return NextResponse.json({ error: "資料取得失敗" }, { status: 500 });
  }
}