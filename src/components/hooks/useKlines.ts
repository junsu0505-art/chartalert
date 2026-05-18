/**
 * useKlines.ts — REST 봉 데이터 fetch React hook
 *
 * SWR-like 60s revalidate: 60초마다 자동 재조회
 * UP-14: R6 page.tsx 가 동일 hook 재사용 가능한 독립 hook
 * UP-15: useEffect cleanup — interval clear on unmount/dep change
 * UP-16: secret 0
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchKlines } from '../../data/klines.js'
import type { Candle } from '../../data/types.js'
import type { Exchange, Timeframe } from '../../types.js'

const REVALIDATE_MS = 60_000

export interface UseKlinesResult {
  candles: Candle[]
  loading: boolean
  error: string | null
}

/**
 * symbol/exchange/tf 의 봉 데이터를 fetch 하고 60초마다 재조회한다.
 *
 * @param symbol    e.g. 'BTCUSDT'
 * @param exchange  'binance' | 'okx'
 * @param tf        Timeframe
 * @param limit     봉 개수 (default 500)
 */
export function useKlines(
  symbol: string,
  exchange: Exchange,
  tf: Timeframe,
  limit = 500,
): UseKlinesResult {
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // abort controller ref — in-flight request cancel on dep change
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!symbol) return

    // cleanup previous interval / abort
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null

    setLoading(true)
    setError(null)

    let cancelled = false

    const load = async () => {
      try {
        const data = await fetchKlines(exchange, symbol, tf, limit)
        if (!cancelled) {
          setCandles(data)
          setLoading(false)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

    // 즉시 1회 로드
    void load()

    // 60초 revalidate
    intervalRef.current = setInterval(() => {
      void load()
    }, REVALIDATE_MS)

    // cleanup
    return () => {
      cancelled = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [symbol, exchange, tf, limit])

  return { candles, loading, error }
}
