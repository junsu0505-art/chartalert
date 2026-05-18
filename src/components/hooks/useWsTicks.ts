/**
 * useWsTicks.ts — WebSocket 실시간 tick React hook
 *
 * UP-15: useEffect cleanup 의무 — ws.close() on unmount
 * UP-16: secret 0 — props 로 symbol/exchange 받음, env var 없음
 * UP-14: R6 page.tsx 가 동일 hook 재사용 가능한 독립 hook
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { BinanceWsClient } from '../../data/binance-ws.js'
import { OkxWsClient } from '../../data/okx-ws.js'
import type { Exchange, TickEvent } from '../../types.js'

export interface UseWsTicksResult {
  lastTick: TickEvent | null
  isConnected: boolean
}

/**
 * symbol과 exchange 로 실시간 tick 을 구독한다.
 * 컴포넌트 unmount 시 WS 연결을 close 한다 (UP-15).
 *
 * @param symbol  e.g. 'BTCUSDT'
 * @param exchange 'binance' | 'okx'
 */
export function useWsTicks(symbol: string, exchange: Exchange): UseWsTicksResult {
  const [lastTick, setLastTick] = useState<TickEvent | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // client ref — 리렌더링 시 재생성 방지
  const clientRef = useRef<BinanceWsClient | OkxWsClient | null>(null)
  // polling interval ref for isConnected sync
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!symbol) return

    // 이전 client cleanup
    if (clientRef.current) {
      clientRef.current.close()
      clientRef.current = null
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    setLastTick(null)
    setIsConnected(false)

    const handler = (tick: TickEvent) => {
      setLastTick(tick)
    }

    let client: BinanceWsClient | OkxWsClient

    if (exchange === 'binance') {
      client = new BinanceWsClient()
      client.subscribe(symbol, handler)
    } else {
      client = new OkxWsClient()
      // OKX instId: 'BTCUSDT' → 'BTC-USDT'
      const instId = toOkxInstId(symbol)
      client.subscribe(instId, handler)
    }

    clientRef.current = client

    // isConnected polling (100ms interval — WebSocket onopen 직후 반영)
    pollRef.current = setInterval(() => {
      setIsConnected(clientRef.current?.isConnected ?? false)
    }, 100)

    // UP-15: unmount cleanup
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      client.close()
      clientRef.current = null
      setIsConnected(false)
    }
  }, [symbol, exchange])

  return { lastTick, isConnected }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function toOkxInstId(symbol: string): string {
  if (symbol.includes('-')) return symbol.toUpperCase()
  const upper = symbol.toUpperCase()
  for (const quote of ['USDT', 'USDC', 'BTC', 'ETH', 'BNB']) {
    if (upper.endsWith(quote)) {
      const base = upper.slice(0, upper.length - quote.length)
      return `${base}-${quote}`
    }
  }
  return upper
}
