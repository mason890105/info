import { NextRequest, NextResponse } from "next/server";
import { getIncomeStatements, getBalanceSheets, getCashFlows } from "@/lib/fmp";

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "需要股票代號" }, { status: 400 });

    const [income, balance, cashflow] = await Promise.all([
      getIncomeStatements(symbol, "quarter", 4),
      getBalanceSheets(symbol, "quarter", 4),
      getCashFlows(symbol, "quarter", 4),
    ]);

    const q = income[0];
    const qPrev = income[1];
    const b = balance[0];
    const cf = cashflow[0];

    const revenueGrowth = qPrev?.revenue > 0
      ? (((q?.revenue - qPrev?.revenue) / qPrev?.revenue) * 100).toFixed(1)
      : "N/A";

    const grossMargin = q?.grossProfitRatio
      ? (q.grossProfitRatio * 100).toFixed(1) + "%"
      : q?.revenue > 0
        ? ((q.grossProfit / q.revenue) * 100).toFixed(1) + "%"
        : "N/A";

    const netMargin = q?.revenue > 0
      ? ((q.netIncome / q.revenue) * 100).toFixed(1) + "%"
      : "N/A";

    const debtRatio = b?.totalAssets > 0
      ? ((b.totalLiabilities / b.totalAssets) * 100).toFixed(1) + "%"
      : "N/A";

    const prompt = `你是一位頂尖的美股財務分析師，同時也是財報電話會議的資深解讀專家。
請根據以下 ${symbol} 最新季度財報數據，提供一份完整的繁體中文分析報告。

━━━ 最新季度（${q?.date?.slice(0, 7)}）核心數據 ━━━
營收：$${(q?.revenue / 1e9).toFixed(2)}B（季增 ${revenueGrowth}%）
毛利率：${grossMargin}
淨利率：${netMargin}
EPS：$${q?.eps?.toFixed(2)}
EBITDA：$${(q?.ebitda / 1e9).toFixed(2)}B

━━━ 近4季損益趨勢 ━━━
${income.slice(0, 4).map((i, idx) => `Q${idx + 1} ${i?.date?.slice(0, 7)}: 營收 $${(i?.revenue / 1e9).toFixed(2)}B | EPS $${i?.eps?.toFixed(2)} | 毛利率 ${i?.grossProfitRatio ? (i.grossProfitRatio * 100).toFixed(1) : "N/A"}%`).join("\n")}

━━━ 資產負債（最新季）━━━
總資產：$${(b?.totalAssets / 1e9).toFixed(2)}B
總負債：$${(b?.totalLiabilities / 1e9).toFixed(2)}B
現金：$${(b?.cashAndCashEquivalents / 1e9).toFixed(2)}B
負債比率：${debtRatio}

━━━ 現金流（最新季）━━━
營業現金流：$${(cf?.operatingCashFlow / 1e9).toFixed(2)}B
自由現金流：$${(cf?.freeCashFlow / 1e9).toFixed(2)}B
資本支出：$${(cf?.capitalExpenditure / 1e9).toFixed(2)}B

請提供以下完整報告：

【一、本季財報亮點與隱憂】
根據數據分析本季表現，指出最值得關注的正面與負面訊號（3-4點）

【二、營收與獲利趨勢分析】
分析近4季的營收成長動能、毛利率變化趨勢，評估獲利品質（3-4句）

【三、財務健康度評估】
評估資產負債結構、現金流狀況、償債能力（2-3句）

【四、模擬財報電話會議重點】
根據上述數據，模擬管理層在財報電話會議中可能強調的重點與說法，包括：
- 管理層可能的正面說法（業績亮點、成長動能）
- 可能被分析師追問的問題（潛在風險點）
- 管理層可能的指引方向（下季展望）

【五、投資者關注重點】
給投資者3個最重要的觀察指標與行動建議

語言要求：繁體中文，專業但易懂，數據引用精確。`;

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
    const text = data.content?.[0]?.text || "無法取得分析結果";
    return NextResponse.json({ analysis: text });
  } catch (err) {
    console.error("[AI]", err);
    return NextResponse.json({ error: "AI 分析失敗" }, { status: 500 });
  }
}