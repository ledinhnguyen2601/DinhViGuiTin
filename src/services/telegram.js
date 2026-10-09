/**
 * Telegram Bot API client for Geofencing Tracker v1.0
 * Handles API calls, timeouts, error classification (400, 401, 403, 429), and token privacy
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 10000; // 10s timeout

/**
 * Helper to execute a fetch request with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Classifies Telegram API error response or network failure
 */
function classifyTelegramError(err, status = null, json = null) {
  if (err && err.name === 'AbortError') {
    return {
      type: 'NETWORK_TIMEOUT',
      message: 'Hết thời gian chờ kết nối tới máy chủ Telegram (Timeout 10s)',
      code: 408,
      retryable: true,
    };
  }

  if (status === 401) {
    return {
      type: 'INVALID_TOKEN',
      message: 'Bot Token không hợp lệ hoặc đã bị thu hồi (Lỗi 401 Unauthorized)',
      code: 401,
      retryable: false,
    };
  }

  if (status === 400) {
    const desc = json?.description || 'Bad Request';
    let msg = 'Chat ID không hợp lệ hoặc bot chưa được thêm vào nhóm (Lỗi 400)';
    if (desc.includes('chat not found')) {
      msg = 'Không tìm thấy nhóm/người nhận (Chat ID không tồn tại hoặc sai)';
    }
    return {
      type: 'INVALID_CHAT_ID',
      message: msg,
      code: 400,
      retryable: false,
      detail: desc,
    };
  }

  if (status === 403) {
    return {
      type: 'BOT_BLOCKED_OR_KICKED',
      message: 'Bot đã bị chặn hoặc bị xóa khỏi nhóm chat (Lỗi 403 Forbidden)',
      code: 403,
      retryable: false,
    };
  }

  if (status === 429) {
    const retryAfter = json?.parameters?.retry_after || 5;
    return {
      type: 'RATE_LIMIT',
      message: `Gửi quá nhanh, Telegram yêu cầu chờ ${retryAfter} giây (Lỗi 429)`,
      code: 429,
      retryAfter,
      retryable: true,
    };
  }

  // Generic network error (e.g. offline, DNS failure, Telegram blocked by ISP)
  return {
    type: 'NETWORK_ERROR',
    message: err?.message || 'Không thể kết nối tới Telegram (có thể do mất mạng hoặc bị chặn)',
    code: status || 0,
    retryable: true,
  };
}

export const TelegramService = {
  /**
   * Tests Bot Token validity via getMe
   */
  async getMe(botToken) {
    const cleanToken = (botToken || '').trim();
    if (!cleanToken) {
      return { ok: false, error: 'Chưa nhập Bot Token' };
    }

    try {
      const url = `${TELEGRAM_API_BASE}/bot${cleanToken}/getMe`;
      const res = await fetchWithTimeout(url, { method: 'GET' });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok) {
        return {
          ok: true,
          botInfo: json.result, // { id, is_bot, first_name, username }
        };
      }

      const errorInfo = classifyTelegramError(null, res.status, json);
      return { ok: false, ...errorInfo };
    } catch (err) {
      const errorInfo = classifyTelegramError(err);
      return { ok: false, ...errorInfo };
    }
  },

  /**
   * Sends text message to Telegram group/chat
   */
  async sendMessage(botToken, chatId, text) {
    const cleanToken = (botToken || '').trim();
    const cleanChatId = String(chatId || '').trim();

    if (!cleanToken) {
      return { ok: false, error: 'Chưa cấu hình Bot Token' };
    }
    if (!cleanChatId) {
      return { ok: false, error: 'Chưa cấu hình Chat ID' };
    }
    if (!text || !text.trim()) {
      return { ok: false, error: 'Nội dung tin nhắn trống' };
    }

    try {
      const url = `${TELEGRAM_API_BASE}/bot${cleanToken}/sendMessage`;
      const body = {
        chat_id: cleanChatId,
        text: text.trim(),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      };

      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok) {
        return {
          ok: true,
          messageId: json.result?.message_id,
        };
      }

      const errorInfo = classifyTelegramError(null, res.status, json);
      return { ok: false, ...errorInfo };
    } catch (err) {
      const errorInfo = classifyTelegramError(err);
      return { ok: false, ...errorInfo };
    }
  },

  /**
   * Fetches latest chat ID using getUpdates for easy setup helper
   */
  async getLatestChatId(botToken) {
    const cleanToken = (botToken || '').trim();
    if (!cleanToken) return { ok: false, error: 'Chưa nhập Bot Token' };

    try {
      const url = `${TELEGRAM_API_BASE}/bot${cleanToken}/getUpdates`;
      const res = await fetchWithTimeout(url, { method: 'GET' });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok && Array.isArray(json.result) && json.result.length > 0) {
        // Find most recent message with a chat
        for (let i = json.result.length - 1; i >= 0; i--) {
          const update = json.result[i];
          const chat = update.message?.chat || update.channel_post?.chat || update.my_chat_member?.chat;
          if (chat && chat.id) {
            return {
              ok: true,
              chatId: String(chat.id),
              chatTitle: chat.title || chat.username || chat.first_name || 'Nhóm',
            };
          }
        }
      }

      return {
        ok: false,
        error: 'Chưa thấy tin nhắn mới trong nhóm. Hãy mở nhóm gửi /start@ten_bot rồi bấm lại.',
      };
    } catch (err) {
      const errorInfo = classifyTelegramError(err);
      return { ok: false, ...errorInfo };
    }
  },

  /**
   * Fetches updates for reverse query polling
   */
  async getUpdates(botToken, offset = null, timeout = 5, signal = null) {
    const cleanToken = (botToken || '').trim();
    if (!cleanToken) return { ok: false, error: 'Chưa nhập Bot Token' };

    try {
      let url = `${TELEGRAM_API_BASE}/bot${cleanToken}/getUpdates?timeout=${timeout}`;
      if (offset) {
        url += `&offset=${offset}`;
      }
      // Use short 5s long polling with (timeout + 3)s fetch abort window
      const res = await fetchWithTimeout(url, { method: 'GET', signal }, (timeout + 3) * 1000);
      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok) {
        return {
          ok: true,
          updates: json.result || [],
        };
      }
      const errorInfo = classifyTelegramError(null, res.status, json);
      return { ok: false, ...errorInfo };
    } catch (err) {
      const errorInfo = classifyTelegramError(err);
      return { ok: false, ...errorInfo };
    }
  }
};
