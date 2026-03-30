"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ── 位階判斷 ──────────────────────────────────────────────
function stageOf(key: string, val: number): string {
  const rules: Record<string, (v: number) => string> = {
    vix:  v => v < 15 ? "低波動" : v < 20 ? "正常" : v < 30 ? "恐慌" : "極端恐慌",
    vvix: v => v < 90 ? "低" : v < 110 ? "正常" : v < 130 ? "高度警戒" : "極端警戒",
    skew: v => v < 120 ? "低尾風險" : v < 130 ? "中性" : v < 145 ? "中高風險" : "高尾風險",
    fg:   v => v <= 25 ? "極度恐慌" : v <= 45 ? "恐慌" : v <= 55 ? "中性" : v <= 75 ? "貪婪" : "極度貪婪",
    rsi:  v => v < 30 ? "超賣" : v < 40 ? "偏弱" : v < 60 ? "中性" : v < 70 ? "偏強" : "超買",
    mfi:  v => v < 20 ? "超賣" : v < 40 ? "偏弱" : v < 60 ? "中性" : v < 80 ? "偏強" : "超買",
    dxy:  v => v < 95 ? "弱勢" : v < 100 ? "中性偏弱" : v < 105 ? "中性偏強" : "強勢",
    t10y: v => v < 3.5 ? "寬鬆" : v < 4.5 ? "偏高" : "極高緊縮",
    gold: v => v < -1 ? "下跌" : v < 0.5 ? "平穩" : v < 2 ? "上漲避險" : "急漲避險",
    oil:  v => v < -2 ? "急跌通縮" : v < 1 ? "平穩" : v < 3 ? "上漲通膨" : "急漲通膨",
  };
  return rules[key]?.(val) ?? "";
}

function stageColor(label: string): string {
  if (!label) return "#475569";
  if (/超賣|極度恐慌|寬鬆|低波動|弱勢/.test(label)) return "#22c55e";
  if (/恐慌|警戒|高風險|緊縮|通膨|急漲/.test(label)) return "#f59e0b";
  if (/超買|貪婪|強勢/.test(label)) return "#ef4444";
  return "#64748b";
}

// 綜合評分
function overallScore(d: any): { score: number; stage: string; color: string } {
  const pts: number[] = [];
  const v = (k: string) => d[k]?.value;
  if (v("vix") != null) pts.push(Math.max(0, Math.min(100, 100 - (v("vix") - 10) * 3)));
  if (v("fg")  != null) pts.push(v("fg"));
  if (v("rsi") != null) pts.push(v("rsi"));
  if (v("mfi") != null) pts.push(v("mfi"));
  if (!pts.length) return { score: 50, stage: "數據不足", color: "#64748b" };
  const score = pts.reduce((a, b) => a + b, 0) / pts.length;
  if (score <= 20) return { score, stage: "極度低估 · 底部區間", color: "#22c55e" };
  if (score <= 35) return { score, stage: "偏低位階",            color: "#4ade80" };
  if (score <= 50) return { score, stage: "合理偏低",            color: "#94a3b8" };
  if (score <= 65) return { score, stage: "合理偏高",            color: "#f59e0b" };
  if (score <= 80) return { score, stage: "偏高位階",            color: "#f97316" };
  return             { score, stage: "極度高估 · 頂部區間", color: "#ef4444" };
}

// ── 卡片設定 ──────────────────────────────────────────────
function chg(c: number | null | undefined): string {
  if (c == null) return "";
  return (c >= 0 ? "+" : "") + c.toFixed(2) + "%";
}
function chgColor(c: number | null | undefined): string {
  if (c == null) return "#64748b";
  return c >= 0 ? "#22c55e" : "#ef4444";
}

const CARDS = [
  { key: "vix",  label: "VIX",           fmt: (d: any) => d?.value?.toFixed(2),         sub: (d: any) => chg(d?.change) },
  { key: "vvix", label: "VVIX",          fmt: (d: any) => d?.value?.toFixed(2),         sub: (d: any) => chg(d?.change) },
  { key: "skew", label: "SKEW",          fmt: (d: any) => d?.value?.toFixed(2),         sub: (d: any) => chg(d?.change) },
  { key: "fg",   label: "Fear & Greed",  fmt: (d: any) => d?.value,                    sub: (d: any) => d?.label ?? "" },
  { key: "rsi",  label: "SPY RSI",       fmt: (d: any) => d?.value?.toFixed(1),         sub: () => "14日" },
  { key: "mfi",  label: "SPY MFI",       fmt: (d: any) => d?.value?.toFixed(1),         sub: () => "14日" },
  { key: "dxy",  label: "美元指數",       fmt: (d: any) => d?.value?.toFixed(3),         sub: (d: any) => chg(d?.change) },
  { key: "t10y", label: "美債 10Y",       fmt: (d: any) => d?.value?.toFixed(3) + "%",  sub: (d: any) => chg(d?.change) },
  { key: "gold", label: "黃金",           fmt: (d: any) => d?.value?.toFixed(2),         sub: (d: any) => chg(d?.change) },
  { key: "oil",  label: "原油 WTI",       fmt: (d: any) => d?.value?.toFixed(2),         sub: (d: any) => chg(d?.change) },
];

