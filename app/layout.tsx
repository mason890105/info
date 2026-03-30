import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "股海小徒弟",
  description: "即時美股查詢、K線圖、技術分析、財報解讀",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "股海小徒弟",
    description: "即時美股查詢、K線圖、技術分析、財報解讀",
    siteName: "股海小徒弟",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}