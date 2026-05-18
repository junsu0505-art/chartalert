'use client'

/**
 * SettingsDialog.tsx — Telegram / Discord webhook 설정 모달
 * R5b
 * UP-16: botToken / webhookUrl 은 password type input. 화면 log X.
 * UP-15: saveSettings 후 상태 반영 — props 경유로 처리 (localStorage race 없음).
 */

import { useState } from 'react'
import type { TelegramConfig, DiscordConfig } from '../types'
import { sendTelegramMessage } from '../notify/telegram'
import { sendDiscordMessage } from '../notify/discord'

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  initialTelegram: TelegramConfig | null
  initialDiscord: DiscordConfig | null
  onSaveTelegram: (cfg: TelegramConfig) => void
  onSaveDiscord: (cfg: DiscordConfig) => void
}

// ─────────────────────────────────────────────
// Tab type
// ─────────────────────────────────────────────

type Tab = 'telegram' | 'discord'

// ─────────────────────────────────────────────
// Sub-panels
// ─────────────────────────────────────────────

interface TelegramPanelProps {
  initial: TelegramConfig | null
  onSave: (cfg: TelegramConfig) => void
}

function TelegramPanel({ initial, onSave }: TelegramPanelProps) {
  const [botToken, setBotToken] = useState(initial?.botToken ?? '')
  const [chatId, setChatId] = useState(initial?.chatId ?? '')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  function handleSave() {
    if (!botToken.trim() || !chatId.trim()) return
    onSave({ botToken: botToken.trim(), chatId: chatId.trim() })
  }

  async function handleTest() {
    if (!botToken.trim() || !chatId.trim()) {
      setTestResult('오류: botToken과 chatId를 입력하세요')
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await sendTelegramMessage(
        { botToken: botToken.trim(), chatId: chatId.trim() },
        'ChartAlert 테스트 메시지',
      )
      setTestResult(result.ok ? '발송 성공' : `오류: ${result.error ?? 'unknown'}`)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tg-token" className="text-sm text-gray-300">
          Bot Token
        </label>
        {/* UP-16: password type */}
        <input
          id="tg-token"
          type="password"
          autoComplete="off"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="1234567890:AABBcc..."
          className="rounded-md bg-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none ring-1 ring-gray-600 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tg-chatid" className="text-sm text-gray-300">
          Chat ID
        </label>
        <input
          id="tg-chatid"
          type="text"
          autoComplete="off"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="-100123456789"
          className="rounded-md bg-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none ring-1 ring-gray-600 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          disabled={!botToken.trim() || !chatId.trim()}
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={isTesting}
          className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-500 transition-colors disabled:opacity-50"
        >
          {isTesting ? '발송 중...' : '테스트 발송'}
        </button>
      </div>

      {testResult !== null && (
        <p
          role="status"
          className={`text-sm ${testResult.startsWith('오류') ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {testResult}
        </p>
      )}
    </div>
  )
}

interface DiscordPanelProps {
  initial: DiscordConfig | null
  onSave: (cfg: DiscordConfig) => void
}

function DiscordPanel({ initial, onSave }: DiscordPanelProps) {
  const [webhookUrl, setWebhookUrl] = useState(initial?.webhookUrl ?? '')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  function handleSave() {
    if (!webhookUrl.trim()) return
    onSave({ webhookUrl: webhookUrl.trim() })
  }

  async function handleTest() {
    if (!webhookUrl.trim()) {
      setTestResult('오류: Webhook URL을 입력하세요')
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await sendDiscordMessage(
        { webhookUrl: webhookUrl.trim() },
        'ChartAlert 테스트 메시지',
      )
      setTestResult(result.ok ? '발송 성공' : `오류: ${result.error ?? 'unknown'}`)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dc-url" className="text-sm text-gray-300">
          Webhook URL
        </label>
        {/* UP-16: password type */}
        <input
          id="dc-url"
          type="password"
          autoComplete="off"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="rounded-md bg-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none ring-1 ring-gray-600 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          disabled={!webhookUrl.trim()}
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={isTesting}
          className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-500 transition-colors disabled:opacity-50"
        >
          {isTesting ? '발송 중...' : '테스트 발송'}
        </button>
      </div>

      {testResult !== null && (
        <p
          role="status"
          className={`text-sm ${testResult.startsWith('오류') ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {testResult}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SettingsDialog (main export)
// ─────────────────────────────────────────────

export function SettingsDialog({
  open,
  onClose,
  initialTelegram,
  initialDiscord,
  onSaveTelegram,
  onSaveDiscord,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('telegram')

  if (!open) return null

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="설정"
    >
      {/* panel */}
      <div className="relative w-full max-w-md rounded-xl bg-gray-900 shadow-2xl ring-1 ring-gray-700">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-100">알림 설정</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* tabs */}
        <div className="flex border-b border-gray-700" role="tablist">
          {(['telegram', 'discord'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab === 'telegram' ? 'Telegram' : 'Discord'}
            </button>
          ))}
        </div>

        {/* panel content */}
        <div className="px-6 py-5" role="tabpanel">
          {activeTab === 'telegram' ? (
            <TelegramPanel initial={initialTelegram} onSave={onSaveTelegram} />
          ) : (
            <DiscordPanel initial={initialDiscord} onSave={onSaveDiscord} />
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsDialog
