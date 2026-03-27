import { NextRequest, NextResponse } from "next/server";
import { getIncomeStatements, getBalanceSheets, getCashFlows } from "@/lib/fmp";

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "需要股票代號" }, { status: 400 });

    const [income, balance, cashflow] = await Promise.all([
      getIncomeStatements(symbol, "quarter", 4),
      getBalanceSheets(symbol, "quarter", 2),
      getCashFlows(symbol, "quarter", 4),
    ]);

    const latest = income[0];
    const prev = income[1];
    const yoy = income[4];

    const revenueGrowth = prev?.revenue > 0
      ? (((latest?.revenue - prev?.revenue) / prev?.revenue) * 100).toFixed(1)
      : "N/A";

    const yoyGrowth = yoy?.revenue > 0
      ? (((latest?.revenue - yoy?.revenue) / yoy?.revenue) * 100).toFixed(1)
      : "N/A";

    const prompt = `你是 ${symbol} 的財務長（CFO），請根據以下最新財報數據，用繁體中文撰寫一份法說會重點摘要。

最新一季財報（${latest?.date?.slice(0, 7)}）：
- 營收：$${(latest?.revenue/1e9).toFixed(2)}B（季增 ${revenueGrowth}%，年增 ${yoyGrowth}%）
- 毛利：$${(latest?.grossProfit/1e9).toFixed(2)}B，毛利率 ${latest?.revenue > 0 ? ((latest?.grossProfit/latest?.revenue)*100).toFixed(1) : "N/A"}%
- 營業利益：$${(latest?.operatingIncome/1e9).toFixed(2)}B
- 淨利：$${(latest?.netIncome/1e9).toFixed(2)}B
- EPS：$${latest?.eps?.toFixed(2)}
- EBITDA：$${(latest?.ebitda/1e9).toFixed(2)}B

資產負債（最新季）：
- 現金：$${(balance[0]?.cashAndCashEquivalents/1e9).toFixed(2)}B
- 總債務：$${(balance[0]?.totalDebt/1e9).toFixed(2)}B
- 股東權益：$${(balance[0]?.totalStockholdersEquity/1e9).toFixed(2)}B

現金流量（最新季）：
- 營業現金流：$${(cashflow[0]?.operatingCashFlow/1e9).toFixed(2)}B
- 自由現金流：$${(cashflow[0]?.freeCashFlow/1e9).toFixed(2)}B
- 資本支出：$${(cashflow[0]?.capitalExpenditure/1e9).toFixed(2)}B

請撰寫包含以下段落的法說會摘要：

【開場白】CFO 開場，說明本季整體表現（2-3句）

【營運亮點】本季最重要的3個業績亮點

【財務細節】營收、毛利率、EPS 的詳細說明（3-4句）

【現金流與資本配置】現金流表現與資金運用說明（2-3句）

【展望】對下一季的展望與指引（2-3句）

【Q&A 精選】模擬3個分析師常問問題與回答

語氣要求：專業、自信、有說服力，像真實法說會一樣。用繁體中文。`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "無法生成法說會摘要";
    return NextResponse.json({ transcript: text });
  } catch (err) {
    console.error("[AI Transcript]", err);
    return NextResponse.json({ error: "生成失敗" }, { status: 500 });
  }
}