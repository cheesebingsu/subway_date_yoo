import type { Metadata } from "next";
import { MobileLayout } from "@/components/layout/MobileLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "설레철 (Seullecheol)",
  description: "따뜻하고 감성적인 지하철 데이트 길잡이",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <MobileLayout>{children}</MobileLayout>
      </body>
    </html>
  );
}
