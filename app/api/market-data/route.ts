import { NextResponse } from "next/server";

const FMP_KEY = process.env.FMP_API_KEY!;
const FMP_BASE = "https://financialmodelingprep.com/stable";

async function fmp<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", FMP_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`FMP ${res.status}: ${path}`);
  return res.json();
}

export async function GET() {
  try {
    const [quotes, spyRsi, spyMfi, fng] = await Promise.allSettled([
      fmp<any[]>("/quote", {
        symbol: "^VIX,^VVIX,^SKEW,GCUSD,CLUSD,DX-Y.NYB,^TNX",
      }),
      fmp<any[]>("/technical-indicator/daily", {
        symbol: "SPY", type: "rsi", period: "14", limit: "1",
      }),
      fmp<any[]>("/technical-indicator/daily", {
        symbol: "SPY", type: "mfi", period: "14", limit: "1",
      }),
      fetch("https://api.alternative.me/fng/?limit=1").then(r => r.json()),
    ]);

    const q: Record<string, any> = {};
    if (quotes.status === "fulfilled") {
      for (const item of quotes.value ?? []) q[item.symbol] = item;
    }

    const get = (sym: string) => q[sym];

    let fg: number | null = null;
    let fgLabel = "";
    if (fng.status === "fulfilled") {
      fg = parseInt(fng.value?.data?.[0]?.value ?? "");
      fgLabel = fng.value?.data?.[0]?.value_classification ?? "";
    }

    return NextResponse.json({
      vix:  { value: get("^VIX")?.price,      change: get("^VIX")?.changePercentage },
      vvix: { value: get("^VVIX")?.price,     change: get("^VVIX")?.changePercentage },
      skew: { value: get("^SKEW")?.price,     change: get("^SKEW")?.changePercentage },
      gold: { value: get("GCUSD")?.price,     change: get("GCUSD")?.changePercentage },
      oil:  { value: get("CLUSD")?.price,     change: get("CLUSD")?.changePercentage },
      dxy:  { value: get("DX-Y.NYB")?.price,  change: get("DX-Y.NYB")?.changePercentage },
      t10y: { value: get("^TNX")?.price,      change: get("^TNX")?.changePercentage },
      rsi:  { value: spyRsi.status === "fulfilled" ? spyRsi.value?.[0]?.rsi : null },
      mfi:  { value: spyMfi.status === "fulfilled" ? spyMfi.value?.[0]?.mfi : null },
      fg:   { value: fg, label: fgLabel },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[market-data]", err);
    return NextResponse.json({ error: "資料取得失敗" }, { status: 500 });
  }
}