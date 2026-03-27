"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from "recharts";

const TABS = ["損益表", "資產負債", "現金流", "關鍵指標"];

export default function FinancialsPage({ params }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [news, setNews] = useState([]);
  const [period, setPeriod] = useState("quarter");
  const [activeTab, setActiveTab] = useState("損益表");
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
  const balance = data?.balance?.slice(0, 8).reverse() || [];
  const cashflow = data?.cashflow?.slice(0, 8).reverse() || [];

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

  const balanceData = balance.map(q => ({
    date: q.date.slice(0, 7),
    總資產: +(q.totalAssets / 1e9).toFixed(2),
    總負債: +(q.totalLiabilities / 1e9).toFixed(2),
    股東權益: +(q.totalStockholdersEquity / 1e9).toFixed(2),
  }));

  const cashflowData = cashflow.map(q => ({
    date: q.date.slice(0, 7),
    營業現金流: +(q.operatingCashFlow / 1e9).toFixed(2),
    自由現金流: +(q.freeCashFlow / 1e9).toFixed(2),
    資本支出: +(Math.abs(q.capitalExpenditure) / 1e9).toFixed(2),
  }));

  const roeData = income.map((q, i) => {
    const b = data?.balance?.[data.balance.length - 1 - i];
    const roe = b?.totalStockholdersEquity > 0
      ? +((q.netIncome / b.totalStockholdersEquity) * 100).toFixed(1) : 0;
    const roa = b?.totalAssets > 0
      ? +((q.netIncome / b.totalAssets) * 100).toFixed(1) : 0;
    const debtRatio = b?.totalAssets > 0
      ? +((b.totalLiabilities / b.totalAssets) * 100).toFixed(1) : 0;
    return { date: q.date.slice(0, 7), ROE: roe, ROA: roa, 負債比率: debtRatio };
  });

  const tt = { contentStyle: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8 } };
  const card = (label, value, color = "#e2e8f0") => (
    <div style={{ background: "#0f172a", borderRadius: 10, padding: "16px 20px", border: "1px solid #334155" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      <button onClick={() => router.push("/stock/" + symbol)}
        style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20, display: "block" }}>
        ← 返回 {symbol}
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{symbol} 財務報告</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>損益表 · 資產負債 · 現金流 · 關鍵指標</div>
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

      {/* 分頁籤 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #334155", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ background: "none", border: "none", borderBottom: activeTab === t ? "2px solid #3b82f6" : "2px solid transparent", color: activeTab === t ? "#3b82f6" : "#64748b", fontSize: 14, fontWeight: 600, padding: "10px 20px", cursor: "pointer", marginBottom: -1 }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>載入中...</div>
      ) : (
        <>
          {/* 損益表 */}
          {activeTab === "損益表" && (
            <>
              {/* 摘要卡片 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                {card("最新營收", `$${(data?.income?.[0]?.revenue/1e9).toFixed(2)}B`)}
                {card("最新EPS", `$${data?.income?.[0]?.eps?.toFixed(2)}`, "#a78bfa")}
                {card("毛利率", `${data?.income?.[0]?.revenue > 0 ? ((data.income[0].grossProfit/data.income[0].revenue)*100).toFixed(1) : "N/A"}%`, "#22c55e")}
                {card("淨利率", `${data?.income?.[0]?.revenue > 0 ? ((data.income[0].netIncome/data.income[0].revenue)*100).toFixed(1) : "N/A"}%`, "#f59e0b")}
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>營收 / 毛利 / 淨利（十億美元）</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip {...tt} />
                    <Legend />
                    <Bar dataKey="營收" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="毛利" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="淨利" fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>每股盈餘（EPS）</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={epsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip {...tt} />
                    <Line type="monotone" dataKey="EPS" stroke="#a78bfa" strokeWidth={2} dot={{ fill: "#a78bfa" }} />
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
            </>
          )}

          {/* 資產負債 */}
          {activeTab === "資產負債" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                {card("總資產", `$${(data?.balance?.[0]?.totalAssets/1e9).toFixed(2)}B`)}
                {card("總負債", `$${(data?.balance?.[0]?.totalLiabilities/1e9).toFixed(2)}B`, "#ef4444")}
                {card("現金", `$${(data?.balance?.[0]?.cashAndCashEquivalents/1e9).toFixed(2)}B`, "#22c55e")}
                {card("總債務", `$${(data?.balance?.[0]?.totalDebt/1e9).toFixed(2)}B`, "#f59e0b")}
                {card("股東權益", `$${(data?.balance?.[0]?.totalStockholdersEquity/1e9).toFixed(2)}B`, "#3b82f6")}
                {card("負債比率", `${data?.balance?.[0]?.totalAssets > 0 ? ((data.balance[0].totalLiabilities/data.balance[0].totalAssets)*100).toFixed(1) : "N/A"}%`, "#fb7185")}
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>資產 / 負債 / 股東權益（十億美元）</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={balanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip {...tt} />
                    <Legend />
                    <Bar dataKey="總資產" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="總負債" fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar dataKey="股東權益" fill="#22c55e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>資產負債數據表</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #334155" }}>
                        {["日期", "總資產", "總負債", "股東權益", "現金", "總債務", "負債比率"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: "#64748b", fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.balance?.slice(0, 8).map((q, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{q.date.slice(0, 7)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>${(q.totalAssets/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#ef4444" }}>${(q.totalLiabilities/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#3b82f6" }}>${(q.totalStockholdersEquity/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#22c55e" }}>${(q.cashAndCashEquivalents/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#f59e0b" }}>${(q.totalDebt/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#fb7185" }}>{q.totalAssets > 0 ? ((q.totalLiabilities/q.totalAssets)*100).toFixed(1) : "N/A"}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 現金流 */}
          {activeTab === "現金流" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                {card("營業現金流", `$${(data?.cashflow?.[0]?.operatingCashFlow/1e9).toFixed(2)}B`, "#22c55e")}
                {card("自由現金流", `$${(data?.cashflow?.[0]?.freeCashFlow/1e9).toFixed(2)}B`, "#3b82f6")}
                {card("資本支出", `$${(Math.abs(data?.cashflow?.[0]?.capitalExpenditure)/1e9).toFixed(2)}B`, "#f59e0b")}
                {card("股利發放", `$${(Math.abs(data?.cashflow?.[0]?.dividendsPaid ?? 0)/1e9).toFixed(2)}B`, "#a78bfa")}
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>現金流量趨勢（十億美元）</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={cashflowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip {...tt} />
                    <Legend />
                    <Bar dataKey="營業現金流" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="自由現金流" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="資本支出" fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>現金流數據表</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #334155" }}>
                        {["日期", "營業現金流", "自由現金流", "資本支出", "股利發放"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: "#64748b", fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.cashflow?.slice(0, 8).map((q, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{q.date.slice(0, 7)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#22c55e" }}>${(q.operatingCashFlow/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#3b82f6" }}>${(q.freeCashFlow/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#f59e0b" }}>${(Math.abs(q.capitalExpenditure)/1e9).toFixed(2)}B</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#a78bfa" }}>${(Math.abs(q.dividendsPaid ?? 0)/1e9).toFixed(2)}B</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 關鍵指標 */}
          {activeTab === "關鍵指標" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                {card("ROE", `${roeData[roeData.length-1]?.ROE ?? "N/A"}%`, "#22c55e")}
                {card("ROA", `${roeData[roeData.length-1]?.ROA ?? "N/A"}%`, "#3b82f6")}
                {card("負債比率", `${roeData[roeData.length-1]?.負債比率 ?? "N/A"}%`, "#ef4444")}
                {card("毛利率", `${marginData[marginData.length-1]?.毛利率 ?? "N/A"}%`, "#f59e0b")}
                {card("營業利益率", `${marginData[marginData.length-1]?.營業利益率 ?? "N/A"}%`, "#a78bfa")}
                {card("淨利率", `${marginData[marginData.length-1]?.淨利率 ?? "N/A"}%`, "#fb7185")}
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#94a3b8" }}>獲利能力趨勢</div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>毛利率 · 營業利益率 · 淨利率（%）</div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={marginData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" />
                    <Tooltip {...tt} formatter={v => v + "%"} />
                    <Legend />
                    <Line type="monotone" dataKey="毛利率" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="營業利益率" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="淨利率" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#94a3b8" }}>ROE / ROA 趨勢</div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>股東權益報酬率 · 資產報酬率（%）</div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={roeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" />
                    <Tooltip {...tt} formatter={v => v + "%"} />
                    <Legend />
                    <Line type="monotone" dataKey="ROE" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ROA" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="負債比率" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* 最新新聞 */}
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginTop: 20 }}>
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