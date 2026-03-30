"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MA_CONFIG = [
  { key: "sma10",  label: "MA10",  defaultColor: "#f59e0b" },
  { key: "sma20",  label: "MA20",  defaultColor: "#3b82f6" },
  { key: "sma50",  label: "MA50",  defaultColor: "#22c55e" },
  { key: "sma200", label: "MA200", defaultColor: "#ef4444" },
  { key: "ema8",   label: "EMA8",  defaultColor: "#a78bfa" },
  { key: "ema21",  label: "EMA21", defaultColor: "#fb7185" },
];

function calcBollinger(candles: any[], period = 20, multiplier = 2) {
  const closes = [...candles].reverse().map(c => c.close);
  const result: { time: string; upper: number; middle: number; lower: number }[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    result.push({
      time: [...candles].reverse()[i].date.slice(0, 10),
      upper: +(mean + multiplier * std).toFixed(4),
      middle: +mean.toFixed(4),
      lower: +(mean - multiplier * std).toFixed(4),
    });
  }
  return result;
}

export default function StockPage({ params }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();

  const [quote, setQuote] = useState(null);
  const [candles, setCandles] = useState([]);
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeMA, setActiveMA] = useState(
    Object.fromEntries(MA_CONFIG.map(m => [m.key, true]))
  );
  const [maColors, setMaColors] = useState(
    Object.fromEntries(MA_CONFIG.map(m => [m.key, m.defaultColor]))
  );
  const [showBB, setShowBB] = useState(false);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbMult, setBbMult] = useState(2);

  const chartRef = useRef(null);
  const maSeriesRef = useRef({});
  const bbSeriesRef = useRef<any[]>([]);
  const volumeChartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const volumeContainerRef = useRef(null);

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

      if (chartInstanceRef.current) { try { chartInstanceRef.current.remove(); } catch {} chartInstanceRef.current = null; }
      if (volumeChartRef.current) { try { volumeChartRef.current.remove(); } catch {} volumeChartRef.current = null; }
      if (chartRef.current) chartRef.current.innerHTML = "";
      if (volumeContainerRef.current) volumeContainerRef.current.innerHTML = "";

      maSeriesRef.current = {};
      bbSeriesRef.current = [];

      const chartOpts = (h) => ({
        layout: { background: { type: lc.ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
        grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
        width: w, height: h,
        timeScale: { borderColor: "#334155" },
        rightPriceScale: { borderColor: "#334155" },
      });

      const formatted = [...candles].reverse().map(c => ({
        time: c.date.slice(0, 10),
        open: c.open, high: c.high, low: c.low, close: c.close,
      }));

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
      MA_CONFIG.forEach(({ key }) => {
        const raw = maDataMap[key] ?? [];
        const fieldKey = key.startsWith("sma") ? "sma" : "ema";
        const d = [...raw].reverse()
          .filter(p => p[fieldKey] != null)
          .map(p => ({ time: p.date.slice(0, 10), value: p[fieldKey] }));
        const series = mainChart.addSeries(lc.LineSeries, {
          color: maColors[key], lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false,
          visible: activeMA[key],
        });
        series.setData(d);
        maSeriesRef.current[key] = series;
      });

      // 布林通道
      if (showBB && candles.length > bbPeriod) {
        const bbData = calcBollinger(candles, bbPeriod, bbMult);
        const bbStyle = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false };
        const upper = mainChart.addSeries(lc.LineSeries, { ...bbStyle, color: "#60a5fa88" });
        const middle = mainChart.addSeries(lc.LineSeries, { ...bbStyle, color: "#60a5fa", lineWidth: 1 });
        const lower = mainChart.addSeries(lc.LineSeries, { ...bbStyle, color: "#60a5fa88" });
        upper.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
        middle.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
        lower.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
        bbSeriesRef.current = [upper, middle, lower];
      }

      mainChart.timeScale().fitContent();

      // 成交量
      const volChart = lc.createChart(volumeContainerRef.current, chartOpts(120));
      volumeChartRef.current = volChart;
      const volSeries = volChart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" }, priceScaleId: "right",
      });
      volSeries.setData([...candles].reverse().map(c => ({
        time: c.date.slice(0, 10), value: c.volume,
        color: c.close >= c.open ? "#22c55e55" : "#ef444455",
      })));
      volChart.timeScale().fitContent();

      mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) volChart.timeScale().setVisibleLogicalRange(range);
      });
      volChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) mainChart.timeScale().setVisibleLogicalRange(range);
      });
    });
  }, [candles, indicators, showBB, bbPeriod, bbMult, maColors]);

  function toggleMA(key) {
    const next = !activeMA[key];
    setActiveMA(prev => ({ ...prev, [key]: next }));
    const series = maSeriesRef.current[key];
    if (series) series.applyOptions({ visible: next });
  }

  function changeMAColor(key, color) {
    setMaColors(prev => ({ ...prev, [key]: color }));
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
              <button onClick={() => router.push("/stock/" + symbol + "/financials")}
                style={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                📊 查看財報
              </button>
            </div>
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

          {/* MA 均線控制 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
            {MA_CONFIG.map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => toggleMA(key)}
                  style={{
                    background: activeMA[key] ? maColors[key] + "33" : "#1e293b",
                    border: `1px solid ${activeMA[key] ? maColors[key] : "#334155"}`,
                    color: activeMA[key] ? maColors[key] : "#64748b",
                    borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>
                  {label}
                </button>
                <input
                  type="color"
                  value={maColors[key]}
                  onChange={e => changeMAColor(key, e.target.value)}
                  style={{ width: 22, height: 22, border: "none", borderRadius: 4, cursor: "pointer", background: "none", padding: 0 }}
                  title={`${label} 顏色`}
                />
              </div>
            ))}
          </div>

          {/* 布林通道控制 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => setShowBB(prev => !prev)}
              style={{
                background: showBB ? "#60a5fa33" : "#1e293b",
                border: `1px solid ${showBB ? "#60a5fa" : "#334155"}`,
                color: showBB ? "#60a5fa" : "#64748b",
                borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer"
              }}>
              布林通道
            </button>
            {showBB && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                  週期
                  <input type="number" value={bbPeriod} min={5} max={50}
                    onChange={e => setBbPeriod(Number(e.target.value))}
                    style={{ width: 50, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", padding: "3px 8px", fontSize: 12 }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                  倍數
                  <input type="number" value={bbMult} min={1} max={4} step={0.5}
                    onChange={e => setBbMult(Number(e.target.value))}
                    style={{ width: 50, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", padding: "3px 8px", fontSize: 12 }}
                  />
                </div>
              </>
            )}
          </div>

          <div style={{ background: "#1e293b", borderRadius: "12px 12px 0 0", padding: 16, marginBottom: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#94a3b8" }}>K線 + 均線</div>
            <div ref={chartRef} />
          </div>
          <div style={{ background: "#1e293b", borderRadius: "0 0 12px 12px", padding: "8px 16px", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>成交量</div>
            <div ref={volumeContainerRef} />
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 80, color: "#ef4444" }}>找不到股票資料</div>
      )}
    </div>
  );
}