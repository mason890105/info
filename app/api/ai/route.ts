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

    const prompt = `你是一位專業的美股財務分析師，請用繁體中文分析 ${symbol} 的財報，給出簡潔摘要。

損益表（最近4季）：
${income.slice(0, 4).map(q => `${q.date}: 營收 $${(q.revenue/1e9).toFixed(2)}B, EPS $${q.eps}, 毛利率 ${(q.grossProfitRatio*100).toFixed(1)}%`).join("\n")}

請提供：
1. 營收趨勢分析
2. 獲利能力評估
3. 投資者重點關注事項`;

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
    console.log("[AI] response:", JSON.stringify(data).slice(0, 500));
    const text = data.content?.[0]?.text || JSON.stringify(data);
    return NextResponse.json({ analysis: text });
  } catch (err) {
    console.error("[AI]", err);
    return NextResponse.json({ error: "AI 分析失敗" }, { status: 500 });
  }
}