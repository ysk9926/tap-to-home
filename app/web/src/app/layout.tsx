import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Tap to Home",
  description: "버튼을 누를수록 내 졸라맨이 먼저 퇴근하는 정신적 탈출 레이스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 웹뷰에서 연타 시 핀치줌/더블탭줌이 튀지 않도록
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
