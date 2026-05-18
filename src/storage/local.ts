/**
 * local.ts — localStorage 기반 단일 키 스토리지 래퍼 (V2)
 *
 * UP-15 race: localStorage 는 동기 + JS single-thread. write race 없음. OK.
 * UP-16 secret: telegram.botToken / discord.webhookUrl 는
 *               Settings wrapper 안에서만 다룸. log 0.
 */

import {
  type Settings,
  type Alert,
  type TelegramConfig,
  type DiscordConfig,
  EMPTY_SETTINGS,
} from '../types'

const STORAGE_KEY = 'chartalert:settings'

// ──────────────────────────────────────────────────────────────────────────────
// SSR safety
// ──────────────────────────────────────────────────────────────────────────────

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

// ──────────────────────────────────────────────────────────────────────────────
// 메모리 fallback (SSR / vitest 환경)
// ──────────────────────────────────────────────────────────────────────────────

let _memStore: Record<string, string> = {}
function memGet(key: string): string | undefined {
  return _memStore[key]
}
function memSet(key: string, value: string): void {
  _memStore[key] = value
}

/** 테스트 격리용 — 각 test beforeEach 에서 호출 */
export function _resetMemStore(): void {
  _memStore = {}
}

// ──────────────────────────────────────────────────────────────────────────────
// Raw I/O
// ──────────────────────────────────────────────────────────────────────────────

function rawGet(key: string): string | undefined {
  if (isLocalStorageAvailable()) {
    return window.localStorage.getItem(key) ?? undefined
  }
  return memGet(key)
}

function rawSet(key: string, value: string): void {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(key, value)
  } else {
    memSet(key, value)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 경고 핸들러
// ──────────────────────────────────────────────────────────────────────────────

/** 알람 100개 초과 시 또는 QuotaExceededError 발생 시 호출 */
export type StorageWarn = 'too_many_alerts' | 'quota_exceeded'

const MAX_ALERTS_WARN = 100

let _warnHandler: ((kind: StorageWarn) => void) | null = null

export function setStorageWarnHandler(h: ((kind: StorageWarn) => void) | null): void {
  _warnHandler = h
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

export function loadSettings(): Settings {
  try {
    const raw = rawGet(STORAGE_KEY)
    if (!raw) return { ...EMPTY_SETTINGS, alerts: [] }
    const parsed = JSON.parse(raw) as Settings
    // schema note: v1 storage key = 'alertapp:settings' — 충돌 없음.
    return parsed
  } catch {
    // corrupt JSON → EMPTY_SETTINGS fallback
    return { ...EMPTY_SETTINGS, alerts: [] }
  }
}

export function saveSettings(s: Settings): void {
  try {
    rawSet(STORAGE_KEY, JSON.stringify(s))
    if (s.alerts.length > MAX_ALERTS_WARN) {
      _warnHandler?.('too_many_alerts')
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      _warnHandler?.('quota_exceeded')
      throw err
    }
    throw err
  }
}

export function addAlert(alert: Alert): void {
  const s = loadSettings()
  s.alerts.push(alert)
  saveSettings(s)
}

export function updateAlert(id: string, patch: Partial<Alert>): void {
  const s = loadSettings()
  const idx = s.alerts.findIndex((a) => a.id === id)
  if (idx === -1) return
  // discriminated union — kind 유지, 나머지 필드 patch. type assertion 으로 처리.
  s.alerts[idx] = { ...s.alerts[idx]!, ...patch } as Alert
  saveSettings(s)
}

export function removeAlert(id: string): void {
  const s = loadSettings()
  s.alerts = s.alerts.filter((a) => a.id !== id)
  saveSettings(s)
}

export function setTelegramConfig(cfg: TelegramConfig): void {
  const s = loadSettings()
  s.telegram = cfg
  saveSettings(s)
}

export function getTelegramConfig(): TelegramConfig | null {
  return loadSettings().telegram
}

export function setDiscordConfig(cfg: DiscordConfig): void {
  const s = loadSettings()
  s.discord = cfg
  saveSettings(s)
}

export function getDiscordConfig(): DiscordConfig | null {
  return loadSettings().discord
}
