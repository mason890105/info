"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

type Period = "quarter" | "annual";
type Tab = "income" | "balance" | "cashflow" | "metrics";

const fmt  = (n: number) => n == null ? "N/A" : `$${(n / 1e9).toFixed(2)}B`;
const pct  = (n: number) => n == null ? "N/A" : `${(n * 100).toFixed(1)}%`;
const fmtM = (n: number) => n == null ? "N/A" : `$${(n / 1e6).toFixed(0)}M`;

function yoy(curr: number, prev: number) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function YoyBadge({ val }: { val: number | null }) {
  if (val == null) return null;
  const up = val >= 0;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginLeft: 6,
      background: up ? "#14532d" : "#450a0a",
      color: up ? "#22c55e" : "#ef4444",
    }}>
      {up ? "+" : ""}{val.toFixed(1)}%
    </span>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color ?? "#e2e8f0" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function FinancialsPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("quarter");
  const [tab, setTab] = useState<Tab>("income");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<any>(null);

  const [aiText, setAiText]       = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone]       = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/stock/${symbol}?tab=financials&period=${period}`).then(r => r.json()),
      fetch(`/api/stock/${symbol}?tab=overview`).then(r => r.json()),
    ]).then(([fin, ov]) => {
      setData(fin);
      setQuote(ov.quote);
      setLoading(false);
    });
  }, [symbol, period]);

  async function runAI() {
    setAiLoading(true); setAiText(""); setAiDone(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiText(prev => prev + decoder.decode(value));
      }
    } catch { setAiText("AI 分析失敗，請稍後再試"); }
    setAiLoading(false); setAiDone(true);
  }

  const s = {
    page:    { minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: "24px" },
    card:    { background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 },
    th:      { padding: "8px 12px", textAlign: "left" as const, color: "#64748b", borderBottom: "1px solid #334155", fontSize: 12 },
    td:      { padding: "8px 12px", borderBottom: "1px solid #0f172a44", fontSize: 13 },
    section: { fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#94a3b8", letterSpacing: 0.5 },
  };

  if (loading) return <div style={{ ...s.page, textAlign: "center", padding: "80px 24px", color: "#64748b" }}>載入中...</div>;
  if (!data)   return <div style={{ ...s.page, textAlign: "center", padding: "80px 24px", color: "#ef4444" }}>資料取得失敗</div>;

  const { income = [], balance = [], cashflow = [] } = data;

  const incomeChart = [...income].reverse().map((q: any, i: number, arr: any[]) => {
    const prev = arr[i - 4];
    return {
      date: q.date?.slice(0, 7),
      營收: +(q.revenue / 1e9).toFixed(2),
      毛利: +(q.grossProfit / 1e9).toFixed(2),
      淨利: +(q.netIncome / 1e9).toFixed(2),
      營收YoY: prev ? yoy(q.revenue, prev.revenue) : null,
    };
  });

  const epsChart = [...income].reverse().map((q: any, i: number, arr: any[]) => {
    const prev = arr[i - 4];
    return {
      date: q.date?.slice(0, 7),
      EPS: q.eps,
      EPS年增: prev ? yoy(q.eps, prev.eps) : null,
    };
  });

  const balanceChart = [...balance].reverse().map((q: any) => ({
    date: q.date?.slice(0, 7),
    總資產: +(q.totalAssets / 1e9).toFixed(2),
    總負債: +(q.totalLiabilities / 1e9).toFixed(2),
    股東權益: +(q.totalStockholdersEquity / 1e9).toFixed(2),
  }));

  const cfChart = [...cashflow].reverse().map((q: any) => ({
    date: q.date?.slice(0, 7),
    營業現金流: +(q.operatingCashFlow / 1e9).toFixed(2),
    自由現金流: +(q.freeCashFlow / 1e9).toFixed(2),
    資本支出: q.capitalExpenditure ? +(q.capitalExpenditure / 1e9).toFixed(2) : 0,
  }));

  const metricsChart = income.slice(0, 8).reverse().map((q: any, i: number) => {
    const b = balance[balance.length - 1 - i];
    return {
      date: q.date?.slice(0, 7),
      毛利率: q.revenue > 0 ? +((q.grossProfit / q.revenue) * 100).toFixed(1) : 0,
      淨利率: q.revenue > 0 ? +((q.netIncome / q.revenue) * 100).toFixed(1) : 0,
      ROE: b?.totalStockholdersEquity > 0 ? +((q.netIncome / b.totalStockholdersEquity) * 100).toFixed(1) : 0,
      營業利益率: q.operatingIncomeRatio ? +(q.operatingIncomeRatio * 100).toFixed(1) : 0,
    };
  });

  const latestIncome  = income[0]  ?? {};
  const latestBalance = balance[0] ?? {};
  const latestCF      = cashflow[0] ?? {};
  const prevIncome    = income[4]   ?? {};

  const grossMargin  = latestIncome.revenue > 0
    ? ((latestIncome.grossProfit / latestIncome.revenue) * 100).toFixed(1) + "%"
    : "N/A";
  const netMargin    = latestIncome.revenue > 0
    ? ((latestIncome.netIncome / latestIncome.revenue) * 100).toFixed(1) + "%"
    : "N/A";
  const roe          = latestBalance.totalStockholdersEquity > 0
    ? ((latestIncome.netIncome / latestBalance.totalStockholdersEquity) * 100).toFixed(1) + "%"
    : "N/A";
  const debtToEquity = latestBalance.totalStockholdersEquity > 0
    ? (latestBalance.totalDebt / latestBalance.totalStockholdersEquity).toFixed(2)
    : "N/A";
  const currentRatio = latestBalance.totalCurrentLiabilities > 0
    ? (latestBalance.totalCurrentAssets / latestBalance.totalCurrentLiabilities).toFixed(2)
    : "N/A";
  const fcfMargin    = latestIncome.revenue > 0
    ? ((latestCF.freeCashFlow / latestIncome.revenue) * 100).toFixed(1) + "%"
    : "N/A";
  const revenueGrowth = yoy(latestIncome.revenue, prevIncome.revenue);
  const epsGrowth     = yoy(latestIncome.eps, prevIncome.eps);

  // ✅ TTM P/E：用最近四季 EPS 總和自行計算
  const ttmEps = income.slice(0, 4).reduce((sum: number, q: any) => sum + (q.eps ?? 0), 0);
  const pe = (ttmEps > 0 && quote?.price)
    ? (quote.price / ttmEps).toFixed(1)
    : "N/A";

  const tooltipStyle = { contentStyle: { background: "#1e293b", border: "none", color: "#e2e8f0", fontSize: 12 } };

  return (
    <div style={s.page}>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button onClick={() => router.push(`/stock/${symbol}`)} style={{
          background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
          padding: "8px 16px", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}>← 返回</button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{symbol} 財務報表</div>
          {quote?.name && <div style={{ fontSize: 13, color: "#64748b" }}>{quote.name}</div>}
        </div>
      </div>

      {/* 關鍵指標快覽 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <MetricCard label="本益比 P/E (TTM)" value={pe} sub="近四季EPS計算" />
        <MetricCard label="毛利率" value={grossMargin} sub={`淨利率 ${netMargin}`} color="#22c55e" />
        <MetricCard label="ROE" value={roe} sub="股東權益報酬" color="#3b82f6" />
        <MetricCard label="負債權益比" value={debtToEquity} sub={`流動比率 ${currentRatio}`} color={parseFloat(debtToEquity) > 2 ? "#ef4444" : "#e2e8f0"} />
        <MetricCard label="FCF Margin" value={fcfMargin} sub="自由現金流率" color="#f59e0b" />
        <MetricCard
          label="營收年增率"
          value={revenueGrowth != null ? `${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%` : "N/A"}
          sub={`EPS年增 ${epsGrowth != null ? (epsGrowth >= 0 ? "+" : "") + epsGrowth.toFixed(1) + "%" : "N/A"}`}
          color={revenueGrowth != null && revenueGrowth >= 0 ? "#22c55e" : "#ef4444"}
        />
      </div>

      {/* 季/年切換 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["quarter", "annual"] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            background: period === p ? "#3b82f6" : "#1e293b",
            border: `1px solid ${period === p ? "#3b82f6" : "#334155"}`,
            borderRadius: 8, padding: "6px 16px",
            color: period === p ? "#fff" : "#94a3b8",
            cursor: "pointer", fontSize: 13, fontWeight: period === p ? 700 : 400,
          }}>{p === "quarter" ? "季報" : "年報"}</button>
        ))}
      </div>

      {/* Tab 列 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #334155" }}>
        {([
          { key: "income",   label: "📋 損益表" },
          { key: "balance",  label: "🏦 資產負債" },
          { key: "cashflow", label: "💰 現金流" },
          { key: "metrics",  label: "📊 獲利能力" },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 18px", fontSize: 13, fontWeight: 600,
            color: tab === t.key ? "#3b82f6" : "#475569",
            borderBottom: `2px solid ${tab === t.key ? "#3b82f6" : "transparent"}`,
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* 損益表 */}
      {tab === "income" && (
        <>
          <div style={s.card}>
            <div style={s.section}>🧠 AI 深度研究報告</div>
            {!aiDone && (
              <button onClick={runAI} disabled={aiLoading} style={{
                background: aiLoading ? "#334155" : "#7c3aed", color: "#fff", border: "none",
                borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700,
                cursor: aiLoading ? "not-allowed" : "pointer", marginBottom: 12,
              }}>
                {aiLoading ? "分析中，請稍候..." : "🧠 一鍵 AI 深度研究"}
              </button>
            )}
            {aiText && (
              <div style={{
                background: "#0f172a", borderRadius: 10, padding: 18,
                fontSize: 14, lineHeight: 2, color: "#cbd5e1", whiteSpace: "pre-wrap",
              }}>{aiText}</div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.section}>營收 / 毛利 / 淨利（十億美元）</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Bar dataKey="營收" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="毛利" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="淨利" fill="#f59e0b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.section}>每股盈餘 EPS 趨勢</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={epsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="EPS" stroke="#a78bfa" strokeWidth={2} dot={{ r: 4, fill: "#a78bfa" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.section}>損益表數據</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    {["日期","營收","YoY","毛利","毛利率","營業利益","淨利","EPS","EBITDA"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {income.map((q: any, i: number) => {
                    const prev = income[i + 4];
                    const revGrowth = prev ? yoy(q.revenue, prev.revenue) : null;
                    return (
                      <tr key={q.date} style={{ background: i % 2 === 0 ? "transparent" : "#ffffff08" }}>
                        <td style={s.td}>{q.date?.slice(0, 7)}</td>
                        <td style={s.td}>{fmt(q.revenue)}</td>
                        <td style={s.td}><YoyBadge val={revGrowth} /></td>
                        <td style={s.td}>{fmt(q.grossProfit)}</td>
                        <td style={s.td}>{q.revenue > 0 ? ((q.grossProfit / q.revenue) * 100).toFixed(1) + "%" : "N/A"}</td>
                        <td style={s.td}>{fmt(q.operatingIncome)}</td>
                        <td style={{ ...s.td, color: q.netIncome >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{fmt(q.netIncome)}</td>
                        <td style={{ ...s.td, fontWeight: 700 }}>${q.eps?.toFixed(2)}</td>
                        <td style={s.td}>{fmt(q.ebitda)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 資產負債 */}
      {tab === "balance" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <MetricCard label="流動比率" value={currentRatio} sub="≥1.5 較健康" color={parseFloat(currentRatio) >= 1.5 ? "#22c55e" : "#ef4444"} />
            <MetricCard label="負債權益比" value={debtToEquity} sub="越低越穩健" color={parseFloat(debtToEquity) > 2 ? "#ef4444" : "#22c55e"} />
            <MetricCard label="總資產" value={fmt(latestBalance.totalAssets)} sub={`總負債 ${fmt(latestBalance.totalLiabilities)}`} />
            <MetricCard label="現金 & 約當現金" value={fmt(latestBalance.cashAndCashEquivalents)} sub="手頭現金" color="#3b82f6" />
          </div>

          <div style={s.card}>
            <div style={s.section}>資產 / 負債 / 股東權益（十億美元）</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={balanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Bar dataKey="總資產"   fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="總負債"   fill="#ef4444" radius={[3,3,0,0]} />
                <Bar dataKey="股東權益" fill="#10b981" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    {["日期","總資產","總負債","股東權益","現金","總債務","流動資產","流動負債"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balance.map((q: any, i: number) => (
                    <tr key={q.date} style={{ background: i % 2 === 0 ? "transparent" : "#ffffff08" }}>
                      <td style={s.td}>{q.date?.slice(0, 7)}</td>
                      <td style={s.td}>{fmt(q.totalAssets)}</td>
                      <td style={s.td}>{fmt(q.totalLiabilities)}</td>
                      <td style={{ ...s.td, color: "#22c55e" }}>{fmt(q.totalStockholdersEquity)}</td>
                      <td style={s.td}>{fmt(q.cashAndCashEquivalents)}</td>
                      <td style={{ ...s.td, color: "#ef4444" }}>{fmt(q.totalDebt)}</td>
                      <td style={s.td}>{fmt(q.totalCurrentAssets)}</td>
                      <td style={s.td}>{fmt(q.totalCurrentLiabilities)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 現金流 */}
      {tab === "cashflow" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <MetricCard label="最新營業現金流" value={fmt(latestCF.operatingCashFlow)} sub="核心獲利品質" color="#3b82f6" />
            <MetricCard label="最新自由現金流" value={fmt(latestCF.freeCashFlow)} sub="可分配給股東" color={latestCF.freeCashFlow >= 0 ? "#22c55e" : "#ef4444"} />
            <MetricCard label="資本支出" value={fmt(latestCF.capitalExpenditure)} sub="再投資規模" color="#f59e0b" />
            <MetricCard label="FCF Margin" value={fcfMargin} sub="自由現金流率" />
          </div>

          <div style={s.card}>
            <div style={s.section}>現金流量（十億美元）</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cfChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="營業現金流" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="自由現金流" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="資本支出"   fill="#f59e0b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    {["日期","營業現金流","自由現金流","資本支出","股利支付","股票回購"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashflow.map((q: any, i: number) => (
                    <tr key={q.date} style={{ background: i % 2 === 0 ? "transparent" : "#ffffff08" }}>
                      <td style={s.td}>{q.date?.slice(0, 7)}</td>
                      <td style={{ ...s.td, color: "#3b82f6", fontWeight: 700 }}>{fmt(q.operatingCashFlow)}</td>
                      <td style={{ ...s.td, color: q.freeCashFlow >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{fmt(q.freeCashFlow)}</td>
                      <td style={s.td}>{fmt(q.capitalExpenditure)}</td>
                      <td style={s.td}>{q.dividendsPaid ? fmtM(Math.abs(q.dividendsPaid)) : "—"}</td>
                      <td style={s.td}>{q.commonStockRepurchased ? fmtM(Math.abs(q.commonStockRepurchased)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 獲利能力 */}
      {tab === "metrics" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <MetricCard label="毛利率" value={grossMargin} color="#3b82f6" />
            <MetricCard label="淨利率" value={netMargin} color="#10b981" />
            <MetricCard label="ROE" value={roe} sub="股東權益報酬率" color="#f59e0b" />
            <MetricCard label="FCF Margin" value={fcfMargin} color="#a78bfa" />
          </div>

          <div style={s.card}>
            <div style={s.section}>獲利能力趨勢（%）</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                <Tooltip {...tooltipStyle} formatter={(v: any) => v + "%"} />
                <Legend />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="毛利率"    stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="淨利率"    stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="ROE"       stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="營業利益率" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.section}>逐期指標對照</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    {["日期","毛利率","淨利率","營業利益率","ROE","EPS","營收YoY"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {income.map((q: any, i: number) => {
                    const b = balance[i] ?? {};
                    const prev = income[i + 4];
                    const roe_ = b.totalStockholdersEquity > 0
                      ? ((q.netIncome / b.totalStockholdersEquity) * 100).toFixed(1)
                      : "N/A";
                    const revG = prev ? yoy(q.revenue, prev.revenue) : null;
                    return (
                      <tr key={q.date} style={{ background: i % 2 === 0 ? "transparent" : "#ffffff08" }}>
                        <td style={s.td}>{q.date?.slice(0, 7)}</td>
                        <td style={{ ...s.td, color: "#3b82f6" }}>
                          {q.revenue > 0 ? ((q.grossProfit / q.revenue) * 100).toFixed(1) + "%" : "N/A"}
                        </td>
                        <td style={{ ...s.td, color: q.netIncome >= 0 ? "#22c55e" : "#ef4444" }}>
                          {q.revenue > 0 ? ((q.netIncome / q.revenue) * 100).toFixed(1) + "%" : "N/A"}
                        </td>
                        <td style={s.td}>{q.operatingIncomeRatio ? (q.operatingIncomeRatio * 100).toFixed(1) + "%" : "N/A"}</td>
                        <td style={{ ...s.td, color: "#f59e0b" }}>{roe_}%</td>
                        <td style={{ ...s.td, fontWeight: 700 }}>${q.eps?.toFixed(2)}</td>
                        <td style={s.td}><YoyBadge val={revG} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}