// ── 主頁面 ────────────────────────────────────────────────
export default function MarketPage() {
  const router = useRouter();
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [aiText, setAiText]     = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone]     = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    fetch("/api/market-data")
      .then(r => r.json())
      .then(d => {
        setData(d);
        setUpdatedAt(d.updatedAt ? new Date(d.updatedAt).toLocaleTimeString("zh-TW") : "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function runAI() {
    if (!data) return;
    setAiLoading(true); setAiText(""); setAiDone(false);

    const lines = CARDS.map(c => {
      const val = data[c.key]?.value;
      if (val == null) return null;
      const stage = stageOf(c.key, parseFloat(val));
      return `${c.label}: ${c.fmt(data[c.key])} (${stage})`;
    }).filter(Boolean).join("\n");

    const ov = overallScore(data);

    const prompt = `你是頂尖的美股市場分析師，請根據以下即時市場指標，用繁體中文提供深度大盤分析。

━━ 即時指標 ━━
${lines}

━━ 綜合位階 ━━
${ov.stage}（評分 ${ov.score.toFixed(0)}/100，0=極度熊市，100=極度牛市）

請提供以下四個面向：

【一、市場位階判斷】
根據所有指標綜合評估目前大盤位階，給出明確判斷與理由（3-4句）

【二、風險訊號解讀】
目前最值得警惕的風險訊號，是否出現歷史上重要底部或頂部特徵（3-4句）

【三、整體市場圖像】
用敘事方式解讀這些指標呈現的整體市場狀態，不要逐一列出（3-4句）

【四、操作參考方向】
保守型、平衡型、積極型投資者各自的操作參考（各1-2句）

語言要求：繁體中文，專業客觀，避免過度樂觀或悲觀。`;

    try {
      const res = await fetch("/api/ai-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      setAiText(json.analysis || json.error || "無法取得分析結果");
    } catch {
      setAiText("AI 分析失敗，請稍後再試");
    }
    setAiLoading(false); setAiDone(true);
  }

  const ov = data ? overallScore(data) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui", padding: 24 }}>
      <button onClick={() => router.push("/")}
        style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 20, display: "block" }}>
        ← 返回首頁
      </button>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>大盤位階分析</div>
        {updatedAt && <div style={{ fontSize: 12, color: "#475569" }}>更新於 {updatedAt}</div>}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        即時指標自動載入 · AI 綜合判斷市場位階
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>載入中...</div>
      ) : !data || data.error ? (
        <div style={{ color: "#ef4444" }}>資料載入失敗，請稍後再試</div>
      ) : (
        <>
          {/* 指標卡片 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            {CARDS.map(c => {
              const d = data[c.key];
              const val = d?.value;
              const stage = val != null ? stageOf(c.key, parseFloat(val)) : "";
              const color = stageColor(stage);
              const displayed = c.fmt(d);
              return (
                <div key={c.key} style={{ background: "#1e293b", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 6, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>
                    {displayed ?? <span style={{ color: "#475569", fontSize: 14 }}>—</span>}
                  </div>
                  <div style={{ fontSize: 12, color: chgColor(d?.change) }}>{c.sub(d)}</div>
                  {stage && (
                    <div style={{ marginTop: 6, display: "inline-block", fontSize: 11, fontWeight: 600, color, background: color + "22", borderRadius: 4, padding: "2px 8px" }}>
                      {stage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 綜合位階 */}
          {ov && (
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 24, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>綜合位階評估</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ov.color }}>{ov.stage}</div>
              </div>
              <div style={{ flex: 1, minWidth: 180, maxWidth: 240 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 5 }}>
                  <span>極度低估</span><span>極度高估</span>
                </div>
                <div style={{ height: 8, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${ov.score}%`, background: ov.color, borderRadius: 4, transition: "width .5s" }} />
                </div>
                <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  評分 {ov.score.toFixed(0)} / 100
                </div>
              </div>
            </div>
          )}

          {/* AI 分析 */}
          {!aiDone && (
            <button
              onClick={runAI}
              disabled={aiLoading}
              style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: aiLoading ? 0.7 : 1 }}>
              {aiLoading ? "AI 分析中..." : "🔍 AI 深度分析"}
            </button>
          )}
          {aiLoading && (
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 12 }}>
              Claude 正在解讀市場數據，請稍候...
            </div>
          )}
          {aiText && (
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 20, fontSize: 14, lineHeight: 1.85, color: "#cbd5e1", whiteSpace: "pre-wrap", marginTop: 16 }}>
              {aiText}
            </div>
          )}
          {aiDone && (
            <button
              onClick={() => { setAiDone(false); setAiText(""); }}
              style={{ background: "#334155", color: "#e2e8f0", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 12 }}>
              重新分析
            </button>
          )}
        </>
      )}
    </div>
  );
}