"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POPULAR = [
  { symbol: "AAPL", name: "蘋果" },
  { symbol: "MSFT", name: "微軟" },
  { symbol: "NVDA", name: "輝達" },
  { symbol: "GOOGL", name: "谷歌" },
  { symbol: "AMZN", name: "亞馬遜" },
  { symbol: "META", name: "Meta" },
  { symbol: "TSLA", name: "特斯拉" },
  { symbol: "TSM", name: "台積電" },
];

const INDEX_LABELS: Record<string, string> = {
  spx: "S&P 500",
  ndx: "Nasdaq",
  dji: "道瓊",
  rut: "羅素 2000",
};

const WATCHLIST_KEY = "watchlist-v1";

function loadWatchlist(): string[] {
  try { const r = localStorage.getItem(WATCHLIST_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveWatchlist(list: string[]) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); } catch {}
}

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [indices, setIndices] = useState<Record<string, any>>({});
  const [indicesLoading, setIndicesLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<Record<string, any>>({});
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [addInput, setAddInput] = useState("");

  useEffect(() => {
    fetch("/api/market-data")
      .then(r => r.json())
      .then(d => { setIndices(d.indices ?? {}); setIndicesLoading(false); })
      .catch(() => setIndicesLoading(false));
  }, []);

  useEffect(() => { setWatchlist(loadWatchlist()); }, []);

  useEffect(() => {
    if (watchlist.length === 0) { setWatchlistQuotes({}); return; }
    setWatchlistLoading(true);
    Promise.all(
      watchlist.map(s =>
        fetch("/api/stock/" + s + "?tab=overview")
          .then(r => r.json())
          .then(d => ({ symbol: s, quote: d.quote }))
          .catch(() => ({ symbol: s, quote: null }))
      )
    ).then(results => {
      const map: Record<string, any> = {};
      results.forEach(r => { map[r.symbol] = r.quote; });
      setWatchlistQuotes(map);
      setWatchlistLoading(false);
    });
  }, [watchlist]);

  function go(symbol: string) {
    if (!symbol.trim()) return;
    router.push("/stock/" + symbol.trim().toUpperCase());
  }

  function addToWatchlist() {
    const s = addInput.trim().toUpperCase();
    if (!s || watchlist.includes(s)) { setAddInput(""); return; }
    const next = [...watchlist, s];
    setWatchlist(next); saveWatchlist(next); setAddInput("");
  }

  function removeFromWatchlist(symbol: string) {
    const next = watchlist.filter(s => s !== symbol);
    setWatchlist(next); saveWatchlist(next);
  }

  // ── 跑馬燈文字 ─────────────────────────────────────────
  const tickerText = Object.entries(INDEX_LABELS).map(([key, label]) => {
    const d = indices[key];
    if (!d) return `${label}  —`;
    const up = d.changePercent >= 0;
    const pct = Math.abs(d.changePercent).toFixed(2);
    return `${label}  ${d.price?.toLocaleString("en-US", { minimumFractionDigits: 2 })}  ${up ? "▲" : "▼"} ${pct}%`;
  }).join("     ·     ");

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui" }}>

      {/* ── 頂部跑馬燈 ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "#0d1117", borderBottom: "1px solid #1e293b",
        height: 40, overflow: "hidden", display: "flex", alignItems: "center",
      }}>
        <style>{`
          @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
          .ticker-inner { display: flex; white-space: nowrap; animation: ticker 22s linear infinite; }
          .ticker-inner:hover { animation-play-state: paused; }
          @keyframes pulse-up { 0%,100% { opacity:1; transform:translateY(0) } 50% { opacity:0.6; transform:translateY(-2px) } }
          @keyframes pulse-down { 0%,100% { opacity:1; transform:translateY(0) } 50% { opacity:0.6; transform:translateY(2px) } }
          .tick-up { animation: pulse-up 2s ease-in-out infinite; }
          .tick-down { animation: pulse-down 2s ease-in-out infinite; }
        `}</style>
        <div className="ticker-inner">
          {[0, 1].map(i => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 0, paddingRight: 60 }}>
              {Object.entries(INDEX_LABELS).map(([key, label]) => {
                const d = indices[key];
                const up = d ? d.changePercent >= 0 : null;
                return (
                  <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "0 28px", borderRight: "1px solid #1e293b" }}>
                    <span style={{ fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: 1 }}>{label}</span>
                    {indicesLoading || !d ? (
                      <span style={{ fontSize: 12, color: "#334155" }}>—</span>
                    ) : (
                      <>
                        <span className={up ? "tick-up" : "tick-down"} style={{
                          fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>
                          {d.price?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: up ? "#22c55e" : "#ef4444",
                          background: up ? "#14532d44" : "#450a0a44",
                          padding: "1px 7px", borderRadius: 4,
                        }}>
                          {up ? "▲" : "▼"} {Math.abs(d.changePercent).toFixed(2)}%
                        </span>
                      </>
                    )}
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", paddingTop: 36 }}>

        {/* ── 左側固定自選股側欄 ── */}
        <aside style={{
          width: 260, position: "fixed", top: 36, bottom: 0, left: 0,
          background: "#0d1117", borderRight: "1px solid #1e293b",
          overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12,
        }}>
          {/* 標題 */}
          <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: 1.5, paddingBottom: 8, borderBottom: "1px solid #1e293b" }}>
            ⭐ 自選股 {watchlist.length > 0 && <span style={{ color: "#64748b" }}>({watchlist.length})</span>}
          </div>

          {/* 新增輸入 */}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={addInput}
              onChange={e => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addToWatchlist()}
              placeholder="新增代號..."
              style={{
                flex: 1, background: "#1e293b", border: "1px solid #334155",
                borderRadius: 6, padding: "6px 10px", fontSize: 12,
                color: "#e2e8f0", outline: "none",
              }}
            />
            <button onClick={addToWatchlist} style={{
              background: "#334155", color: "#e2e8f0", border: "none",
              borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>+</button>
          </div>

          {/* 自選股清單 */}
          {watchlist.length === 0 ? (
            <div style={{ fontSize: 12, color: "#334155", textAlign: "center", paddingTop: 16 }}>
              輸入代號新增自選股
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {watchlist.map(s => {
                const q = watchlistQuotes[s];
                const up = q ? q.change >= 0 : null;
                return (
                  <div key={s}
                    onClick={() => go(s)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#1e293b"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    style={{
                      borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, transition: "background 0.1s",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{s}</div>
                      <div style={{ fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {watchlistLoading ? "載入中..." : q?.name ?? "—"}
                      </div>
                    </div>
                    {q && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>${q.price?.toFixed(2)}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: up ? "#22c55e" : "#ef4444" }}>
                          {up ? "▲" : "▼"}{Math.abs(q.changePercentage).toFixed(2)}%
                        </div>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); removeFromWatchlist(s); }}
                      style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* ── 右側主內容 ── */}
        <main style={{
          marginLeft: 260, flex: 1,
          padding: "48px 40px", display: "flex", flexDirection: "column",
          alignItems: "center", minHeight: "calc(100vh - 36px)",
        }}>
          {/* 標題 */}
          <div style={{ marginBottom: 8, fontSize: 12, color: "#3b82f6", fontWeight: 700, letterSpacing: 2 }}>
            股海小徒弟
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>
            即時美股查詢
          </h1>
          <p style={{ fontSize: 15, color: "#64748b", marginBottom: 36, textAlign: "center" }}>
            輸入股票代號，查看即時報價、K線圖與財報數據
          </p>

          {/* 搜尋框 */}
          <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 520, marginBottom: 40 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && go(input)}
              placeholder="輸入股票代號，例如 AAPL"
              style={{
                flex: 1, background: "#1e293b", border: "2px solid #334155",
                borderRadius: 10, padding: "14px 18px", fontSize: 16,
                color: "#e2e8f0", outline: "none",
              }}
            />
            <button onClick={() => go(input)} style={{
              background: "#3b82f6", color: "#fff", border: "none",
              borderRadius: 10, padding: "14px 24px", fontSize: 16,
              fontWeight: 700, cursor: "pointer",
            }}>查詢</button>
          </div>

          {/* 熱門股票 */}
          <div style={{ width: "100%", maxWidth: 520, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 12, fontWeight: 700, letterSpacing: 1.5 }}>熱門股票</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {POPULAR.map(s => (
                <button key={s.symbol} onClick={() => go(s.symbol)} style={{
                  background: "#1e293b", border: "1px solid #334155",
                  borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#334155"}
                  onMouseLeave={e => e.currentTarget.style.background = "#1e293b"}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{s.symbol}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{s.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 大盤位階分析入口 */}
          <div style={{ width: "100%", maxWidth: 520 }}>
            <button onClick={() => router.push("/market")} style={{
              width: "100%", background: "#1e293b", border: "1px solid #334155",
              borderRadius: 10, padding: 14, cursor: "pointer", color: "#e2e8f0",
              fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#334155"}
              onMouseLeave={e => e.currentTarget.style.background = "#1e293b"}
            >
              📊 大盤位階分析
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}