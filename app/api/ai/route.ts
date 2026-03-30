import { NextRequest, NextResponse } from "next/server";
import { getIncomeStatements, getBalanceSheets, getCashFlows } from "@/lib/fmp";

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "需要股票代號" }, { status: 400 });

    const [income, balance, cashflow] = await Promise.all([
      getIncomeStatements(symbol, "quarter", 5),
      getBalanceSheets(symbol, "quarter", 4),
      getCashFlows(symbol, "quarter", 4),
    ]);

    const q     = income[0];
    const qPrev = income[1];
    const qYoY  = income[4];
    const b     = balance[0];
    const cf    = cashflow[0];

    const revenueQoQ = qPrev?.revenue > 0
      ? (((q?.revenue - qPrev?.revenue) / qPrev?.revenue) * 100).toFixed(1)
      : "N/A";

    const revenueYoY = qYoY?.revenue > 0
      ? (((q?.revenue - qYoY?.revenue) / qYoY?.revenue) * 100).toFixed(1)
      : "N/A";

    const grossMargin = q?.grossProfitRatio
      ? (q.grossProfitRatio * 100).toFixed(1)
      : q?.revenue > 0 ? ((q.grossProfit / q.revenue) * 100).toFixed(1) : "N/A";

    const prevGrossMargin = qPrev?.grossProfitRatio
      ? (qPrev.grossProfitRatio * 100).toFixed(1) : "N/A";

    const netMargin = q?.revenue > 0
      ? ((q.netIncome / q.revenue) * 100).toFixed(1) : "N/A";

    const opMargin = q?.revenue > 0 && q?.operatingIncome
      ? ((q.operatingIncome / q.revenue) * 100).toFixed(1) : "N/A";

    const debtRatio = b?.totalAssets > 0
      ? ((b.totalLiabilities / b.totalAssets) * 100).toFixed(1) : "N/A";

    const roe = b?.totalStockholdersEquity > 0
      ? ((q?.netIncome / b.totalStockholdersEquity) * 100).toFixed(1) : "N/A";

    const fcfMargin = q?.revenue > 0 && cf?.freeCashFlow
      ? ((cf.freeCashFlow / q.revenue) * 100).toFixed(1) : "N/A";

    const trendRows = income.slice(0, 4).map((i: any, idx: number) => {
      const gm = i?.grossProfitRatio
        ? (i.grossProfitRatio * 100).toFixed(1)
        : i?.revenue > 0 ? ((i.grossProfit / i.revenue) * 100).toFixed(1) : "N/A";
      return `  Q${idx + 1} ${i?.date?.slice(0, 7)}: 營收 $${(i?.revenue / 1e9).toFixed(2)}B | EPS $${i?.eps?.toFixed(2)} | 毛利率 ${gm}%`;
    }).join("\n");

    const prompt = `你是一位在華爾街深耕20年的資深美股分析師，風格直接犀利，敢於給出明確立場。你的報告給的是機構客戶，不是散戶教學，所以不需要解釋基本概念，直接說重點、給判斷、講觀點。

以下是 ${symbol} 的完整財務數據，請用繁體中文撰寫分析報告。

━━━ 最新季度（${q?.date?.slice(0, 7)}）━━━
營收：$${(q?.revenue / 1e9).toFixed(2)}B（季增 ${revenueQoQ}%，年增 ${revenueYoY}%）
毛利率：${grossMargin}%（上季 ${prevGrossMargin}%）
營業利益率：${opMargin}%
淨利率：${netMargin}%
EPS：$${q?.eps?.toFixed(2)}
EBITDA：$${(q?.ebitda / 1e9).toFixed(2)}B
ROE：${roe}%
自由現金流利潤率：${fcfMargin}%

━━━ 近4季趨勢 ━━━
${trendRows}

━━━ 資產負債 ━━━
總資產：$${(b?.totalAssets / 1e9).toFixed(2)}B
現金：$${(b?.cashAndCashEquivalents / 1e9).toFixed(2)}B
總債務：$${(b?.totalDebt / 1e9).toFixed(2)}B
負債比率：${debtRatio}%

━━━ 現金流 ━━━
營業現金流：$${(cf?.operatingCashFlow / 1e9).toFixed(2)}B
自由現金流：$${(cf?.freeCashFlow / 1e9).toFixed(2)}B
資本支出：$${(cf?.capitalExpenditure / 1e9).toFixed(2)}B

請按以下五個章節撰寫，語氣像分析師在對機構客戶簡報，直接給判斷與觀點：

【一、核心結論】
這季財報最重要的一件事是什麼？用兩三句話說清楚這家公司現在的處境，給出整體評價——超預期、符合預期還是令人失望？為什麼？

【二、財報深度解讀】
不要重述數字，解讀數字背後的意義。毛利率、營收成長、現金流之間有什麼值得深究的交叉點？哪些數字表面好看但背後有隱憂，或者表面平淡但暗藏驚喜？這季最值得關注的結構性變化是什麼？（4-5句）

【三、財務健康度評估】
資產負債結構是否健康？現金儲備夠不夠支撐成長投資？自由現金流的品質如何？償債壓力大不大？給出明確判斷。（3-4句）

【四、市場共識 vs 我的觀點】
市場目前對這家公司的主流看法是什麼？你認為市場在哪裡判斷錯了，或者系統性地低估、高估了哪些因素？這個落差什麼時候、什麼情況下會被修正？（3-4句）

【五、操作策略】
針對三種投資人給出具體策略，語氣要直接：
長線（3年以上）：現在值不值得建倉，理由是什麼？
中線（3-12個月）：進場條件與目標方向？
短線（1個月內）：現在的位置適合操作嗎？

格式要求：純文字輸出，不使用任何 Markdown 符號，不用井字號、星號、減號列表，直接用文字段落表達。`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
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