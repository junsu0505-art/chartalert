/**
 * Chart.tsx — lightweight-charts CandlestickSeries + WS tick + drawing plugin
 *
 * 구현 내용:
 *  1. createChart() 다크 테마 초기화
 *  2. useKlines 로 초기 봉 fetch + setData
 *  3. useWsTicks 로 실시간 tick → last candle 업데이트
 *  4. DrawingManager (deepentropy/lightweight-charts-drawing) attach
 *     — 추세선/수평선 그리기 후 좌표 콜백 발동
 *  5. indicators props 변경 시 LineSeries 추가/제거 (RSI/EMA/MACD)
 *
 * UP-15: useEffect cleanup — chart.remove() + drawingManager.detach() + ws cleanup (hook 내부)
 * UP-16: secret 0 — env var 없음, props 로만 받음
 * UP-14: useWsTicks / useKlines 는 재사용 가능한 독립 hook
 * drawing plugin: deepentropy/lightweight-charts-drawing@0.1.1 (MIT) 채택
 *   — TrendLine, HorizontalLine 지원, DrawingManager.on('drawing:added') 콜백 인터페이스 완비
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type UTCTimestamp,
} from '../lib/charts/index.js'
import {
  DrawingManager,
} from 'lightweight-charts-drawing'
import { useWsTicks } from './hooks/useWsTicks.js'
import { useKlines } from './hooks/useKlines.js'
import { useDrawingTool } from './hooks/useDrawingTool.js'
import type { DrawingTool } from './hooks/useDrawingTool.js'
import { calcRSI, calcEMA, calcMACD } from '../lib/indicators/index.js'
import type { Exchange, Timeframe, TrendlinePoint } from '../types.js'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChartProps {
  symbol: string
  exchange: Exchange
  timeframe: Timeframe
  currentTool: DrawingTool
  onTrendlineDrawn?: (p1: TrendlinePoint, p2: TrendlinePoint) => void
  onHorizontalDrawn?: (price: number) => void
  indicators?: {
    rsi?: { period: number }
    ema?: { fast: number; slow: number }
    macd?: { fast: number; slow: number; signal: number }
  }
}

export type { DrawingTool }

// ---------------------------------------------------------------------------
// Dark theme palette
// ---------------------------------------------------------------------------

const DARK_BG = '#0d0f14'
const DARK_GRID = '#1a1d27'
const DARK_TEXT = '#9ba3af'
const CANDLE_UP = '#26a69a'
const CANDLE_DOWN = '#ef5350'
const LINE_RSI = '#c084fc'
const LINE_EMA_FAST = '#60a5fa'
const LINE_EMA_SLOW = '#f97316'
const LINE_MACD = '#4ade80'
const LINE_MACD_SIGNAL = '#f472b6'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Chart({
  symbol,
  exchange,
  timeframe,
  currentTool,
  onTrendlineDrawn,
  onHorizontalDrawn,
  indicators,
}: ChartProps) {
  // ── container ref
  const containerRef = useRef<HTMLDivElement>(null)

  // ── chart / series / manager refs (no re-render needed for indicators/ticks)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const managerRef = useRef<DrawingManager | null>(null)

  // ── drawing-ready state: chart/series/manager 가 mount 후 세팅되면 trigger
  // useDrawingTool 은 이 state 변화로 re-run 됨 (refs 는 useEffect deps 로 동작 X)
  const [drawingReady, setDrawingReady] = useState<{
    chart: IChartApi
    series: ISeriesApi<'Candlestick'>
    manager: DrawingManager
  } | null>(null)
  const indicatorSeriesRef = useRef<{
    rsi?: ISeriesApi<'Line'>
    emaFast?: ISeriesApi<'Line'>
    emaSlow?: ISeriesApi<'Line'>
    macd?: ISeriesApi<'Line'>
    macdSignal?: ISeriesApi<'Line'>
  }>({})

  // ── data hooks
  const { candles, loading } = useKlines(symbol, exchange, timeframe)
  const { lastTick } = useWsTicks(symbol, exchange)

  // ── 1. chart 초기화 (mount once)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: DARK_BG },
        textColor: DARK_TEXT,
      },
      grid: {
        vertLines: { color: DARK_GRID },
        horzLines: { color: DARK_GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: DARK_GRID,
      },
      timeScale: {
        borderColor: DARK_GRID,
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: container.clientHeight || 500,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CANDLE_UP,
      downColor: CANDLE_DOWN,
      borderUpColor: CANDLE_UP,
      borderDownColor: CANDLE_DOWN,
      wickUpColor: CANDLE_UP,
      wickDownColor: CANDLE_DOWN,
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    // DrawingManager attach
    const manager = new DrawingManager()
    manager.attach(chart, candleSeries, container)
    managerRef.current = manager

    // useDrawingTool deps trigger: chart/series/manager 준비 완료 신호
    setDrawingReady({ chart, series: candleSeries, manager })

    // NOTE: drawing:added 콜백 제거 — useDrawingTool hook 의 subscribeClick 가
    // 직접 addDrawing 후 onTrendlineDrawn/onHorizontalDrawn 콜백을 발동하므로 중복 X

    // ResizeObserver — 컨테이너 크기 변경 시 차트 리사이즈
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      chart.applyOptions({ width, height: height || 500 })
    })
    ro.observe(container)

    // UP-15 cleanup
    return () => {
      setDrawingReady(null)
      ro.disconnect()
      manager.detach()
      managerRef.current = null
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      indicatorSeriesRef.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount once — symbol/exchange/timeframe 변경 시 data hook 이 재조회

  // ── 2. 초기 봉 데이터 로드
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series || loading || candles.length === 0) return

    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    series.setData(data)

    // indicators 재계산 (데이터 갱신 시)
    updateIndicators(candles.map((c) => ({ time: c.time, close: c.close })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, loading])

  // ── 3. WS tick → last candle 업데이트
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series || !lastTick) return

    // last candle update: close 변경 (open/high/low 는 현재 봉 기준 보존)
    // lightweight-charts update(): 동일 time이면 해당 봉 업데이트
    const currentTime = Math.floor(lastTick.ts / candleIntervalSeconds(timeframe)) * candleIntervalSeconds(timeframe)
    series.update({
      time: currentTime as UTCTimestamp,
      open: lastTick.price,
      high: lastTick.price,
      low: lastTick.price,
      close: lastTick.price,
    })
  }, [lastTick, timeframe])

  // ── 4. indicators props 변경 시 LineSeries 추가/제거
  useEffect(() => {
    if (candles.length === 0) return
    updateIndicators(candles.map((c) => ({ time: c.time, close: c.close })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators])

  // ── 5. 마우스 드로잉 도구 — subscribeClick 기반 (UP-15: cleanup 은 hook 내부)
  // drawingReady state 를 deps 로 사용 — ref.current 는 useEffect deps 로 동작 X
  useDrawingTool({
    chart: drawingReady?.chart ?? null,
    series: drawingReady?.series ?? null,
    manager: drawingReady?.manager ?? null,
    tool: currentTool,
    onTrendlineDrawn,
    onHorizontalDrawn,
  })

  // ---------------------------------------------------------------------------
  // indicators helper (chart 내부 상태 직접 참조)
  // ---------------------------------------------------------------------------

  function updateIndicators(closes: { time: number; close: number }[]) {
    const chart = chartRef.current
    if (!chart) return

    const prices = closes.map((c) => c.close)
    const times = closes.map((c) => c.time)
    const refs = indicatorSeriesRef.current

    // RSI
    if (indicators?.rsi) {
      if (!refs.rsi) {
        refs.rsi = chart.addSeries(LineSeries, { color: LINE_RSI, lineWidth: 1, title: 'RSI', priceScaleId: 'rsi' })
        chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      }
      const { values } = calcRSI({ closes: prices, period: indicators.rsi.period })
      const offset = times.length - values.length
      const lastTime = times[times.length - 1] ?? 0
      const rsiSeries = refs.rsi
      rsiSeries.setData(
        values.map((v, i) => ({ time: (times[i + offset] ?? lastTime) as UTCTimestamp, value: v })),
      )
    } else if (refs.rsi) {
      chart.removeSeries(refs.rsi)
      delete refs.rsi
    }

    // EMA fast + slow
    if (indicators?.ema) {
      if (!refs.emaFast) {
        refs.emaFast = chart.addSeries(LineSeries, { color: LINE_EMA_FAST, lineWidth: 1, title: `EMA${indicators.ema.fast}` })
      }
      if (!refs.emaSlow) {
        refs.emaSlow = chart.addSeries(LineSeries, { color: LINE_EMA_SLOW, lineWidth: 1, title: `EMA${indicators.ema.slow}` })
      }
      const fast = calcEMA({ closes: prices, period: indicators.ema.fast })
      const slow = calcEMA({ closes: prices, period: indicators.ema.slow })
      const fOffset = times.length - fast.values.length
      const sOffset = times.length - slow.values.length
      const lastTime2 = times[times.length - 1] ?? 0
      const emaFastSeries = refs.emaFast
      const emaSlowSeries = refs.emaSlow
      emaFastSeries.setData(fast.values.map((v, i) => ({ time: (times[i + fOffset] ?? lastTime2) as UTCTimestamp, value: v })))
      emaSlowSeries.setData(slow.values.map((v, i) => ({ time: (times[i + sOffset] ?? lastTime2) as UTCTimestamp, value: v })))
    } else {
      if (refs.emaFast) { chart.removeSeries(refs.emaFast); delete refs.emaFast }
      if (refs.emaSlow) { chart.removeSeries(refs.emaSlow); delete refs.emaSlow }
    }

    // MACD (line + signal)
    if (indicators?.macd) {
      if (!refs.macd) {
        refs.macd = chart.addSeries(LineSeries, { color: LINE_MACD, lineWidth: 1, title: 'MACD', priceScaleId: 'macd' })
        chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.75, bottom: 0.05 } })
      }
      if (!refs.macdSignal) {
        refs.macdSignal = chart.addSeries(LineSeries, { color: LINE_MACD_SIGNAL, lineWidth: 1, title: 'Signal', priceScaleId: 'macd' })
      }
      const { bars } = calcMACD({
        closes: prices,
        fastPeriod: indicators.macd.fast,
        slowPeriod: indicators.macd.slow,
        signalPeriod: indicators.macd.signal,
      })
      const mOffset = times.length - bars.length
      const lastTime3 = times[times.length - 1] ?? 0
      const macdData: LineData[] = []
      const signalData: LineData[] = []
      bars.forEach((bar, i) => {
        const t = (times[i + mOffset] ?? lastTime3) as UTCTimestamp
        if (bar.MACD != null) macdData.push({ time: t, value: bar.MACD })
        if (bar.signal != null) signalData.push({ time: t, value: bar.signal })
      })
      const macdSeries = refs.macd
      const macdSignalSeries = refs.macdSignal
      macdSeries.setData(macdData)
      macdSignalSeries.setData(signalData)
    } else {
      if (refs.macd) { chart.removeSeries(refs.macd); delete refs.macd }
      if (refs.macdSignal) { chart.removeSeries(refs.macdSignal); delete refs.macdSignal }
    }
  }

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ minHeight: 500, background: DARK_BG }}
      aria-label={`${symbol} ${timeframe} chart`}
      role="img"
    >
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: DARK_BG, zIndex: 10 }}
          aria-live="polite"
          aria-label="차트 데이터 로딩 중"
        >
          <span style={{ color: DARK_TEXT, fontSize: 14 }}>Loading {symbol}...</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Anchor.time (Time = UTCTimestamp | BusinessDay | string) → unix seconds
 */
function anchorTimeToUnixSeconds(time: unknown): number {
  if (typeof time === 'number') return time
  if (typeof time === 'string') {
    // ISO date string "YYYY-MM-DD" → Date
    const d = new Date(time)
    if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000)
  }
  if (typeof time === 'object' && time !== null) {
    // BusinessDay { year, month, day }
    const bd = time as { year: number; month: number; day: number }
    const d = new Date(bd.year, bd.month - 1, bd.day)
    return Math.floor(d.getTime() / 1000)
  }
  return 0
}

/**
 * Timeframe → candle duration in seconds
 */
function candleIntervalSeconds(tf: Timeframe): number {
  const map: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
  }
  return map[tf] ?? 60
}
