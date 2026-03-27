"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from "recharts";

export default function FinancialsPage({ params }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [news, setNews] = useState([]);
  const [period, setPeriod] = useState("quarter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/stock/${symbol}?tab=financials&period=${period}`).then(r => r.json()),
      fetch(`/api/stock/${symbol}?tab=news`).then(r => r.json()),
    ]).then(([fin, n]) => {
      setData(fin);
      setNews(n.news ?? []);
      setLoading(false);
    });
  }, [symbol, period]);

  const income = data?.income?.slice(0, 8).reverse() || [];

  const revenueData = income.map(q => ({
    date: q.date.slice(0, 7),
    營收: +(q.revenue / 1e9).toFixed(2),
    毛利: +(q.grossProfit / 1e9).toFixed(2),
    淨利: +(q.netIncome / 1e9).toFixed(2),
  }));

  const epsData = income.map(q => ({
    date: q.date.slice(0, 7),
    EPS: +q.eps.toFixed(2),
  }));

  const marginData = income.map(q => ({
    date: q.date.slice(0, 7),
    毛利率: q.revenue > 0 ? +((q.grossProfit / q.revenue) * 100).toFixed(1) : 0,
    營業利益率: q.revenue > 0 ? +((q.operatingIncome / q.revenue) * 100).toFixed(1) : 0,
    淨利率: q.revenue > 0 ? +((q.netIncome / q.revenue) * 100).toFixed(1) : 0,
  }));

  const tooltipStyle = { contentStyle: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8 } };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      <button onClick={() => router.push("/stock/" + symbol)}
        style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20, display: "block" }}>
        ← 返回 {symbol}
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{symbol} 財務報告</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>損益表 · 趨勢分析 · 最新動態</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["quarter", "annual"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ background: period === p ? "#3b82f6" : "#1e293b", color: period === p ? "#fff" : "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {p === "quarter" ? "季報" : "年報"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>載入中...</div>
      ) : (
        <>
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>營收 / 毛利 / 淨利（十億美元）</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Bar dataKey="營收" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="毛利" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="淨利" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>每股盈餘（EPS）</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={epsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="EPS" stroke="#a78bfa" strokeWidth={2} dot={{ fill: "#a78bfa" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#94a3b8" }}>關鍵指標趨勢</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>毛利率 · 營業利益率 · 淨利率（%）</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={marginData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" />
                <Tooltip {...tooltipStyle} formatter={(v) => v + "%"} />
                <Legend />
                <Line type="monotone" dataKey="毛利率" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="營業利益率" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="淨利率" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>財報數據表</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    {["日期", "營收", "毛利", "營業利益", "淨利", "EPS", "毛利率"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: "#64748b", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.income?.slice(0, 8).map((q, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{q.date.slice(0, 7)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>${(q.revenue/1e9).toFixed(2)}B</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#22c55e" }}>${(q.grossProfit/1e9).toFixed(2)}B</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>${(q.operatingIncome/1e9).toFixed(2)}B</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#f59e0b" }}>${(q.netIncome/1e9).toFixed(2)}B</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#a78bfa" }}>${q.eps.toFixed(2)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{q.revenue > 0 ? ((q.grossProfit/q.revenue)*100).toFixed(1) : "N/A"}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>📰 最新相關新聞</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {news.slice(0, 6).map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", gap: 16, textDecoration: "none", background: "#0f172a", borderRadius: 10, padding: 16, border: "1px solid #334155" }}>
                  {item.image && (
                    <img src={item.image} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 6, lineHeight: 1.4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{item.text?.slice(0, 100)}...</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{item.publisher} · {item.publishedDate?.slice(0, 10)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}