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

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [indices, setIndices] = useState<Record<string, any>>({});
  const [indicesLoading, setIndicesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market-data")
      .then(r => r.json())
      .then(d => {
        setIndices(d.indices ?? {});
        setIndicesLoading(false);
      })
      .catch(() => setIndicesLoading(false));
  }, []);

  function go(symbol: string) {
    if (!symbol.trim()) return;
    router.push("/stock/" + symbol.trim().toUpperCase());
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", color: "#e2e8f0",
      fontFamily: "system-ui", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: "#3b82f6", fontWeight: 600, letterSpacing: 2 }}>
        股海小徒弟
      </div>
      <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>
        即時美股查詢
      </h1>
      <p style={{ fontSize: 16, color: "#64748b", marginBottom: 32, textAlign: "center" }}>
        輸入股票代號，查看即時報價、K線圖與財報數據
      </p>

      {/* 三大指數 + 羅素2000 */}
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {Object.entries(INDEX_LABELS).map(([key, label]) => {
            const d = indices[key];
            const up = d ? d.changePercent >= 0 : null;
            return (
              <div key={key} style={{
                background: "#1e293b", borderRadius: 10, padding: "12px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4, fontWeight: 600 }}>
                  {label}
                </div>
                {indicesLoading ? (
                  <div style={{ fontSize: 13, color: "#334155" }}>—</div>
                ) : d ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>
                      {d.price?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: up ? "#22c55e" : "#ef4444" }}>
                      {up ? "▲" : "▼"} {Math.abs(d.changePercent).toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#475569" }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 搜尋框 */}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 560, marginBottom: 28 }}>
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
        }}>
          查詢
        </button>
      </div>

      {/* 熱門股票 */}
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 12, fontWeight: 600 }}>熱門股票</div>
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
      <div style={{ width: "100%", maxWidth: 560 }}>
        <button onClick={() => router.push("/market")} style={{
          width: "100%", background: "#1e293b", border: "1px solid #334155",
          borderRadius: 10, padding: "14px", cursor: "pointer", color: "#e2e8f0",
          fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8,
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#334155"}
          onMouseLeave={e => e.currentTarget.style.background = "#1e293b"}
        >
          📊 大盤位階分析
        </button>
      </div>
    </div>
  );
}