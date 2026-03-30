import { NextRequest, NextResponse } from "next/server";

const AV_KEY = process.env.ALPHA_VANTAGE_KEY!;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const year = req.nextUrl.searchParams.get("year");
  const quarter = req.nextUrl.searchParams.get("quarter");

  if (!symbol) return NextResponse.json({ error: "需要股票代號" }, { status: 400 });

  try {
    if (year && quarter) {
      // 取特定季逐字稿
      const url = `https://www.alphavantage.co/query?function=EARNINGS_CALL_TRANSCRIPT&symbol=${symbol.toUpperCase()}&year=${year}&quarter=${quarter}&apikey=${AV_KEY}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      // Alpha Vantage 回傳格式：{ transcript: [{ speaker, content }] }
      // 把陣列合併成一段文字
      if (data.transcript && Array.isArray(data.transcript)) {
        const content = data.transcript
          .map((t: any) => `${t.speaker}:\n${t.content}`)
          .join("\n\n");
        return NextResponse.json([{ content }]);
      }
      return NextResponse.json([{ content: "無法取得逐字稿內容" }]);
    } else {
      // 取可用季度列表：用 EARNINGS API 拿歷史季度
      const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol.toUpperCase()}&apikey=${AV_KEY}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      // 從季度盈餘資料推算有哪些季度
      const quarters = (data.quarterlyEarnings ?? []).slice(0, 12).map((q: any) => {
        const date = q.fiscalDateEnding ?? "";
        const month = parseInt(date.slice(5, 7));
        const yr = parseInt(date.slice(0, 4));
        const qt = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
        return { symbol, year: yr, quarter: qt, date };
      });
      return NextResponse.json(quarters);
    }
  } catch (err) {
    console.error("[Transcript]", err);
    return NextResponse.json({ error: "逐字稿取得失敗" }, { status: 500 });
  }
}