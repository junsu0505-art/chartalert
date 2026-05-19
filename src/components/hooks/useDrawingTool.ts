/**
 * useDrawingTool.ts — chart.subscribeClick 기반 마우스 드로잉 훅
 *
 * UP-15: useEffect 반환 cleanup 에서 unsubscribeClick + firstAnchorRef 초기화
 * UP-16: secret 0
 *
 * lightweight-charts v5 의 chart.subscribeClick 는
 * DrawingManager 가 마우스 input 을 자동 수신하지 않으므로
 * 직접 subscribeClick → 좌표 캡처 → manager.addDrawing 경유로 구현.
 */

import { useEffect, useRef } from 'react'
import type { IChartApi, ISeriesApi, MouseEventParams, UTCTimestamp } from 'lightweight-charts'
import { TrendLine, HorizontalLine, type DrawingManager } from 'lightweight-charts-drawing'
import type { TrendlinePoint } from '../../types.js'

export type DrawingTool = 'cursor' | 'trendline' | 'horizontal' | 'delete'

interface UseDrawingToolOpts {
  chart: IChartApi | null
  series: ISeriesApi<'Candlestick'> | null
  manager: DrawingManager | null
  tool: DrawingTool
  onTrendlineDrawn?: (p1: TrendlinePoint, p2: TrendlinePoint) => void
  onHorizontalDrawn?: (price: number) => void
}

export function useDrawingTool(opts: UseDrawingToolOpts): void {
  const firstAnchorRef = useRef<TrendlinePoint | null>(null)
  const drawingIdCounterRef = useRef(0)

  useEffect(() => {
    const { chart, series, manager, tool } = opts

    // cursor / delete 모드: click 핸들러 불필요, anchor 초기화
    if (!chart || !series || !manager) return
    if (tool === 'cursor' || tool === 'delete') {
      firstAnchorRef.current = null
      return
    }

    const handler = (param: MouseEventParams) => {
      if (!param.point) return

      const price = series.coordinateToPrice(param.point.y)
      if (price === null) return

      // param.time: UTCTimestamp (number) | BusinessDay (object) | string | undefined
      // 빈 공간 click 시 undefined 가능 → 현재 Unix 시각 fallback
      const timeSec: number =
        param.time == null
          ? Math.floor(Date.now() / 1000)
          : typeof param.time === 'number'
            ? param.time
            : Math.floor(new Date(String(param.time)).getTime() / 1000)

      if (tool === 'horizontal') {
        // 1 click → HorizontalLine 즉시 생성
        const id = `h-${++drawingIdCounterRef.current}-${Date.now()}`
        const line = new HorizontalLine(
          id,
          [{ time: timeSec as UTCTimestamp, price }],
          { lineColor: '#26a69a', lineWidth: 1 },
        )
        manager.addDrawing(line)
        opts.onHorizontalDrawn?.(price)
        return
      }

      if (tool === 'trendline') {
        if (firstAnchorRef.current === null) {
          // anchor 1 기록
          firstAnchorRef.current = { time: timeSec, price }
          return
        }
        // anchor 2 도착 → TrendLine 완성
        const p1 = firstAnchorRef.current
        const p2: TrendlinePoint = { time: timeSec, price }
        firstAnchorRef.current = null

        // p1.time === p2.time 이면 같은 캔들 위 click → time 을 +1s 로 분리
        const t1 = p1.time as UTCTimestamp
        const t2 = (p2.time === p1.time ? p2.time + 1 : p2.time) as UTCTimestamp

        const id = `t-${++drawingIdCounterRef.current}-${Date.now()}`
        try {
          const line = new TrendLine(
            id,
            [
              { time: t1, price: p1.price },
              { time: t2, price: p2.price },
            ],
            { lineColor: '#2962FF', lineWidth: 2 },
          )
          manager.addDrawing(line)
          opts.onTrendlineDrawn?.(p1, p2)
        } catch (err) {
          // drawing lib 에러 (중복 time 등) 는 무시 — UX 에서 재시도
          console.warn('[useDrawingTool] TrendLine addDrawing failed', err)
        }
        return
      }
    }

    chart.subscribeClick(handler)

    // UP-15: cleanup — unsubscribeClick + anchor 초기화
    return () => {
      chart.unsubscribeClick(handler)
      firstAnchorRef.current = null
    }
  // opts 객체 레퍼런스 교체 대신 개별 deps 명시
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.chart, opts.series, opts.manager, opts.tool])
}

// Re-export for barrel import convenience
export type { TrendlinePoint }
