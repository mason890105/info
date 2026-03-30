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

const STORAGE_KEY   = "chart-settings-v1";
const WATCHLIST_KEY = "watchlist-v1";

const DEFAULT_SETTINGS = {
  activeMA: Object.fromEntries(MA_CONFIG.map(m => [m.key, true])),
  maColors:  Object.fromEntries(MA_CONFIG.map(m => [m.key, m.defaultColor])),
  showBB: false, bbPeriod: 20, bbMult: 2,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw);
    return {
      activeMA: { ...DEFAULT_SETTINGS.activeMA, ...p.activeMA },
      maColors:  { ...DEFAULT_SETTINGS.maColors,  ...p.maColors },
      showBB:   p.showBB   ?? DEFAULT_SETTINGS.showBB,
      bbPeriod: p.bbPeriod ?? DEFAULT_SETTINGS.bbPeriod,
      bbMult:   p.bbMult   ?? DEFAULT_SETTINGS.bbMult,
    };
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(s: typeof DEFAULT_SETTINGS) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function loadWatchlist(): string[] {
  try { const r = localStorage.getItem(WATCHLIST_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function saveWatchlist(list: string[]) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); } catch {}
}

function calcBollinger(candles: any[], period = 20, multiplier = 2) {
  const closes = [...candles].reverse().map((c: any) => c.close);
  const result: { time: string; upper: number; middle: number; lower: number }[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a: number, b: number) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / period);
    result.push({
      time:   [...candles].reverse()[i].date.slice(0, 10),
      upper:  +(mean + multiplier * std).toFixed(4),
      middle: +mean.toFixed(4),
      lower:  +(mean - multiplier * std).toFixed(4),
    });
  }
  return result;
}

function calcRSFromCandles(stockCandles: any[], spyCandles: any[]) {
  const stockCloses = [...stockCandles].reverse().map((c: any) => c.close);
  const spyCloses   = [...spyCandles].reverse().map((c: any) => c.close);
  const periods = [{ key: "m1", days: 21 }, { key: "m3", days: 63 }, { key: "y1", days: 252 }];
  const result: Record<string, any> = {};
  for (const { key, days } of periods) {
    if (stockCloses.length < days + 1 || spyCloses.length < days + 1) {
      result[key] = { stock: 0, spy: 0, diff: 0, label: "資料不足" }; continue;
    }
    const sLen = stockCloses.length, pLen = spyCloses.length;
    const sRet = ((stockCloses[sLen-1] - stockCloses[sLen-1-days]) / stockCloses[sLen-1-days]) * 100;
    const pRet = ((spyCloses[pLen-1]   - spyCloses[pLen-1-days])   / spyCloses[pLen-1-days])   * 100;
    const diff = sRet - pRet;
    const label = diff >= 10 ? "強勢★" : diff >= 3 ? "略強" : diff >= -3 ? "中立" : diff >= -10 ? "略弱" : "弱勢";
    result[key] = { stock: +sRet.toFixed(2), spy: +pRet.toFixed(2), diff: +diff.toFixed(2), label };
  }
  return result;
}

type Tab = "overview" | "technical" | "financials";

const RS_PERIODS = [
  { label: "1 個月", key: "m1" },
  { label: "3 個月", key: "m3" },
  { label: "1 年",   key: "y1" },
];

const DATA_CARDS = (quote: any) => [
  { label: "今日開盤", value: "$" + quote.open?.toFixed(2) },
  { label: "昨日收盤", value: "$" + quote.previousClose?.toFixed(2) },
  { label: "今日最高", value: "$" + quote.dayHigh?.toFixed(2) },
  { label: "今日最低", value: "$" + quote.dayLow?.toFixed(2) },
  { label: "成交量",   value: ((quote.volume ?? 0) / 1e6).toFixed(1) + "M" },
  { label: "市值",     value: "$" + ((quote.marketCap ?? 0) / 1e12).toFixed(2) + "T" },
];

