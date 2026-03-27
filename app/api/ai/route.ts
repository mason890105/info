import { NextRequest, NextResponse } from "next/server";
import { getIncomeStatements, getBalanceSheets } from "@/lib/fmp";

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "需要股票代號" }, { status: 400 });

    const [income, balance] = await Promise.all([
      getIncomeStatements(symbol, "quarter", 4),
      getBalanceSheets(symbol, "quarter", 4),
    ]);

    const prompt = `你是一位專業的美股財務分析師，請用繁體中文分析以下 ${symbol} 的財報數據，給出簡潔易懂的投資者摘要。

損益表（最近4季）：
${income.slice(0, 4).map(q => {
  const grossMargin = q.grossProfitRatio 
    ? (q.grossProfitRatio * 100).toFixed(1) + "%"
    : q.revenue > 0 
      ? ((q.grossProfit / q.revenue) * 100).toFixed(1) + "%"
      : "N/A";
  return `${q.date}: 營收 $${(q.revenue/1e9).toFixed(2)}B, EPS $${q.eps}, 毛利率 ${grossMargin}`;
}).join("\n")}

資產負債表（最近1季）：
總資產: $${(balance[0]?.totalAssets/1e9).toFixed(2)}B
總負債: $${(balance[0]?.totalLiabilities/1e9).toFixed(2)}B
現金: $${(balance[0]?.cashAndCashEquivalents/1e9).toFixed(2)}B
總債務: $${(balance[0]?.totalDebt/1e9).toFixed(2)}B

請提供：
1. 營收趨勢分析（2-3句）
2. 獲利能力評估（2-3句）
3. 財務健康度（2-3句）
4. 投資者重點關注事項（2-3點）

語言要求：繁體中文，專業但易懂，避免過多術語。`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "無法取得分析結果";
    return NextResponse.json({ analysis: text });
  } catch (err) {
    console.error("[AI]", err);
    return NextResponse.json({ error: "AI 分析失敗" }, { status: 500 });
  }
}