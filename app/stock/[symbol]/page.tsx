"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MA_CONFIG = [
  { key: "sma10",  label: "MA10",  color: "#f59e0b",  default: true },
  { key: "sma20",  label: "MA20",  color: "#3b82f6",  default: true },
  { key: "sma50",  label: "MA50",  color: "#22c55e",  default: true },
  { key: "sma200", label: "MA200", color: "#ef4444",  default: true },
  { key: "ema8",   label: "EMA8",  color: "#a78bfa",  default: true },
  { key: "ema21",  label: "EMA21", color: "#fb7185",  default: true },
];

export default function StockPage({ params }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();

  const [quote, setQuote] = useState(null);
  const [candles, setCandles] = useState([]);
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [activeMA, setActiveMA] = useState(
    Object.fromEntries(MA_CONFIG.map(m => [m.key, m.default]))
  );

  const chartRef = useRef(null);
  const maSeriesRef = useRef({});
  const volumeSeriesRef = useRef(null);
  const obvSeriesRef = useRef(null);
  const macdSeriesRef = useRef(null);
  const signalSeriesRef = useRef(null);
  const histSeriesRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const volumeChartRef = useRef(null);
  const obvChartRef = useRef(null);
  const macdChartRef = useRef(null);
  const volumeContainerRef = useRef(null);
  const obvContainerRef = useRef(null);
  const macdContainerRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/stock/" + symbol + "?tab=overview").then(r => r.json()),
      fetch("/api/stock/" + symbol + "?tab=indicators").then(r => r.json()),
    ]).then(([ov, ind]) => {
      setQuote(ov.quote);
      setCandles(ov.candles || []);
      setIndicators(ind);
      setLoading(false);
    });
  }, [symbol]);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0 || !indicators) return;

    import("lightweight-charts").then((lc) => {
      const w = chartRef.current.parentElement?.clientWidth || 800;

      // 清除舊圖
      [chartInstanceRef, volumeChartRef, obvChartRef, macdChartRef].forEach(r => {
        if (r.current) { try { r.current.remove(); } catch {} r.current = null; }
      });
      [chartRef, volumeContainerRef, obvContainerRef, macdContainerRef].forEach(r => {
        if (r.current) r.current.innerHTML = "";
      });

      const chartOpts = (h) => ({
        layout: { background: { type: lc.ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
        grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
        width: w, height: h,
        timeScale: { borderColor: "#334155" },
        rightPriceScale: { borderColor: "#334155" },
      });

      const formatted = [...candles].reverse().map(c => ({
        time: c.date, open: c.open, high: c.high, low: c.low, close: c.close,
      }));

      // K線主圖
      const mainChart = lc.createChart(chartRef.current, chartOpts(420));
      chartInstanceRef.current = mainChart;
      const candleSeries = mainChart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      });
      candleSeries.setData(formatted);

      // MA 均線
      const maDataMap = {
        sma10: indicators.sma10, sma20: indicators.sma20,
        sma50: indicators.sma50, sma200: indicators.sma200,
        ema8: indicators.ema8, ema21: indicators.ema21,
      };
      MA_CONFIG.forEach(({ key, color }) => {
        const raw = maDataMap[key] ?? [];
        const fieldKey = key.startsWith("sma") ? "sma" : "ema";
        const data = [...raw].reverse()
          .filter(p => p[fieldKey] != null)
          .map(p => ({ time: p.date, value: p[fieldKey] }));
        const series = mainChart.addSeries(lc.LineSeries, {
          color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
          visible: activeMA[key],
        });
        series.setData(data);
        maSeriesRef.current[key] = series;
      });

      mainChart.timeScale().fitContent();

      // 成交量圖
      const volChart = lc.createChart(volumeContainerRef.current, chartOpts(120));
      volumeChartRef.current = volChart;
      const volSeries = volChart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "right",
      });
      volSeries.setData([...candles].reverse().map(c => ({
        time: c.date,
        value: c.volume,
        color: c.close >= c.open ? "#22c55e55" : "#ef444455",
      })));
      volChart.timeScale().fitContent();

      // OBV 圖
      const obvChart = lc.createChart(obvContainerRef.current, chartOpts(120));
      obvChartRef.current = obvChart;
      const obvSeries = obvChart.addSeries(lc.LineSeries, {
        color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      const obvData = [...(indicators.obv ?? [])].reverse()
        .filter(p => p.obv != null)
        .map(p => ({ time: p.date, value: p.obv }));
      obvSeries.setData(obvData);
      obvChart.timeScale().fitContent();

      // MACD 圖
      const macdChart = lc.createChart(macdContainerRef.current, chartOpts(150));
      macdChartRef.current = macdChart;
      const macdRaw = [...(indicators.macd ?? [])].reverse();

      const histSeries = macdChart.addSeries(lc.HistogramSeries, {
        priceScaleId: "right", priceLineVisible: false,
      });
      histSeries.setData(macdRaw.filter(p => p.histogram != null).map(p => ({
        time: p.date, value: p.histogram,
        color: p.histogram >= 0 ? "#22c55e" : "#ef4444",
      })));

      const macdLine = macdChart.addSeries(lc.LineSeries, {
        color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      macdLine.setData(macdRaw.filter(p => p.macd != null).map(p => ({ time: p.date, value: p.macd })));

      const signalLine = macdChart.addSeries(lc.LineSeries, {
        color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      signalLine.setData(macdRaw.filter(p => p.signal != null).map(p => ({ time: p.date, value: p.signal })));

      macdChart.timeScale().fitContent();

      // 同步時間軸
      [volChart, obvChart, macdChart].forEach(c => {
        mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
          if (range) c.timeScale().setVisibleLogicalRange(range);
        });
        c.timeScale().subscribeVisibleLogicalRangeChange(range => {
          if (range) mainChart.timeScale().setVisibleLogicalRange(range);
        });
      });
    });
  }, [candles, indicators]);

  // MA 開關
  function toggleMA(key) {
    const next = !activeMA[key];
    setActiveMA(prev => ({ ...prev, [key]: next }));
    const series = maSeriesRef.current[key];
    if (series) series.applyOptions({ visible: next });
  }

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
      <button onClick={() => router.push("/")}
        style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20, display: "block" }}>
        ← 返回首頁
      </button>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b", fontSize: 18 }}>載入中...</div>
      ) : quote ? (
        <>
          {/* 報價區 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 4 }}>{symbol} · NASDAQ</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{quote.name}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 40, fontWeight: 800 }}>${quote.price?.toFixed(2)}</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: up ? "#22c55e" : "#ef4444" }}>
                  {up ? "+" : ""}{quote.change?.toFixed(2)} ({quote.changePercentage?.toFixed(2)}%)
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => router.push("/stock/" + symbol + "/financials")}
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  📊 查看財報
                </button>
              </div>
            </div>
          </div>

          {/* MA 開關 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {MA_CONFIG.map(({ key, label, color }) => (
              <button key={key} onClick={() => toggleMA(key)}
                style={{ background: activeMA[key] ? color + "33" : "#1e293b", border: `1px solid ${activeMA[key] ? color : "#334155"}`, color: activeMA[key] ? color : "#64748b", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>

          {/* 圖表區 */}
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#94a3b8" }}>K線 + 均線</div>
            <div ref={chartRef} />
          </div>
          <div style={{ background: "#1e293b", borderRadius: "0 0 0 0", padding: "8px 16px", marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>成交量</div>
            <div ref={volumeContainerRef} />
          </div>
          <div style={{ background: "#1e293b", padding: "8px 16px", marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>OBV</div>
            <div ref={obvContainerRef} />
          </div>
          <div style={{ background: "#1e293b", borderRadius: "0 0 12px 12px", padding: "8px 16px", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>MACD（藍：MACD｜橘：訊號線｜柱：能量）</div>
            <div ref={macdContainerRef} />
          </div>

          {/* 數據卡片 */}
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

          {/* AI 分析 */}
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