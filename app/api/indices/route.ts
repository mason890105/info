import { NextRequest, NextResponse } from "next/server";

const FMP_KEY = process.env.FMP_API_KEY!;
const FMP_BASE = "https://financialmodelingprep.com/stable";

export async function GET(req: NextRequest) {
  try {
    const symbols = req.nextUrl.searchParams.get("symbols") ?? "";
    const url = `${FMP_BASE}/quote?symbol=${symbols}&apikey=${FMP_KEY}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`FMP ${res.status}`);

    const data: any[] = await res.json();
    const result: Record<string, any> = {};
    for (const item of data) {
      result[item.symbol] = {
        price:            item.price,
        change:           item.change,
        changePercentage: item.changePercentage,
      };
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[indices]", err);
    return NextResponse.json({ error: "資料取得失敗" }, { status: 500 });
  }
}