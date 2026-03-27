"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend
} from "recharts";

export default function IndicatorsPage({ params }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stock/${symbol}?tab=indicators`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [symbol]);

  const rsiData = (data?.rsi ?? []).slice(0, 60).reverse();
  const macdData = (data?.macd ?? []).slice(0, 60).reverse();

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      <button onClick={() => router.push("/stock/" + symbol)}
        style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20, display: "block" }}>
        ← 返回 {symbol}
      </button>

      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{symbol} 技術指標</div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>RSI · MACD · 均線</div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>載入中...</div>
      ) : (
        <>
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#94a3b8" }}>RSI（14日）</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>超買區 &gt; 70（紅線）｜超賣區 &lt; 30（綠線）</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rsiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={v => [v.toFixed(2), "RSI"]} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" />
                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke="#475569" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#94a3b8" }}>MACD</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>MACD線（藍）｜訊號線（橘）｜柱狀（綠漲紅跌）</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={macdData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={(v, n) => [v.toFixed(4), n]} />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="histogram" name="柱狀" shape={(props) => {
                  const { x, y, width, height, value } = props;
                  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={value >= 0 ? "#22c55e" : "#ef4444"} rx={2} />;
                }} />
                <Line type="monotone" dataKey="macd" name="MACD" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="signal" name="訊號線" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>均線數據（最新一日）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "SMA 50", value: data?.sma50?.[0]?.sma, color: "#3b82f6" },
                { label: "SMA 200", value: data?.sma200?.[0]?.sma, color: "#f59e0b" },
                { label: "EMA 20", value: data?.ema20?.[0]?.ema, color: "#22c55e" },
              ].map(item => (
                <div key={item.label} style={{ background: "#0f172a", borderRadius: 10, padding: "16px 20px", borderLeft: `3px solid ${item.color}` }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
                    {item.value ? "$" + item.value.toFixed(2) : "N/A"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}