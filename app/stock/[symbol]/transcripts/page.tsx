"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface TranscriptDate {
  symbol: string;
  year: number;
  quarter: number;
  date: string;
}

export default function TranscriptsPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();

  const [dates, setDates] = useState<TranscriptDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);

  const [selected, setSelected] = useState<TranscriptDate | null>(null);
  const [originalText, setOriginalText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [view, setView] = useState<"original" | "translated" | "both">("both");

  // 載入可用逐字稿列表
  useEffect(() => {
    setLoadingDates(true);
    fetch(`/api/transcript?symbol=${symbol}`)
      .then(r => r.json())
      .then(d => {
        // FMP 回傳陣列或包在物件內
        const list = Array.isArray(d) ? d : (d.transcripts ?? []);
        setDates(list.slice(0, 12)); // 最近 12 季
        setLoadingDates(false);
      })
      .catch(() => setLoadingDates(false));
  }, [symbol]);

  // 選擇某一季，取得逐字稿
  async function selectQuarter(item: TranscriptDate) {
    setSelected(item);
    setOriginalText("");
    setTranslatedText("");
    setIsTruncated(false);
    setLoadingTranscript(true);

    try {
      const res = await fetch(`/api/transcript?symbol=${symbol}&year=${item.year}&quarter=${item.quarter}`);
      const data = await res.json();
      // FMP 回傳格式：陣列，第一筆的 content 欄位
      const content = Array.isArray(data) ? data[0]?.content : data?.content;
      setOriginalText(content || "無法取得逐字稿內容");
    } catch {
      setOriginalText("逐字稿載入失敗");
    }
    setLoadingTranscript(false);
  }

  // 呼叫翻譯 API
  async function translate() {
    if (!originalText || !selected) return;
    setTranslating(true);
    setTranslatedText("");

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: originalText,
          symbol,
          year: selected.year,
          quarter: selected.quarter,
        }),
      });
      const data = await res.json();
      setTranslatedText(data.translated || data.error || "翻譯失敗");
      setIsTruncated(data.isTruncated ?? false);
    } catch {
      setTranslatedText("翻譯失敗，請稍後再試");
    }
    setTranslating(false);
  }

  const s = {
    page: { minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: 24 },
    header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
    back: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 16px", color: "#94a3b8", cursor: "pointer", fontSize: 14 },
    title: { fontSize: 24, fontWeight: 800 },
    layout: { display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, alignItems: "start" },
    sidebar: { background: "#1e293b", borderRadius: 12, padding: 16 },
    sideTitle: { fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12, letterSpacing: 1 },
    quarterBtn: (active: boolean) => ({
      display: "block", width: "100%", textAlign: "left" as const,
      background: active ? "#334155" : "none",
      border: "none", borderRadius: 8, padding: "10px 12px",
      color: active ? "#e2e8f0" : "#94a3b8", cursor: "pointer", fontSize: 13, marginBottom: 4,
    }),
    main: { background: "#1e293b", borderRadius: 12, padding: 20 },
    toolbar: { display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" as const },
    viewBtn: (active: boolean) => ({
      background: active ? "#3b82f6" : "#0f172a",
      border: `1px solid ${active ? "#3b82f6" : "#334155"}`,
      borderRadius: 8, padding: "6px 14px", color: active ? "#fff" : "#94a3b8",
      cursor: "pointer", fontSize: 13,
    }),
    translateBtn: {
      background: "#7c3aed", color: "#fff", border: "none",
      borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    },
    textBox: { background: "#0f172a", borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.9, color: "#cbd5e1", whiteSpace: "pre-wrap" as const, maxHeight: "65vh", overflowY: "auto" as const },
    columns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    colTitle: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, letterSpacing: 1 },
    empty: { color: "#475569", textAlign: "center" as const, padding: "60px 0", fontSize: 14 },
    badge: { background: "#f59e0b22", color: "#f59e0b", fontSize: 11, padding: "2px 8px", borderRadius: 4 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => router.push(`/stock/${symbol}`)}>← 返回</button>
        <div style={s.title}>{symbol} 財報電話會議逐字稿</div>
      </div>

      <div style={s.layout}>
        {/* 側邊欄：季度列表 */}
        <div style={s.sidebar}>
          <div style={s.sideTitle}>選擇季度</div>
          {loadingDates && <div style={{ color: "#64748b", fontSize: 13 }}>載入中...</div>}
          {!loadingDates && dates.length === 0 && (
            <div style={{ color: "#64748b", fontSize: 13 }}>無可用逐字稿</div>
          )}
          {dates.map(item => (
            <button
              key={`${item.year}-Q${item.quarter}`}
              style={s.quarterBtn(selected?.year === item.year && selected?.quarter === item.quarter)}
              onClick={() => selectQuarter(item)}
            >
              {item.year} Q{item.quarter}
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{item.date?.slice(0, 10)}</div>
            </button>
          ))}
        </div>

        {/* 主內容區 */}
        <div style={s.main}>
          {!selected && (
            <div style={s.empty}>← 請從左側選擇一個季度</div>
          )}

          {selected && (
            <>
              <div style={s.toolbar}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {selected.year} Q{selected.quarter} 電話會議
                </span>
                {isTruncated && <span style={s.badge}>節錄前 6000 字</span>}
                <div style={{ flex: 1 }} />
                {/* 翻譯按鈕 */}
                {originalText && !translating && (
                  <button style={s.translateBtn} onClick={translate}>
                    {translatedText ? "重新翻譯" : "🌐 AI 英翻中"}
                  </button>
                )}
                {translating && <span style={{ color: "#a78bfa", fontSize: 13 }}>翻譯中...</span>}
                {/* 檢視切換 */}
                {translatedText && (
                  <>
                    {(["both", "original", "translated"] as const).map(v => (
                      <button key={v} style={s.viewBtn(view === v)} onClick={() => setView(v)}>
                        {{ both: "雙欄對照", original: "英文原文", translated: "中文翻譯" }[v]}
                      </button>
                    ))}
                  </>
                )}
              </div>

              {loadingTranscript && (
                <div style={{ color: "#64748b", textAlign: "center", padding: "40px 0" }}>載入逐字稿中...</div>
              )}

              {!loadingTranscript && originalText && (
                <>
                  {/* 雙欄對照 */}
                  {view === "both" && translatedText && (
                    <div style={s.columns}>
                      <div>
                        <div style={s.colTitle}>英文原文</div>
                        <div style={s.textBox}>{originalText}</div>
                      </div>
                      <div>
                        <div style={s.colTitle}>繁體中文翻譯</div>
                        <div style={s.textBox}>{translatedText}</div>
                      </div>
                    </div>
                  )}
                  {/* 只看英文 */}
                  {(view === "original" || !translatedText) && (
                    <div>
                      <div style={s.colTitle}>英文原文</div>
                      <div style={s.textBox}>{originalText}</div>
                    </div>
                  )}
                  {/* 只看中文 */}
                  {view === "translated" && translatedText && (
                    <div>
                      <div style={s.colTitle}>繁體中文翻譯</div>
                      <div style={s.textBox}>{translatedText}</div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}