import { beforeEach, describe, it, expect, vi } from 'vitest'
import {
  loadSettings,
  saveSettings,
  addAlert,
  updateAlert,
  removeAlert,
  setTelegramConfig,
  getTelegramConfig,
  setDiscordConfig,
  getDiscordConfig,
  setStorageWarnHandler,
  _resetMemStore,
} from '../src/storage/local'
import type { Alert, TrendlineAlert, Settings } from '../src/types'
import { EMPTY_SETTINGS } from '../src/types'

// ──────────────────────────────────────────────────────────────────────────────
// Setup: 각 테스트 전 메모리 fallback + localStorage 초기화
// ──────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetMemStore()
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear()
  }
  setStorageWarnHandler(null)
})

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeTrendlineAlert(overrides: Partial<TrendlineAlert> = {}): TrendlineAlert {
  return {
    id: crypto.randomUUID(),
    kind: 'trendline',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    tfLabel: '4h',
    p1: { time: 1700000000, price: 30000 },
    p2: { time: 1700003600, price: 31000 },
    direction: 'cross_above',
    status: 'armed',
    createdAt: Date.now(),
    triggeredAt: null,
    ...overrides,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Cases
// ──────────────────────────────────────────────────────────────────────────────

describe('storage/local', () => {
  // Case 1: 빈 storage → EMPTY_SETTINGS
  it('Case 1: 빈 storage → EMPTY_SETTINGS 반환', () => {
    const s = loadSettings()
    expect(s.telegram).toBeNull()
    expect(s.discord).toBeNull()
    expect(s.alerts).toHaveLength(0)
  })

  // Case 2: saveSettings → loadSettings round trip
  it('Case 2: saveSettings → loadSettings round-trip', () => {
    const alert = makeTrendlineAlert()
    const target: Settings = {
      telegram: { botToken: 'tok_abc', chatId: '12345' },
      discord: { webhookUrl: 'https://discord.com/api/webhooks/test' },
      alerts: [alert],
    }
    saveSettings(target)
    const loaded = loadSettings()
    expect(loaded.telegram?.chatId).toBe('12345')
    expect(loaded.discord?.webhookUrl).toBe('https://discord.com/api/webhooks/test')
    expect(loaded.alerts).toHaveLength(1)
    expect(loaded.alerts[0]?.symbol).toBe('BTCUSDT')
  })

  // Case 3: addAlert / removeAlert
  it('Case 3: addAlert 후 length=1, removeAlert 후 length=0', () => {
    const alert = makeTrendlineAlert()
    addAlert(alert)
    expect(loadSettings().alerts).toHaveLength(1)

    removeAlert(alert.id)
    expect(loadSettings().alerts).toHaveLength(0)
  })

  // Case 4: updateAlert — status 변경
  it('Case 4: updateAlert status triggered 로 변경', () => {
    const alert = makeTrendlineAlert({ status: 'armed' })
    addAlert(alert)
    updateAlert(alert.id, { status: 'triggered', triggeredAt: 1700005000 })
    const s = loadSettings()
    expect(s.alerts[0]?.status).toBe('triggered')
    expect(s.alerts[0]?.triggeredAt).toBe(1700005000)
  })

  // Case 4b: updateAlert — 존재하지 않는 id → 무시 (no-op)
  it('Case 4b: updateAlert 존재하지 않는 id → no-op', () => {
    addAlert(makeTrendlineAlert())
    updateAlert('non-existent-id', { status: 'paused' })
    expect(loadSettings().alerts).toHaveLength(1)
    expect(loadSettings().alerts[0]?.status).toBe('armed')
  })

  // Case 5: setTelegramConfig + getTelegramConfig round trip
  it('Case 5: setTelegramConfig → getTelegramConfig 동일 반환', () => {
    setTelegramConfig({ botToken: 'bot_xyz', chatId: '99999' })
    const cfg = getTelegramConfig()
    expect(cfg?.botToken).toBe('bot_xyz')
    expect(cfg?.chatId).toBe('99999')
  })

  // Case 6: setDiscordConfig + getDiscordConfig round trip
  it('Case 6: setDiscordConfig → getDiscordConfig 동일 반환', () => {
    setDiscordConfig({ webhookUrl: 'https://discord.com/api/webhooks/abc/token' })
    const cfg = getDiscordConfig()
    expect(cfg?.webhookUrl).toBe('https://discord.com/api/webhooks/abc/token')
  })

  // Case 7: corrupt JSON → EMPTY_SETTINGS fallback
  it('Case 7: corrupt JSON → EMPTY_SETTINGS fallback', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('chartalert:settings', '{ broken json :::')
    } else {
      // memStore 에 corrupt 주입 — _resetMemStore 후 직접 localStorage-equivalent 접근 불가.
      // saveSettings 를 통해 corrupt 를 주입할 수 없으므로 내부 rawSet 을 직접 테스트 불가.
      // 이 분기는 jsdom 환경에서 실행되므로 skip 없이 통과.
    }
    const s = loadSettings()
    expect(s.telegram).toBeNull()
    expect(s.alerts).toHaveLength(0)
  })

  // Case 8: too_many_alerts warn — 101개 addAlert 시 핸들러 호출
  it('Case 8: 101개 alert → too_many_alerts warn 발동', () => {
    const warnMock = vi.fn()
    setStorageWarnHandler(warnMock)

    // 101개 한꺼번에 saveSettings
    const alerts: Alert[] = Array.from({ length: 101 }, () => makeTrendlineAlert())
    saveSettings({ ...EMPTY_SETTINGS, alerts })

    expect(warnMock).toHaveBeenCalledOnce()
    expect(warnMock).toHaveBeenCalledWith('too_many_alerts')
  })

  // Case 9: _resetMemStore — 테스트 격리 확인
  it('Case 9: _resetMemStore 후 storage 초기화 확인', () => {
    addAlert(makeTrendlineAlert())
    expect(loadSettings().alerts).toHaveLength(1)

    // localStorage 도 clear
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    _resetMemStore()

    expect(loadSettings().alerts).toHaveLength(0)
  })
})
