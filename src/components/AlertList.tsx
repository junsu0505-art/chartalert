'use client'

/**
 * AlertList.tsx — 알람 5종 CRUD UI
 * R5b: discriminated union 기반 렌더링, Tailwind dark theme
 */

import type { Alert, TrendlineAlert, HorizontalAlert, RsiAlert, EmaAlert, MacdAlert } from '../types'

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface AlertListProps {
  alerts: Alert[]
  onUpdate: (id: string, patch: Partial<Alert>) => void
  onRemove: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
}

// ─────────────────────────────────────────────
// Helpers — description per kind
// ─────────────────────────────────────────────

function describeAlert(alert: Alert): string {
  const dir = alert.direction === 'cross_above' ? '위로 돌파' : '아래로 이탈'

  switch (alert.kind) {
    case 'trendline': {
      const a = alert as TrendlineAlert
      const p1 = a.p1.price.toLocaleString()
      const p2 = a.p2.price.toLocaleString()
      return `${a.symbol} 추세선 ${a.direction} (${p1} ~ ${p2})`
    }
    case 'horizontal': {
      const a = alert as HorizontalAlert
      return `${a.symbol} 가로선 ${a.price.toLocaleString()} ${dir}`
    }
    case 'rsi': {
      const a = alert as RsiAlert
      return `${a.symbol} RSI ${a.period} 임계 ${a.threshold} ${a.direction}`
    }
    case 'ema': {
      const a = alert as EmaAlert
      return `${a.symbol} EMA ${a.fastPeriod}/${a.slowPeriod} ${a.direction}`
    }
    case 'macd': {
      const a = alert as MacdAlert
      return `${a.symbol} MACD (${a.fastPeriod},${a.slowPeriod},${a.signalPeriod}) ${a.direction}`
    }
  }
}

// ─────────────────────────────────────────────
// Icon per kind
// ─────────────────────────────────────────────

function AlertIcon({ kind }: { kind: Alert['kind'] }) {
  const base = 'w-5 h-5 shrink-0'
  switch (kind) {
    case 'trendline':
      return (
        <svg className={base} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'horizontal':
      return (
        <svg className={base} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'rsi':
      return (
        <svg className={base} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M2 14 L6 6 L10 12 L14 4 L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'ema':
      return (
        <svg className={base} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M2 12 Q7 4 10 10 Q13 16 18 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'macd':
      return (
        <svg className={base} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="10" width="3" height="7" rx="1" fill="currentColor" />
          <rect x="8.5" y="6" width="3" height="11" rx="1" fill="currentColor" />
          <rect x="14" y="8" width="3" height="9" rx="1" fill="currentColor" />
        </svg>
      )
  }
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

const STATUS_STYLES: Record<Alert['status'], string> = {
  armed: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
  triggered: 'bg-blue-900/60 text-blue-300 border border-blue-700',
  paused: 'bg-gray-700/60 text-gray-400 border border-gray-600',
}

const STATUS_LABEL: Record<Alert['status'], string> = {
  armed: '대기중',
  triggered: '발동됨',
  paused: '일시중지',
}

function StatusBadge({ status }: { status: Alert['status'] }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// ─────────────────────────────────────────────
// AlertRow
// ─────────────────────────────────────────────

interface AlertRowProps {
  alert: Alert
  onRemove: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
}

function AlertRow({ alert, onRemove, onPause, onResume }: AlertRowProps) {
  const canPause = alert.status === 'armed' || alert.status === 'triggered'
  const canResume = alert.status === 'paused'

  return (
    <li className="flex items-center gap-3 rounded-lg bg-gray-800 px-4 py-3">
      {/* icon */}
      <span className="text-gray-400">
        <AlertIcon kind={alert.kind} />
      </span>

      {/* description + badge */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <span className="truncate text-sm text-gray-100">{describeAlert(alert)}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={alert.status} />
          <span className="text-xs text-gray-500">{alert.tfLabel} · {alert.exchange}</span>
        </div>
      </div>

      {/* actions */}
      <div className="flex shrink-0 items-center gap-2">
        {canPause && (
          <button
            type="button"
            aria-label={`${alert.symbol} 알람 일시중지`}
            onClick={() => onPause(alert.id)}
            className="rounded px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-900/30 transition-colors"
          >
            일시중지
          </button>
        )}
        {canResume && (
          <button
            type="button"
            aria-label={`${alert.symbol} 알람 재개`}
            onClick={() => onResume(alert.id)}
            className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-900/30 transition-colors"
          >
            재개
          </button>
        )}
        <button
          type="button"
          aria-label={`${alert.symbol} 알람 삭제`}
          onClick={() => onRemove(alert.id)}
          className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
        >
          삭제
        </button>
      </div>
    </li>
  )
}

// ─────────────────────────────────────────────
// AlertList (main export)
// ─────────────────────────────────────────────

export function AlertList({ alerts, onUpdate: _onUpdate, onRemove, onPause, onResume }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900 py-12 text-center">
        <p className="text-sm text-gray-500">등록된 알람이 없습니다</p>
        <p className="mt-1 text-xs text-gray-600">추세선 또는 지표를 선택해 알람을 추가하세요</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="알람 목록">
      {alerts.map((alert) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          onRemove={onRemove}
          onPause={onPause}
          onResume={onResume}
        />
      ))}
    </ul>
  )
}

export default AlertList
