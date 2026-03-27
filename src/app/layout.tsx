import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });  // フォント読み込み

export const metadata: Metadata = {
  title: "FLOW YOTEI — シンプルな日程調整",
  description: "URLを共有するだけ。みんなの都合をリアルタイムで確認できる日程調整ツール。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={inter.className}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
