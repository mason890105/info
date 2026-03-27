"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

export default function FinancialsPage({ params }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("quarter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stock/${symbol}?tab=financials&period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
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

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: "24px" }}>
      <button onClick={() => router.push("/stock/" + symbol)} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20, display: "block" }}>
        ← 返回 {symbol}
      </button>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{symbol} 財報分析</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, marginTop: 12 }}>
        {["quarter", "annual"].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ background: period === p ? "#3b82f6" : "#1e293b", color: period === p ? "#fff" : "#94a3b8", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {p === "quarter" ? "季度" : "年度"}
          </button>
        ))}
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
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="營收" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="毛利" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="淨利" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>每股盈餘（EPS）</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={epsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Line type="monotone" dataKey="EPS" stroke="#a78bfa" strokeWidth={2} dot={{ fill: "#a78bfa" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>財報數據表</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    {["日期", "營收", "毛利", "營業利益", "淨利", "EPS"].map(h => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}