import type { TelegramConfig } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendResult {
  ok: boolean
  status?: number
  error?: string
}

type ParseMode = 'HTML' | 'MarkdownV2'

interface SendOptions {
  parseMode?: ParseMode | 'plain'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TELEGRAM_API_BASE = 'https://api.telegram.org'
const MAX_TEXT_LENGTH = 4096
const TRUNCATE_MARKER = '...'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  return text.slice(0, MAX_TEXT_LENGTH - TRUNCATE_MARKER.length) + TRUNCATE_MARKER
}

function buildPayload(
  cfg: TelegramConfig,
  text: string,
  opts?: SendOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    chat_id: cfg.chatId,
    text: truncateText(text),
  }

  if (opts?.parseMode && opts.parseMode !== 'plain') {
    payload['parse_mode'] = opts.parseMode
  }

  return payload
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Telegram Bot API sendMessage (fetch only).
 *
 * 에러 처리:
 *   - missing_token: botToken 빈 문자열 → 즉시 반환 (네트워크 호출 X)
 *   - missing_chat_id: chatId 빈 문자열 → 즉시 반환 (네트워크 호출 X)
 *   - http_401: 잘못된 bot token
 *   - http_429: rate limit (자동 재시도 X)
 *   - network_error: fetch reject
 */
export async function sendTelegramMessage(
  cfg: TelegramConfig,
  text: string,
  opts?: SendOptions,
): Promise<SendResult> {
  if (!cfg.botToken) {
    return { ok: false, error: 'missing_token' }
  }

  if (!cfg.chatId) {
    return { ok: false, error: 'missing_chat_id' }
  }

  const url = `${TELEGRAM_API_BASE}/bot${cfg.botToken}/sendMessage`
  const body = JSON.stringify(buildPayload(cfg, text, opts))

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    const status = response.status

    if (status >= 200 && status < 300) {
      return { ok: true, status }
    }

    return { ok: false, status, error: `http_${status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `network_error: ${message}` }
  }
}
