"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Period = "quarter" | "annual";
type Tab = "income" | "balance" | "cashflow" | "metrics";

export default function FinancialsPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("quarter");
  const [tab, setTab] = useState<Tab>("income");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI 分析狀態
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stock/${symbol}?tab=financials&period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [symbol, period]);

  async function runAI() {
    setAiLoading(true);
    setAiText("");
    setAiDone(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();
      setAiText(json.analysis || json.error || "無法取得分析結果");
    } catch {
      setAiText("AI 分析失敗，請稍後再試");
    }
    setAiLoading(false);
    setAiDone(true);
  }

  const fmt = (n: number) => n == null ? "N/A" : `$${(n / 1e9).toFixed(2)}B`;
  const pct = (n: number) => n == null ? "N/A" : `${(n * 100).toFixed(1)}%`;

  const TABS: { key: Tab; label: string }[] = [
    { key: "income", label: "損益表" },
    { key: "balance", label: "資產負債" },
    { key: "cashflow", label: "現金流" },
    { key: "metrics", label: "關鍵指標" },
  ];

  const s = {
    page: { minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: "24px" },
    header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
    back: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 16px", color: "#94a3b8", cursor: "pointer", fontSize: 14 },
    title: { fontSize: 24, fontWeight: 800 },
    periodRow: { display: "flex", gap: 8, marginBottom: 16 },
    periodBtn: (active: boolean) => ({
      background: active ? "#3b82f6" : "#1e293b",
      border: `1px solid ${active ? "#3b82f6" : "#334155"}`,
      borderRadius: 8, padding: "6px 16px", color: active ? "#fff" : "#94a3b8",
      cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 400,
    }),
    tabRow: { display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #334155" },
    tabBtn: (active: boolean) => ({
      background: "none", border: "none", borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
      padding: "10px 20px", color: active ? "#3b82f6" : "#64748b",
      cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 400,
    }),
    card: { background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#cbd5e1" },
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
    th: { padding: "8px 12px", textAlign: "left" as const, color: "#64748b", borderBottom: "1px solid #334155" },
    td: { padding: "8px 12px", borderBottom: "1px solid #1e293b" },
    aiBtn: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 16 },
    aiBox: { background: "#0f172a", borderRadius: 10, padding: 18, fontSize: 14, lineHeight: 1.8, color: "#cbd5e1", whiteSpace: "pre-wrap" as const },
    transcriptLink: { display: "inline-block", marginTop: 8, color: "#3b82f6", fontSize: 13, cursor: "pointer", textDecoration: "underline" },
  };

  if (loading) return <div style={{ ...s.page, textAlign: "center", padding: "80px 24px" }}>載入中...</div>;
  if (!data) return <div style={{ ...s.page, textAlign: "center", padding: "80px 24px" }}>資料取得失敗</div>;

  const { income = [], balance = [], cashflow = [] } = data;

  // 圖表資料
  const incomeChart = [...income].reverse().map((q: any) => ({
    date: q.date?.slice(0, 7),
    營收: +(q.revenue / 1e9).toFixed(2),
    毛利: +(q.grossProfit / 1e9).toFixed(2),
    淨利: +(q.netIncome / 1e9).toFixed(2),
  }));
  const epsChart = [...income].reverse().map((q: any) => ({ date: q.date?.slice(0, 7), EPS: q.eps }));
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
  }));
  const metricsChart = income.slice(0, 8).reverse().map((q: any, i: number) => {
    const b = balance[balance.length - 1 - i];
    return {
      date: q.date?.slice(0, 7),
      毛利率: +(q.grossProfitRatio * 100).toFixed(1),
      淨利率: q.revenue > 0 ? +((q.netIncome / q.revenue) * 100).toFixed(1) : 0,
      ROE: b?.totalStockholdersEquity > 0 ? +((q.netIncome / b.totalStockholdersEquity) * 100).toFixed(1) : 0,
    };
  });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => router.push(`/stock/${symbol}`)}>← 返回</button>
        <div style={s.title}>{symbol} 財務報表</div>
        <button
          style={{ ...s.back, color: "#3b82f6", borderColor: "#3b82f6" }}
          onClick={() => router.push(`/stock/${symbol}/transcripts`)}
        >
          ?? 財報逐字稿
        </button>
      </div>

      {/* 季/年切換 */}
      <div style={s.periodRow}>
        {(["quarter", "annual"] as Period[]).map(p => (
          <button key={p} style={s.periodBtn(period === p)} onClick={() => setPeriod(p)}>
            {p === "quarter" ? "季報" : "年報"}
          </button>
        ))}
      </div>

      {/* 分頁 */}
      <div style={s.tabRow}>
        {TABS.map(t => (
          <button key={t.key} style={s.tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 損益表 ── */}
      {tab === "income" && (
        <>
          {/* AI 分析區塊 */}
          <div style={s.card}>
            <div style={s.sectionTitle}>?? AI 財報解讀</div>
            {!aiDone && (
              <button style={s.aiBtn} onClick={runAI} disabled={aiLoading}>
                {aiLoading ? "分析中..." : "一鍵 AI 財報分析"}
              </button>
            )}
            {aiLoading && <div style={{ color: "#94a3b8", fontSize: 14 }}>Claude 正在分析中，請稍候...</div>}
            {aiText && <div style={s.aiBox}>{aiText}</div>}
          </div>

          <div style={s.card}>
            <div style={s.sectionTitle}>營收 / 毛利 / 淨利（十億美元）</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#e2e8f0" }} />
                <Legend />
                <Bar dataKey="營收" fill="#3b82f6" />
                <Bar dataKey="毛利" fill="#10b981" />
                <Bar dataKey="淨利" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.sectionTitle}>每股盈餘 EPS</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={epsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#e2e8f0" }} />
                <Line type="monotone" dataKey="EPS" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.sectionTitle}>損益表數據</div>
            <table style={s.table}>
              <thead>
                <tr>
                  {["日期","營收","毛利","毛利率","淨利","EPS","EBITDA"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {income.map((q: any) => (
                  <tr key={q.date}>
                    <td style={s.td}>{q.date?.slice(0, 10)}</td>
                    <td style={s.td}>{fmt(q.revenue)}</td>
                    <td style={s.td}>{fmt(q.grossProfit)}</td>
                    <td style={s.td}>{pct(q.grossProfitRatio)}</td>
                    <td style={{ ...s.td, color: q.netIncome >= 0 ? "#10b981" : "#ef4444" }}>{fmt(q.netIncome)}</td>
                    <td style={s.td}>${q.eps?.toFixed(2)}</td>
                    <td style={s.td}>{fmt(q.ebitda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 資產負債 ── */}
      {tab === "balance" && (
        <>
          <div style={s.card}>
            <div style={s.sectionTitle}>資產 / 負債 / 股東權益（十億美元）</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={balanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#e2e8f0" }} />
                <Legend />
                <Bar dataKey="總資產" fill="#3b82f6" />
                <Bar dataKey="總負債" fill="#ef4444" />
                <Bar dataKey="股東權益" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={s.card}>
            <table style={s.table}>
              <thead>
                <tr>{["日期","總資產","總負債","股東權益","現金","總債務"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {balance.map((q: any) => (
                  <tr key={q.date}>
                    <td style={s.td}>{q.date?.slice(0, 10)}</td>
                    <td style={s.td}>{fmt(q.totalAssets)}</td>
                    <td style={s.td}>{fmt(q.totalLiabilities)}</td>
                    <td style={s.td}>{fmt(q.totalStockholdersEquity)}</td>
                    <td style={s.td}>{fmt(q.cashAndCashEquivalents)}</td>
                    <td style={s.td}>{fmt(q.totalDebt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 現金流 ── */}
      {tab === "cashflow" && (
        <>
          <div style={s.card}>
            <div style={s.sectionTitle}>現金流量（十億美元）</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cfChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#e2e8f0" }} />
                <Legend />
                <Bar dataKey="營業現金流" fill="#3b82f6" />
                <Bar dataKey="自由現金流" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={s.card}>
            <table style={s.table}>
              <thead>
                <tr>{["日期","營業現金流","自由現金流","資本支出","股利"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {cashflow.map((q: any) => (
                  <tr key={q.date}>
                    <td style={s.td}>{q.date?.slice(0, 10)}</td>
                    <td style={s.td}>{fmt(q.operatingCashFlow)}</td>
                    <td style={s.td}>{fmt(q.freeCashFlow)}</td>
                    <td style={s.td}>{fmt(q.capitalExpenditure)}</td>
                    <td style={s.td}>{fmt(q.dividendsPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 關鍵指標 ── */}
      {tab === "metrics" && (
        <div style={s.card}>
          <div style={s.sectionTitle}>獲利能力趨勢（%）</div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metricsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", color: "#e2e8f0" }} />
              <Legend />
              <Line type="monotone" dataKey="毛利率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="淨利率" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ROE" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
