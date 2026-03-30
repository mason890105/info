import { NextRequest, NextResponse } from "next/server";
import { getIncomeStatements, getBalanceSheets, getCashFlows, getSMA, getQuote } from "@/lib/fmp";

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();
    if (!symbol) return NextResponse.json({ error: "需要股票代號" }, { status: 400 });

    const [income, balance, cashflow, sma50Data, sma200Data, quote] = await Promise.all([
      getIncomeStatements(symbol, "quarter", 5),
      getBalanceSheets(symbol, "quarter", 4),
      getCashFlows(symbol, "quarter", 4),
      getSMA(symbol, 50, 5),
      getSMA(symbol, 200, 5),
      getQuote(symbol),
    ]);

    const q     = income[0];
    const qPrev = income[1];
    const qYoY  = income[4];
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

    const vsMA50 = sma50Data?.[0]?.sma
      ? (((currentPrice - sma50Data[0].sma) / sma50Data[0].sma) * 100).toFixed(1) : "N/A";
    const vsMA200 = sma200Data?.[0]?.sma
      ? (((currentPrice - sma200Data[0].sma) / sma200Data[0].sma) * 100).toFixed(1) : "N/A";

    const techTrend = (() => {
      if (!sma50Data?.[0]?.sma || !sma200Data?.[0]?.sma) return "資料不足";
      const above50  = currentPrice > sma50Data[0].sma;
      const above200 = currentPrice > sma200Data[0].sma;
      if (above50 && above200)  return "多頭排列，價格站上 MA50 及 MA200";
      if (!above50 && !above200) return "空頭排列，價格跌破 MA50 及 MA200";
      if (above200 && !above50)  return "中期偏弱，站上 MA200 但跌破 MA50";
      return "短期反彈，站上 MA50 但仍在 MA200 下方";
    })();

    const rsiSignal = (() => {
      const r = parseFloat(rsi);
      if (isNaN(r)) return "N/A";
      if (r < 30) return "超賣區間，技術反彈機率高";
      if (r < 40) return "偏弱，賣壓仍在";
      if (r < 60) return "中性區間";
      if (r < 70) return "偏強，動能良好";
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
    const prompt = `你是一位在華爾街深耕20年的資深美股分析師，風格直接犀利，敢於給出明確立場。你的報告給的是機構客戶，不是散戶教學，所以不需要解釋基本概念，直接說重點、給判斷、講觀點。

以下是 ${symbol} 的完整財務與技術數據，請用繁體中文撰寫分析報告。

━━━ 即時報價 ━━━
現價：$${currentPrice.toFixed(2)}
漲跌：${quote?.change >= 0 ? "+" : ""}${quote?.change?.toFixed(2)} (${quote?.changePercentage?.toFixed(2)}%)

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

━━━ 技術面 ━━━
RSI(14)：${rsi}（${rsiSignal}）
MA50：$${sma50}（現價偏離 ${vsMA50}%）
MA200：$${sma200}（現價偏離 ${vsMA200}%）
趨勢：${techTrend}

---

請按以下五個章節撰寫，語氣像分析師在對機構客戶簡報，不做多餘解釋，直接給判斷與觀點：

【一、核心結論】
這季財報最重要的一件事是什麼？用兩三句話說清楚這家公司現在的處境，給出你的整體評價——是超預期、符合預期還是令人失望？為什麼？

【二、財報深度解讀】
不要重述數字，而是解讀數字背後的意義。毛利率、營收成長、現金流之間有什麼值得深究的交叉點？哪些數字表面好看但背後有隱憂，或者表面平淡但其實暗藏驚喜？這季最值得關注的結構性變化是什麼？（4-5句）

【三、技術面與基本面交叉驗證】
目前技術面位置與基本面是否互相印證？是基本面強但技術超買需要等待，還是技術已超賣而基本面支撐是介入機會？現在這個價位，風險報酬比如何？（3-4句）

【四、市場共識 vs 我的觀點】
市場目前對這家公司的主流看法是什麼？你認為市場在哪裡判斷錯了，或者系統性地低估、高估了哪些因素？這個落差什麼時候、什麼情況下會被修正？（3-4句）

【五、操作策略】
針對三種投資人給出具體策略，語氣要直接，不要用「可以考慮」這類軟性說法：
長線（3年以上）：現在值不值得建倉，理由是什麼？
中線（3-12個月）：進場條件與目標價位？
短線（1個月內）：技術面給出什麼訊號，怎麼操作？

格式要求：純文字輸出，不使用任何 Markdown 符號，不用 # 號、** 符號、- 列表，直接用文字段落表達。`;

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