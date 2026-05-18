import type { DiscordConfig } from '../types'

// SendResult — telegram.ts 미존재 시 여기서 정의 (동일 계약)
export interface SendResult {
  ok: boolean
  status?: number
  error?: string
}

const MAX_CONTENT_LENGTH = 2000 // Discord 제한

export async function sendDiscordMessage(
  cfg: DiscordConfig,
  text: string,
  opts?: { username?: string }
): Promise<SendResult> {
  if (!cfg.webhookUrl) return { ok: false, error: 'missing_webhook_url' }

  // webhookUrl 형식 검증 (discord.com / discordapp.com 도메인만)
  try {
    const u = new URL(cfg.webhookUrl)
    if (!u.host.endsWith('discord.com') && !u.host.endsWith('discordapp.com')) {
      return { ok: false, error: 'invalid_webhook_url' }
    }
  } catch {
    return { ok: false, error: 'invalid_webhook_url' }
  }

  const truncated =
    text.length > MAX_CONTENT_LENGTH
      ? text.slice(0, MAX_CONTENT_LENGTH - 3) + '...'
      : text

  const payload: Record<string, unknown> = { content: truncated }
  if (opts?.username) payload.username = opts.username

  try {
    const res = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status }
    return { ok: false, status: res.status, error: `http_${res.status}` }
  } catch (err) {
    return {
      ok: false,
      error: `network_error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
