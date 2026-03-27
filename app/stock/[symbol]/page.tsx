"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export default function StockPage({ params }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();
  const chartRef = useRef(null);
  const [quote, setQuote] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState("");
  const [analysing, setAnalysing] = useState(false);
  useEffect(() => {
    fetch("/api/stock/" + symbol + "?tab=overview")
      .then(r => r.json())
      .then(data => {
        setQuote(data.quote);
        setCandles(data.candles || []);
        setLoading(false);
      });
  }, [symbol]);
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    const container = chartRef.current;
    const w = container.parentElement?.clientWidth || 800;
    import("lightweight-charts").then((lc) => {
      container.innerHTML = "";
      const chart = lc.createChart(container, {
        layout: { background: { type: lc.ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
        grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
        width: w,
        height: 400,
      });
      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      });
      const formatted = [...candles].reverse().map(c => ({
        time: c.date, open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      series.setData(formatted);
      chart.timeScale().fitContent();
    });
  }, [candles]);
  async function getAnalysis() {
    setAnalysing(true);
    setAnalysis("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || data.error || "分析失敗");
    } catch {
      setAnalysis("分析失敗，請稍後再試");
    }
    setAnalysing(false);
  }
  const up = quote && quote.change >= 0;
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: "24px" }}>
      <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20, display: "block" }}>
        ← 返回首頁
      </button>
      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b", fontSize: 18 }}>載入中...</div>
      ) : quote ? (
        <>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 4 }}>{symbol} · NASDAQ</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{quote.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 40, fontWeight: 800 }}>${quote.price?.toFixed(2)}</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: up ? "#22c55e" : "#ef4444" }}>
                {up ? "+" : ""}{quote.change?.toFixed(2)} ({quote.changePercentage?.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#94a3b8" }}>歷史K線</div>
            <div ref={chartRef} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "今日開盤", value: "$" + quote.open?.toFixed(2) },
              { label: "昨日收盤", value: "$" + quote.previousClose?.toFixed(2) },
              { label: "今日最高", value: "$" + quote.dayHigh?.toFixed(2) },
              { label: "今日最低", value: "$" + quote.dayLow?.toFixed(2) },
              { label: "成交量", value: ((quote.volume ?? 0) / 1e6).toFixed(1) + "M" },
              { label: "市值", value: "$" + ((quote.marketCap ?? 0) / 1e12).toFixed(2) + "T" },
            ].map(card => (
              <div key={card.label} style={{ background: "#1e293b", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{card.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>🤖 AI 財報解讀</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>由 Claude AI 分析最近4季財報</div>
              </div>
              <button onClick={getAnalysis} disabled={analysing}
                style={{ background: analysing ? "#334155" : "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: analysing ? "not-allowed" : "pointer" }}>
                {analysing ? "分析中..." : "開始分析"}
              </button>
            </div>
            {analysis && (
              <div style={{ fontSize: 14, lineHeight: 1.8, color: "#cbd5e1", whiteSpace: "pre-wrap", borderTop: "1px solid #334155", paddingTop: 16 }}>
                {analysis}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 80, color: "#ef4444" }}>找不到股票資料</div>
      )}
    </div>
  );
}