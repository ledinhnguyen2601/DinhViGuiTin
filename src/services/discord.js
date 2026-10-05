/**
 * Discord Webhook service for Geofencing Tracker v1.0
 * Provides sendDiscordMessage and testDiscordWebhook
 * STRICT PRIVACY: NEVER logs webhook URLs to console
 */

import { DISCORD_DEFAULTS } from '../config/constants.js';

const DISCORD_WEBHOOK_PREFIX = 'https://discord.com/api/webhooks/';
const DEFAULT_TIMEOUT_MS = 10000; // 10s timeout

/**
 * Validates if the given URL is a legitimate Discord webhook URL
 * @param {string} url
 * @returns {boolean}
 */
export function validateDiscordWebhookUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.trim().startsWith(DISCORD_WEBHOOK_PREFIX);
}

/**
 * Sends a message to Discord via Webhook
 * @param {string} webhookUrl - Discord webhook URL
 * @param {string} message - Message text
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendDiscordMessage(webhookUrl, message) {
  const cleanUrl = typeof webhookUrl === 'string' ? webhookUrl.trim() : '';

  if (!validateDiscordWebhookUrl(cleanUrl)) {
    return {
      ok: false,
      error: 'URL Webhook Discord không đúng định dạng (phải bắt đầu bằng https://discord.com/api/webhooks/)',
    };
  }

  const cleanMessage = typeof message === 'string' ? message.trim() : String(message || '').trim();
  if (!cleanMessage) {
    return { ok: false, error: 'Nội dung tin nhắn trống' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        username: DISCORD_DEFAULTS.USERNAME,
        content: cleanMessage,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status >= 200 && res.status <= 204) {
      return { ok: true };
    }

    let errorDesc = `Mã phản hồi HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.message) {
        errorDesc = `${errorDesc}: ${data.message}`;
      }
    } catch {
      // Non-JSON response body
    }

    return { ok: false, error: errorDesc };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === 'AbortError') {
      return {
        ok: false,
        error: 'Hết thời gian chờ kết nối tới máy chủ Discord (Timeout 10s)',
      };
    }
    return {
      ok: false,
      error: err?.message || 'Lỗi mạng khi kết nối Discord',
    };
  }
}

/**
 * Tests Discord Webhook connectivity with predefined test message
 * @param {string} webhookUrl - Discord webhook URL
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function testDiscordWebhook(webhookUrl) {
  return await sendDiscordMessage(
    webhookUrl,
    '✅ Geofencing Tracker: Kết nối Discord thành công!'
  );
}
