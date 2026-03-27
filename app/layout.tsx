import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "美股小徒弟",
  description: "即時美股查詢、K線圖、財報分析",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}