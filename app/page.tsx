"use client";
import { useState } from "react";
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

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");

  function go(symbol) {
    if (!symbol.trim()) return;
    router.push("/stock/" + symbol.trim().toUpperCase());
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      
      <div style={{ marginBottom: 12, fontSize: 13, color: "#3b82f6", fontWeight: 600, letterSpacing: 2 }}>美股中文資訊平台</div>
      <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>即時美股查詢</h1>
      <p style={{ fontSize: 16, color: "#64748b", marginBottom: 40, textAlign: "center" }}>輸入股票代號，查看即時報價、K線圖與財報數據</p>

      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 480, marginBottom: 48 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && go(input)}
          placeholder="輸入股票代號，例如 AAPL"
          style={{ flex: 1, background: "#1e293b", border: "2px solid #334155", borderRadius: 10, padding: "14px 18px", fontSize: 16, color: "#e2e8f0", outline: "none" }}
        />
        <button onClick={() => go(input)}
          style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "14px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          查詢
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 12, fontWeight: 600 }}>熱門股票</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {POPULAR.map(s => (
            <button key={s.symbol} onClick={() => go(s.symbol)}
              style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center", transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#334155"}
              onMouseLeave={e => e.currentTarget.style.background = "#1e293b"}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{s.symbol}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{s.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}