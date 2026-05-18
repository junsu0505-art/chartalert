import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'chartalert — 라이브 차트 알람',
  description: '추세선·가격선·RSI·EMA·MACD 알람을 Telegram / Discord 로 실시간 수신',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
