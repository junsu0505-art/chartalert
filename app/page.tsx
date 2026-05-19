'use client'

/**
 * page.tsx — chartalert V2 메인 페이지
 *
 * UP-14: AlertRunner 5종 evaluator 통합, 모든 컴포넌트 조립.
 * UP-15: runner lifecycle = useMemo(new AlertRunner) + useEffect cleanup.
 *         _handleTrigger: updateAlert → unsubscribe 순서는 runner.ts 보장.
 * UP-16: secret 0 — process.env 경유. 화면 log X.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Chart from '@/src/components/Chart'
import { AlertList } from '@/src/components/AlertList'
import { SettingsDialog } from '@/src/components/SettingsDialog'
import { DrawingToolbar } from '@/src/components/DrawingToolbar'
import type { DrawingTool } from '@/src/components/DrawingToolbar'
import { IndicatorPanel, DEFAULT_INDICATOR_CONFIG } from '@/src/components/IndicatorPanel'
import type { IndicatorConfig } from '@/src/components/IndicatorPanel'
import {
  loadSettings,
  addAlert,
  updateAlert,
  removeAlert,
  setTelegramConfig,
  setDiscordConfig,
} from '@/src/storage/local'
import { AlertRunner } from '@/src/runtime/runner'
import { createBinanceWsClient } from '@/src/data/binance-ws'
import { createOkxWsClient } from '@/src/data/okx-ws'
import { useKlines } from '@/src/components/hooks/useKlines'
import type { Alert, TrendlineAlert, HorizontalAlert, Exchange, Timeframe, TrendlinePoint, TelegramConfig, DiscordConfig } from '@/src/types'
import type { Candle } from '@/src/data/types'

// ---------------------------------------------------------------------------
// Mini components — inline (≤50 LoC, single use, no separate file needed)
// ---------------------------------------------------------------------------

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
const EXCHANGES: Exchange[] = ['binance', 'okx']
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']

interface SelectProps<T extends string> {
  id: string
  label: string
  value: T
  options: T[]
  onChange: (v: T) => void
}

function Select<T extends string>({ id, label, value, options, onChange }: SelectProps<T>) {
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-zinc-400">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Page() {
  // ── state
  const [symbol, setSymbol] = useState<string>(
    process.env.NEXT_PUBLIC_DEFAULT_SYMBOL ?? 'BTCUSDT'
  )
  const [exchange, setExchange] = useState<Exchange>(
    (process.env.NEXT_PUBLIC_DEFAULT_EXCHANGE as Exchange) ?? 'binance'
  )
  const [timeframe, setTimeframe] = useState<Timeframe>('1h')
  const [currentTool, setCurrentTool] = useState<DrawingTool>('cursor')
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>(DEFAULT_INDICATOR_CONFIG)
  const [alerts, setAlerts] = useState<Alert[]>(() => loadSettings().alerts)
  const [showSettings, setShowSettings] = useState(false)

  // ── settings (telegram / discord) — loaded lazily from storage
  const settings = useMemo(() => loadSettings(), [])

  // ── candles (페이지 레벨 1회 fetch — runner 의 getCandles 로 주입)
  const { candles } = useKlines(symbol, exchange, timeframe)

  // ── candles ref (runner 콜백이 최신 candles 를 참조할 수 있도록 mutable ref 패턴)
  const candlesRef = useRef<Candle[]>(candles)
  useEffect(() => {
    candlesRef.current = candles
  }, [candles])

  // ── AlertRunner (ws clients + runner lifecycle)
  const binanceWs = useMemo(() => createBinanceWsClient(), [])
  const okxWs = useMemo(() => createOkxWsClient(), [])

  const handleTrigger = useCallback((triggeredAlert: Alert, _tick: unknown) => {
    // AlertList 갱신: 발화된 alert 의 status 를 triggered 로 반영
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === triggeredAlert.id ? triggeredAlert : a,
      ),
    )
  }, [])

  const runner = useMemo(
    () =>
      new AlertRunner({
        binanceWs,
        okxWs,
        getCandles: () => candlesRef.current,
        onTrigger: handleTrigger,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // runner 초기 start: armed alerts subscribe
  useEffect(() => {
    runner.start(alerts.filter((a) => a.status === 'armed'))
    return () => {
      runner.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner])

  // ── 그리기 도구 선택 변경 시 Chart 에 전달 (prop 으로 처리)
  // DrawingToolbar 는 currentTool state 로 chart 에 연동됨

  // ── drawing 콜백: onTrendlineDrawn → addAlert(TrendlineAlert) + runner.subscribe
  const handleTrendlineDrawn = useCallback(
    (p1: TrendlinePoint, p2: TrendlinePoint) => {
      const alert: TrendlineAlert = {
        id: crypto.randomUUID(),
        kind: 'trendline',
        symbol,
        exchange,
        tfLabel: timeframe,
        direction: 'cross_above',
        status: 'armed',
        createdAt: Date.now(),
        triggeredAt: null,
        p1,
        p2,
      }
      addAlert(alert)
      setAlerts((prev) => [...prev, alert])
      runner.subscribe(alert)
    },
    [symbol, exchange, timeframe, runner],
  )

  // ── drawing 콜백: onHorizontalDrawn → addAlert(HorizontalAlert) + runner.subscribe
  const handleHorizontalDrawn = useCallback(
    (price: number) => {
      const alert: HorizontalAlert = {
        id: crypto.randomUUID(),
        kind: 'horizontal',
        symbol,
        exchange,
        tfLabel: timeframe,
        direction: 'cross_above',
        status: 'armed',
        createdAt: Date.now(),
        triggeredAt: null,
        price,
      }
      addAlert(alert)
      setAlerts((prev) => [...prev, alert])
      runner.subscribe(alert)
    },
    [symbol, exchange, timeframe, runner],
  )

  // ── AlertList 액션 핸들러
  const handleUpdate = useCallback((id: string, patch: Partial<Alert>) => {
    updateAlert(id, patch)
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Alert) : a)),
    )
  }, [])

  const handleRemove = useCallback(
    (id: string) => {
      const target = alerts.find((a) => a.id === id)
      if (target) runner.unsubscribe(target)
      removeAlert(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    },
    [alerts, runner],
  )

  const handlePause = useCallback(
    (id: string) => {
      const target = alerts.find((a) => a.id === id)
      if (target) runner.unsubscribe(target)
      updateAlert(id, { status: 'paused' })
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? ({ ...a, status: 'paused' } as Alert) : a)),
      )
    },
    [alerts, runner],
  )

  const handleResume = useCallback(
    (id: string) => {
      updateAlert(id, { status: 'armed' })
      setAlerts((prev) => {
        const updated = prev.map((a) =>
          a.id === id ? ({ ...a, status: 'armed' } as Alert) : a,
        )
        const target = updated.find((a) => a.id === id)
        if (target) runner.subscribe(target)
        return updated
      })
    },
    [runner],
  )

  // ── indicators → Chart props 변환
  const chartIndicators = useMemo(() => {
    const ind: NonNullable<Parameters<typeof Chart>[0]['indicators']> = {}
    if (indicatorConfig.rsi.enabled) {
      ind.rsi = { period: indicatorConfig.rsi.period }
    }
    if (indicatorConfig.ema.enabled) {
      ind.ema = { fast: indicatorConfig.ema.fast, slow: indicatorConfig.ema.slow }
    }
    if (indicatorConfig.macd.enabled) {
      ind.macd = {
        fast: indicatorConfig.macd.fast,
        slow: indicatorConfig.macd.slow,
        signal: indicatorConfig.macd.signal,
      }
    }
    return ind
  }, [indicatorConfig])

  // ── settings save 핸들러
  const handleSaveTelegram = useCallback((cfg: TelegramConfig) => {
    setTelegramConfig(cfg)
  }, [])

  const handleSaveDiscord = useCallback((cfg: DiscordConfig) => {
    setDiscordConfig(cfg)
  }, [])

  // ── clear all drawings
  const handleClearAll = useCallback(() => {
    // DrawingManager 의 clearAll 은 Chart 내부 ref 경유 필요.
    // page 에서는 단순히 alert 삭제 (도면 자체 삭제는 Chart 내부 처리).
    // 현재 회차 scope: noop (Chart 내부 DrawingManager.clearAll() 은 R7+)
  }, [])

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------

  return (
    <main className="flex h-screen bg-zinc-900 text-zinc-100 overflow-hidden">
      {/* left: drawing toolbar */}
      <aside className="flex flex-col items-center w-12 py-2 bg-zinc-900 border-r border-zinc-800 shrink-0">
        <DrawingToolbar
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          onClearAll={handleClearAll}
        />
      </aside>

      {/* center: chart area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* header */}
        <header className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <Select<string>
            id="symbol-select"
            label="종목"
            value={symbol}
            options={SYMBOLS}
            onChange={setSymbol}
          />
          <Select<Exchange>
            id="exchange-select"
            label="거래소"
            value={exchange}
            options={EXCHANGES}
            onChange={setExchange}
          />
          <Select<Timeframe>
            id="timeframe-select"
            label="타임프레임"
            value={timeframe}
            options={TIMEFRAMES}
            onChange={setTimeframe}
          />
          <div className="ml-auto">
            <button
              type="button"
              aria-label="설정 열기"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M6.955 1.45a.5.5 0 0 1 .494.43l.1.793a4.5 4.5 0 0 1 1.024.585l.712-.4a.5.5 0 0 1 .627.11l1.06 1.06a.5.5 0 0 1 .11.627l-.4.712a4.5 4.5 0 0 1 .585 1.024l.793.1a.5.5 0 0 1 .43.494v1.5a.5.5 0 0 1-.43.494l-.793.1a4.5 4.5 0 0 1-.585 1.024l.4.712a.5.5 0 0 1-.11.627l-1.06 1.06a.5.5 0 0 1-.627.11l-.712-.4a4.5 4.5 0 0 1-1.024.585l-.1.793a.5.5 0 0 1-.494.43h-1.5a.5.5 0 0 1-.494-.43l-.1-.793a4.5 4.5 0 0 1-1.024-.585l-.712.4a.5.5 0 0 1-.627-.11L1.44 11.5a.5.5 0 0 1-.11-.627l.4-.712a4.5 4.5 0 0 1-.585-1.024l-.793-.1A.5.5 0 0 1 .92 8.55v-1.5a.5.5 0 0 1 .43-.494l.793-.1a4.5 4.5 0 0 1 .585-1.024l-.4-.712a.5.5 0 0 1 .11-.627l1.06-1.06a.5.5 0 0 1 .627-.11l.712.4A4.5 4.5 0 0 1 5.86 2.74l.1-.793a.5.5 0 0 1 .494-.43h1.5ZM6.205 8a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0Z"
                  clipRule="evenodd"
                />
              </svg>
              설정
            </button>
          </div>
        </header>

        {/* chart */}
        <div className="flex-1 min-h-0">
          <Chart
            symbol={symbol}
            exchange={exchange}
            timeframe={timeframe}
            currentTool={currentTool}
            onTrendlineDrawn={handleTrendlineDrawn}
            onHorizontalDrawn={handleHorizontalDrawn}
            indicators={chartIndicators}
          />
        </div>
      </div>

      {/* right: indicator panel + alert list */}
      <aside className="w-80 flex flex-col bg-zinc-900 border-l border-zinc-800 shrink-0 overflow-y-auto">
        <div className="p-3 border-b border-zinc-800">
          <IndicatorPanel
            config={indicatorConfig}
            onChange={setIndicatorConfig}
          />
        </div>
        <div className="flex-1 p-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            알람 목록
          </h2>
          <AlertList
            alerts={alerts}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            onPause={handlePause}
            onResume={handleResume}
          />
        </div>
      </aside>

      {/* settings modal */}
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        initialTelegram={settings.telegram}
        initialDiscord={settings.discord}
        onSaveTelegram={handleSaveTelegram}
        onSaveDiscord={handleSaveDiscord}
      />
    </main>
  )
}
