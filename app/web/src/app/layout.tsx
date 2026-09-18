import type { Metadata, Viewport } from "next";
import { Gaegu, Nanum_Pen_Script } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SketchDefs } from "@/components/sketch-defs";

// 제목·본문·버튼. 뭉툭한 매직 글씨 느낌
const gaegu = Gaegu({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gaegu",
  display: "swap",
});

// 말풍선·메모·힌트. 얇은 펜 글씨
const nanumPen = Nanum_Pen_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-nanum-pen",
  display: "swap",
});

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
    <html
      lang="ko"
      className={`h-full antialiased ${gaegu.variable} ${nanumPen.variable}`}
    >
      <body className="min-h-full flex flex-col bg-paper">
        <SketchDefs />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