export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [quote, setQuote]           = useState<any>(null);
  const [candles, setCandles]       = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any>(null);
  const [rs, setRs]                 = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  const [activeMA, setActiveMA] = useState(DEFAULT_SETTINGS.activeMA);
  const [maColors, setMaColors] = useState(DEFAULT_SETTINGS.maColors);
  const [showBB,   setShowBB]   = useState(DEFAULT_SETTINGS.showBB);
  const [bbPeriod, setBbPeriod] = useState(DEFAULT_SETTINGS.bbPeriod);
  const [bbMult,   setBbMult]   = useState(DEFAULT_SETTINGS.bbMult);
  const [saved,    setSaved]    = useState(false);

  const [inWatchlist, setInWatchlist] = useState(false);
  const [wlFeedback,  setWlFeedback]  = useState("");

  const chartRef           = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  const maSeriesRef        = useRef<Record<string, any>>({});
  const bbSeriesRef        = useRef<any[]>([]);
  const chartInstanceRef   = useRef<any>(null);
  const volumeChartRef     = useRef<any>(null);

  useEffect(() => {
    const s = loadSettings();
    setActiveMA(s.activeMA); setMaColors(s.maColors);
    setShowBB(s.showBB); setBbPeriod(s.bbPeriod); setBbMult(s.bbMult);
    setInWatchlist(loadWatchlist().includes(symbol));
  }, [symbol]);

  useEffect(() => {
    Promise.all([
      fetch("/api/stock/" + symbol + "?tab=overview").then(r => r.json()),
      fetch("/api/stock/" + symbol + "?tab=indicators").then(r => r.json()),
      fetch("/api/stock/SPY?tab=overview").then(r => r.json()),
    ]).then(([ov, ind, spy]) => {
      setQuote(ov.quote);
      const sc = ov.candles || [];
      setCandles(sc);
      setIndicators(ind);
      if (ov.rs) { setRs(ov.rs); }
      else {
        const sp = spy.candles || [];
        if (sc.length > 0 && sp.length > 0) setRs(calcRSFromCandles(sc, sp));
      }
      setLoading(false);
    });
  }, [symbol]);

  useEffect(() => {
    if (activeTab !== "technical") return;
    if (!chartRef.current || candles.length === 0 || !indicators) return;

    import("lightweight-charts").then((lc) => {
      const w = chartRef.current?.parentElement?.clientWidth || 800;

      if (chartInstanceRef.current) { try { chartInstanceRef.current.remove(); } catch {} chartInstanceRef.current = null; }
      if (volumeChartRef.current)   { try { volumeChartRef.current.remove(); }   catch {} volumeChartRef.current = null; }
      if (chartRef.current)           chartRef.current.innerHTML = "";
      if (volumeContainerRef.current) volumeContainerRef.current.innerHTML = "";
      maSeriesRef.current = {}; bbSeriesRef.current = [];

      const chartOpts = (h: number) => ({
        layout: { background: { type: lc.ColorType.Solid, color: "#0f172a" }, textColor: "#94a3b8" },
        grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
        width: w, height: h,
        timeScale: { borderColor: "#334155" },
        rightPriceScale: { borderColor: "#334155" },
      });

      const formatted = [...candles].reverse().map((c: any) => ({
        time: c.date.slice(0, 10), open: c.open, high: c.high, low: c.low, close: c.close,
      }));

      const mainChart = lc.createChart(chartRef.current!, chartOpts(480));
      chartInstanceRef.current = mainChart;

      const candleSeries = mainChart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      });
      candleSeries.setData(formatted);

      const maDataMap: Record<string, any[]> = {
        sma10: indicators.sma10, sma20: indicators.sma20,
        sma50: indicators.sma50, sma200: indicators.sma200,
        ema8:  indicators.ema8,  ema21:  indicators.ema21,
      };
      MA_CONFIG.forEach(({ key }) => {
        const rawData = maDataMap[key] ?? [];
        const fieldKey = key.startsWith("sma") ? "sma" : "ema";
        const d = [...rawData].reverse()
          .filter((p: any) => p[fieldKey] != null)
          .map((p: any) => ({ time: p.date.slice(0, 10), value: p[fieldKey] }));
        const series = mainChart.addSeries(lc.LineSeries, {
          color: maColors[key], lineWidth: 1 as const,
          priceLineVisible: false, lastValueVisible: false, visible: activeMA[key],
        });
        series.setData(d);
        maSeriesRef.current[key] = series;
      });

      if (showBB && candles.length > bbPeriod) {
        const bbData = calcBollinger(candles, bbPeriod, bbMult);
        const bbStyle = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false };
        const upper  = mainChart.addSeries(lc.LineSeries, { ...bbStyle, color: "#60a5fa88" });
        const middle = mainChart.addSeries(lc.LineSeries, { ...bbStyle, color: "#60a5fa" });
        const lower  = mainChart.addSeries(lc.LineSeries, { ...bbStyle, color: "#60a5fa88" });
        upper.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
        middle.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
        lower.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
        bbSeriesRef.current = [upper, middle, lower];
      }
      mainChart.timeScale().fitContent();

      const volChart = lc.createChart(volumeContainerRef.current!, chartOpts(100));
      volumeChartRef.current = volChart;
      const volSeries = volChart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" }, priceScaleId: "right",
      });
      volSeries.setData([...candles].reverse().map((c: any) => ({
        time: c.date.slice(0, 10), value: c.volume,
        color: c.close >= c.open ? "#22c55e55" : "#ef444455",
      })));
      volChart.timeScale().fitContent();

      mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) volChart.timeScale().setVisibleLogicalRange(range); });
      volChart.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) mainChart.timeScale().setVisibleLogicalRange(range); });
    });
  }, [activeTab, candles, indicators, showBB, bbPeriod, bbMult, maColors]);

  function toggleMA(key: string) {
    const next = !activeMA[key];
    setActiveMA(prev => ({ ...prev, [key]: next }));
    const series = maSeriesRef.current[key];
    if (series) series.applyOptions({ visible: next });
  }

  function handleSave() {
    saveSettings({ activeMA, maColors, showBB, bbPeriod, bbMult });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setActiveMA(DEFAULT_SETTINGS.activeMA); setMaColors(DEFAULT_SETTINGS.maColors);
    setShowBB(DEFAULT_SETTINGS.showBB); setBbPeriod(DEFAULT_SETTINGS.bbPeriod); setBbMult(DEFAULT_SETTINGS.bbMult);
    localStorage.removeItem(STORAGE_KEY);
  }

  function toggleWatchlist() {
    const list = loadWatchlist();
    let next: string[];
    if (list.includes(symbol)) {
      next = list.filter(s => s !== symbol); setInWatchlist(false); setWlFeedback("已移除");
    } else {
      next = [...list, symbol]; setInWatchlist(true); setWlFeedback("已加入 ⭐");
    }
    saveWatchlist(next); setTimeout(() => setWlFeedback(""), 2000);
  }

  const up = quote && quote.change >= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui" }}>

      {/* 頂部 sticky 報價列 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "#0d1117", borderBottom: "1px solid #1e293b",
        padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 52,
      }}>
        <button onClick={() => router.push("/")}
          style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 600 }}>
          ← 返回
        </button>
        {quote && !loading && (
          <>
            <div style={{ width: 1, height: 20, background: "#334155" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{symbol}</span>
              <span style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quote.name}</span>
              <span style={{ fontSize: 15, fontWeight: 800, marginLeft: 8 }}>${quote.price?.toFixed(2)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: up ? "#22c55e" : "#ef4444" }}>
                {up ? "+" : ""}{quote.change?.toFixed(2)} ({quote.changePercentage?.toFixed(2)}%)
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {wlFeedback && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{wlFeedback}</span>}
              <button onClick={toggleWatchlist} style={{
                background: inWatchlist ? "#f59e0b22" : "#1e293b",
                border: `1px solid ${inWatchlist ? "#f59e0b" : "#334155"}`,
                color: inWatchlist ? "#f59e0b" : "#94a3b8",
                borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
                {inWatchlist ? "⭐ 已加入" : "☆ 自選股"}
              </button>
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b", fontSize: 18 }}>載入中...</div>
      ) : !quote ? (
        <div style={{ textAlign: "center", padding: 80, color: "#ef4444" }}>找不到股票資料</div>
      ) : (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>

          {/* Tab 列 */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e293b", marginBottom: 28, gap: 4 }}>
            {([ ["overview", "📋 概覽"], ["technical", "📈 技術指標"], ["financials", "📊 財報"] ] as [Tab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as Tab)} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "10px 20px", fontSize: 14, fontWeight: 600,
                color: activeTab === key ? "#3b82f6" : "#475569",
                borderBottom: `2px solid ${activeTab === key ? "#3b82f6" : "transparent"}`,
                marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {/* ── 概覽 Tab ── */}
          {activeTab === "overview" && (
            <div>
              {rs && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>
                    📈 RS 相對強度 vs SPY
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {RS_PERIODS.map(({ label, key }) => {
                      const data = rs[key];
                      if (!data) return null;
                      const pos = data.diff >= 0;
                      const color = pos ? "#22c55e" : "#ef4444";
                      return (
                        <div key={key} style={{
                          background: "#1e293b", borderRadius: 12, padding: "20px 16px", textAlign: "center",
                          border: `1px solid ${pos ? "#14532d" : "#450a0a"}`,
                        }}>
                          <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</div>
                          <div style={{ fontSize: 32, fontWeight: 900, color, marginBottom: 6, letterSpacing: -1 }}>
                            {pos ? "+" : ""}{data.diff}%
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.6 }}>
                            本股 {data.stock >= 0 ? "+" : ""}{data.stock}%<br />
                            SPY {data.spy >= 0 ? "+" : ""}{data.spy}%
                          </div>
                          <div style={{
                            display: "inline-block", fontSize: 11, fontWeight: 700,
                            padding: "4px 14px", borderRadius: 20,
                            background: pos ? "#14532d" : "#450a0a", color,
                          }}>{data.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {DATA_CARDS(quote).map(card => (
                  <div key={card.label} style={{ background: "#1e293b", borderRadius: 10, padding: "14px 18px" }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{card.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{card.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 技術指標 Tab ── */}
          {activeTab === "technical" && (
            <div>
              <div style={{ background: "#1e293b", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>均線設定</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {MA_CONFIG.map(({ key, label }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => toggleMA(key)} style={{
                        background: activeMA[key] ? maColors[key] + "33" : "#0f172a",
                        border: `1px solid ${activeMA[key] ? maColors[key] : "#334155"}`,
                        color: activeMA[key] ? maColors[key] : "#64748b",
                        borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>{label}</button>
                      <input type="color" value={maColors[key]}
                        onChange={e => setMaColors(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{ width: 22, height: 22, border: "none", borderRadius: 4, cursor: "pointer", background: "none", padding: 0 }}
                      />
                    </div>
                  ))}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    {saved && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>✓ 已儲存</span>}
                    <button onClick={handleSave}
                      style={{ background: "#0f172a", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
                      💾 儲存
                    </button>
                    <button onClick={handleReset}
                      style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer" }}>
                      重置
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                  <button onClick={() => setShowBB(p => !p)} style={{
                    background: showBB ? "#60a5fa33" : "#0f172a",
                    border: `1px solid ${showBB ? "#60a5fa" : "#334155"}`,
                    color: showBB ? "#60a5fa" : "#64748b",
                    borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>布林通道</button>
                  {showBB && (
                    <>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                        週期
                        <input type="number" value={bbPeriod} min={5} max={50} onChange={e => setBbPeriod(Number(e.target.value))}
                          style={{ width: 50, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", padding: "3px 8px", fontSize: 12 }} />
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                        倍數
                        <input type="number" value={bbMult} min={1} max={4} step={0.5} onChange={e => setBbMult(Number(e.target.value))}
                          style={{ width: 50, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", padding: "3px 8px", fontSize: 12 }} />
                      </label>
                    </>
                  )}
                </div>
              </div>

              <div style={{ background: "#1e293b", borderRadius: "12px 12px 0 0", padding: "14px 16px", marginBottom: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "#64748b" }}>K 線 + 均線</div>
                <div ref={chartRef} />
              </div>
              <div style={{ background: "#1e293b", borderRadius: "0 0 12px 12px", padding: "8px 16px" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>成交量</div>
                <div ref={volumeContainerRef} />
              </div>
            </div>
          )}

          {/* ── 財報 Tab ── */}
          {activeTab === "financials" && (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>財報頁面</div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 28 }}>
                查看 {symbol} 的 EPS、營收、現金流與 AI 財報解讀
              </div>
              <button onClick={() => router.push("/stock/" + symbol + "/financials")} style={{
                background: "#3b82f6", color: "#fff", border: "none",
                borderRadius: 10, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}>
                前往財報頁面 →
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}