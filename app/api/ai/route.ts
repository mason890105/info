import { NextRequest, NextResponse } from "next/server";
import { getIncomeStatements, getBalanceSheets, getCashFlows, getRSI, getSMA, getQuote } from "@/lib/fmp";

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "需要股票代號" }, { status: 400 });

    const [income, balance, cashflow, rsiData, sma50Data, sma200Data, quote] = await Promise.all([
      getIncomeStatements(symbol, "quarter", 5),
      getBalanceSheets(symbol, "quarter", 4),
      getCashFlows(symbol, "quarter", 4),
      getRSI(symbol, 14, 5),
      getSMA(symbol, 50, 5),
      getSMA(symbol, 200, 5),
      getQuote(symbol),
    ]);

    const q     = income[0];
    const qPrev = income[1];
    const qYoY  = income[4]; // 去年同季
    const b     = balance[0];
    const cf    = cashflow[0];

    // ── 財務計算 ──────────────────────────────────────────
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

    // ── 技術面計算 ────────────────────────────────────────
    const currentPrice = quote?.price ?? 0;
    const rsi          = rsiData?.[0]?.rsi?.toFixed(1) ?? "N/A";
    const sma50        = sma50Data?.[0]?.sma?.toFixed(2) ?? "N/A";
    const sma200       = sma200Data?.[0]?.sma?.toFixed(2) ?? "N/A";

    const vsMA50  = sma50Data?.[0]?.sma
      ? (((currentPrice - sma50Data[0].sma) / sma50Data[0].sma) * 100).toFixed(1) : "N/A";
    const vsMA200 = sma200Data?.[0]?.sma
      ? (((currentPrice - sma200Data[0].sma) / sma200Data[0].sma) * 100).toFixed(1) : "N/A";

    const techTrend = (() => {
      if (!sma50Data?.[0]?.sma || !sma200Data?.[0]?.sma) return "資料不足";
      const above50  = currentPrice > sma50Data[0].sma;
      const above200 = currentPrice > sma200Data[0].sma;
      if (above50 && above200) return "多頭排列（價格站上 MA50 & MA200）";
      if (!above50 && !above200) return "空頭排列（價格跌破 MA50 & MA200）";
      if (above200 && !above50) return "中期偏弱（站上 MA200 但跌破 MA50）";
      return "短期反彈（站上 MA50 但仍在 MA200 下方）";
    })();

    const rsiSignal = (() => {
      const r = parseFloat(rsi);
      if (isNaN(r)) return "N/A";
      if (r < 30)  return "超賣區間，技術反彈機率高";
      if (r < 40)  return "偏弱，賣壓仍在";
      if (r < 60)  return "中性區間";
      if (r < 70)  return "偏強，動能良好";
      return "超買區間，短期注意回調";
    })();

    // ── 4季趨勢 ───────────────────────────────────────────
    const trendRows = income.slice(0, 4).map((i: any, idx: number) => {
      const gm = i?.grossProfitRatio
        ? (i.grossProfitRatio * 100).toFixed(1)
        : i?.revenue > 0 ? ((i.grossProfit / i.revenue) * 100).toFixed(1) : "N/A";
      return `  Q${idx + 1} ${i?.date?.slice(0, 7)}: 營收 $${(i?.revenue / 1e9).toFixed(2)}B | EPS $${i?.eps?.toFixed(2)} | 毛利率 ${gm}%`;
    }).join("\n");

    // ── Prompt ────────────────────────────────────────────
    const prompt = `你是一位在華爾街深耕20年的資深美股分析師，專精於科技股與成長股，曾服務於頂級投行，擁有獨立且犀利的市場觀點。你不做模糊的兩面說法，而是基於數據給出明確的判斷與立場。

請根據以下 ${symbol} 的完整財務與技術數據，用繁體中文撰寫一份專業分析報告。

━━━ 即時報價 ━━━
現價：$${currentPrice.toFixed(2)}
漲跌：${quote?.change >= 0 ? "+" : ""}${quote?.change?.toFixed(2)} (${quote?.changePercentage?.toFixed(2)}%)

━━━ 最新季度（${q?.date?.slice(0, 7)}）核心財務 ━━━
營收：$${(q?.revenue / 1e9).toFixed(2)}B（季增 ${revenueQoQ}%，年增 ${revenueYoY}%）
毛利率：${grossMargin}%（上季 ${prevGrossMargin}%）
營業利益率：${opMargin}%
淨利率：${netMargin}%
EPS：$${q?.eps?.toFixed(2)}
EBITDA：$${(q?.ebitda / 1e9).toFixed(2)}B
ROE：${roe}%
自由現金流利潤率：${fcfMargin}%

━━━ 近4季損益趨勢 ━━━
${trendRows}

━━━ 資產負債（最新季）━━━
總資產：$${(b?.totalAssets / 1e9).toFixed(2)}B
總負債：$${(b?.totalLiabilities / 1e9).toFixed(2)}B
現金及約當現金：$${(b?.cashAndCashEquivalents / 1e9).toFixed(2)}B
總債務：$${(b?.totalDebt / 1e9).toFixed(2)}B
負債比率：${debtRatio}%

━━━ 現金流（最新季）━━━
營業現金流：$${(cf?.operatingCashFlow / 1e9).toFixed(2)}B
自由現金流：$${(cf?.freeCashFlow / 1e9).toFixed(2)}B
資本支出：$${(cf?.capitalExpenditure / 1e9).toFixed(2)}B

━━━ 技術面分析 ━━━
RSI(14)：${rsi}（${rsiSignal}）
MA50：$${sma50}（現價偏離 ${vsMA50}%）
MA200：$${sma200}（現價偏離 ${vsMA200}%）
趨勢判斷：${techTrend}

---

請按以下架構撰寫報告，語氣直接、有觀點，像一位真正的分析師在對機構客戶簡報，而不是列點式的教科書摘要：

【一、分析師觀點：這家公司現在值得買嗎？】
直接給出你的核心判斷與立場——看多、看空還是觀望？原因是什麼？結合財務與技術面，給出有力度的個人觀點。不要模糊，要明確。（4-5句）

【二、財報深度解讀】
這季財報最關鍵的訊號是什麼？毛利率、營收成長、現金流之間有什麼值得深究的交叉點？哪些數字表面好看但背後有隱憂，或者表面平淡但其實暗藏驚喜？用分析師的眼光解讀，不要只是重述數字。（4-5句）

【三、技術面 × 基本面交叉驗證】
目前技術面的位置（RSI、均線趨勢）與基本面數據是否互相印證？是基本面強但技術面超買需要等待？還是技術面已超賣而基本面支撐良好是介入機會？給出具體判斷。（3-4句）

【四、最大風險與催化劑】
點出這家公司當前最大的下行風險（1-2個具體風險），以及未來可能推動股價上漲的催化劑（1-2個具體觸發點）。要具體，不要泛泛而談。

【五、操作策略建議】
針對三種投資人給出具體策略：
- 長線投資人（持有3年以上）：現在的位置值得建倉嗎？
- 中線交易者（持有3-12個月）：進場時機與目標區間？
- 短線操作者（持有1個月內）：技術面給出什麼訊號？

語言要求：繁體中文，專業犀利，有個人觀點，引用數據要精確，避免「可能」「或許」等模糊詞彙，直接說出判斷。`;

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