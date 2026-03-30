import { NextRequest } from "next/server";
import { getIncomeStatements, getBalanceSheets, getCashFlows } from "@/lib/fmp";

const FMP_KEY  = process.env.FMP_API_KEY!;
const FMP_BASE = "https://financialmodelingprep.com/stable";

async function getTranscript(symbol: string): Promise<string> {
  try {
    const listRes = await fetch(
      `${FMP_BASE}/earning_call_transcript?symbol=${symbol}&apikey=${FMP_KEY}`
    );
    const list = await listRes.json();
    if (!list?.length) return "";
    const { quarter, year } = list[0];
    const res = await fetch(
      `${FMP_BASE}/earning_call_transcript?symbol=${symbol}&quarter=${quarter}&year=${year}&apikey=${FMP_KEY}`
    );
    const data = await res.json();
    return data?.[0]?.content ?? "";
  } catch { return ""; }
}

async function streamClaude(prompt: string): Promise<Response> {
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const text = json?.delta?.text;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {}
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { symbol } = await req.json();
    if (!symbol) return new Response("需要股票代號", { status: 400 });

    // 財務數據 + 逐字稿同時抓
    const [income, balance, cashflow, transcript] = await Promise.all([
      getIncomeStatements(symbol, "quarter", 5),
      getBalanceSheets(symbol, "quarter", 4),
      getCashFlows(symbol, "quarter", 4),
      getTranscript(symbol),
    ]);

    const q     = income[0];
    const qPrev = income[1];
    const qYoY  = income[4];
    const b     = balance[0];
    const cf    = cashflow[0];

    const revenueQoQ    = qPrev?.revenue > 0 ? (((q?.revenue - qPrev?.revenue) / qPrev?.revenue) * 100).toFixed(1) : "N/A";
    const revenueYoY    = qYoY?.revenue > 0  ? (((q?.revenue - qYoY?.revenue)  / qYoY?.revenue)  * 100).toFixed(1) : "N/A";
    const grossMargin   = q?.revenue > 0 ? ((q.grossProfit / q.revenue) * 100).toFixed(1) : "N/A";
    const prevGrossMargin = qPrev?.revenue > 0 ? ((qPrev.grossProfit / qPrev.revenue) * 100).toFixed(1) : "N/A";
    const netMargin     = q?.revenue > 0 ? ((q.netIncome / q.revenue) * 100).toFixed(1) : "N/A";
    const opMargin      = q?.revenue > 0 && q?.operatingIncome ? ((q.operatingIncome / q.revenue) * 100).toFixed(1) : "N/A";
    const debtRatio     = b?.totalAssets > 0 ? ((b.totalLiabilities / b.totalAssets) * 100).toFixed(1) : "N/A";
    const roe           = b?.totalStockholdersEquity > 0 ? ((q?.netIncome / b.totalStockholdersEquity) * 100).toFixed(1) : "N/A";
    const fcfMargin     = q?.revenue > 0 && cf?.freeCashFlow ? ((cf.freeCashFlow / q.revenue) * 100).toFixed(1) : "N/A";

    const trendRows = income.slice(0, 4).map((i: any, idx: number) => {
      const gm = i?.revenue > 0 ? ((i.grossProfit / i.revenue) * 100).toFixed(1) : "N/A";
      return `  Q${idx + 1} ${i?.date?.slice(0, 7)}: 營收 $${(i?.revenue / 1e9).toFixed(2)}B | EPS $${i?.eps?.toFixed(2)} | 毛利率 ${gm}%`;
    }).join("\n");

    // 逐字稿取前 10000 字，避免超過 token 上限
    const transcriptSection = transcript
      ? `━━━ Earnings Call 逐字稿（節錄）━━━\n${transcript.slice(0, 10000)}`
      : "━━━ Earnings Call 逐字稿 ━━━\n（本季無可用逐字稿）";

    const prompt = `你是一位在華爾街深耕20年的資深美股分析師，風格直接犀利，敢於給出明確立場。報告對象是機構客戶，直接說重點、給判斷、講觀點，不需要解釋基本概念。

以下是 ${symbol} 的完整財務數據與 Earnings Call 逐字稿，請用繁體中文撰寫深度研究報告。

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

${transcriptSection}

請按以下六個章節撰寫，語氣像分析師在對機構客戶簡報：

【一、核心結論】
這季最重要的一件事是什麼？給出整體評價——超預期、符合預期還是令人失望？（2-3句）

【二、財報深度解讀】
不要重述數字，解讀數字背後的意義。毛利率、營收、現金流之間有什麼值得深究的交叉點？哪些表面好看但有隱憂，或表面平淡但暗藏驚喜？（4-5句）

【三、財務健康度評估】
資產負債是否健康？現金夠不夠支撐成長？自由現金流品質如何？償債壓力大不大？（3-4句）

【四、Earnings Call 關鍵訊號】
管理層對本季業績的核心描述是什麼？給了什麼 guidance？分析師最關心哪些問題？管理層語氣樂觀還是保守？有沒有值得注意的措辭或信號？（4-5句）

【五、市場共識 vs 我的觀點】
市場主流看法是什麼？哪裡判斷錯了，或系統性低估/高估了哪些因素？這個落差何時會被修正？（3-4句）

【六、操作策略】
長線（3年以上）：值不值得建倉？
中線（3-12個月）：進場條件與目標方向？
短線（1個月內）：現在位置適合操作嗎？

格式要求：純文字輸出，不使用任何 Markdown 符號，直接用文字段落表達。`;

    return streamClaude(prompt);

  } catch (err) {
    console.error("[AI]", err);
    return new Response("AI 分析失敗", { status: 500 });
  }
}