import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sendDiscordMessage,
  testDiscordWebhook,
  validateDiscordWebhookUrl,
} from '../src/services/discord.js';
import { StorageService } from '../src/services/storage.js';
import { DISCORD_DEFAULTS } from '../src/config/constants.js';

describe('Discord Webhook Service (discord.js)', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Ca 1: sendDiscordMessage thành công → { ok: true }
  it('1. sendDiscordMessage thành công → { ok: true }', async () => {
    const validUrl = 'https://discord.com/api/webhooks/1234567890/tokenABC123';
    const message = 'Test thông báo đến nơi';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => ({}),
    });

    const result = await sendDiscordMessage(validUrl, message);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe(validUrl);
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers['Content-Type']).toBe('application/json; charset=utf-8');

    const sentBody = JSON.parse(calledOptions.body);
    expect(sentBody.username).toBe(DISCORD_DEFAULTS.USERNAME);
    expect(sentBody.content).toBe(message);

    // Kiểm tra thêm: status 200 cũng trả về { ok: true }
    fetchSpy.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ id: '123' }),
    });
    const result200 = await sendDiscordMessage(validUrl, 'Test 200');
    expect(result200).toEqual({ ok: true });

    // Kiểm tra thêm: testDiscordWebhook gọi sendDiscordMessage với thông điệp chuẩn
    const testResult = await testDiscordWebhook(validUrl);
    expect(testResult).toEqual({ ok: true });
    const lastSentBody = JSON.parse(fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][1].body);
    expect(lastSentBody.content).toContain('✅ Geofencing Tracker: Kết nối Discord thành công!');
  });

  // Ca 2: sendDiscordMessage lỗi mạng → { ok: false, error: '...' }
  it('2. sendDiscordMessage lỗi mạng → { ok: false, error: "..." }', async () => {
    const validUrl = 'https://discord.com/api/webhooks/1234567890/tokenABC123';

    // Trường hợp 2.1: Mạng bị ngắt kết nối (Network Error)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch (no internet)'));

    const resNetworkError = await sendDiscordMessage(validUrl, 'Hello Discord');
    expect(resNetworkError.ok).toBe(false);
    expect(typeof resNetworkError.error).toBe('string');
    expect(resNetworkError.error).toContain('Failed to fetch');

    // Trường hợp 2.2: HTTP status lỗi (ví dụ 400 Bad Request / 404 Not Found)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ message: 'Unknown Webhook' }),
    });

    const resHttpError = await sendDiscordMessage(validUrl, 'Hello Discord');
    expect(resHttpError.ok).toBe(false);
    expect(resHttpError.error).toContain('404');
    expect(resHttpError.error).toContain('Unknown Webhook');

    // Trường hợp 2.3: Timeout (AbortError)
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortErr);

    const resTimeout = await sendDiscordMessage(validUrl, 'Hello Discord');
    expect(resTimeout.ok).toBe(false);
    expect(resTimeout.error).toContain('Timeout 10s');
  });

  // Ca 3: URL không đúng định dạng → validate trả về false (không gọi fetch)
  it('3. URL không đúng định dạng → validate trả về false (không gọi fetch)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const invalidUrls = [
      'https://example.com/api/webhooks/123/abc',
      'http://discord.com/api/webhooks/123/abc', // không phải https
      'https://discord.com/wrong/endpoint',
      'not-a-url',
      '',
      null,
      undefined,
    ];

    for (const badUrl of invalidUrls) {
      // Validate function phải trả về false
      expect(validateDiscordWebhookUrl(badUrl)).toBe(false);

      // sendDiscordMessage phải từ chối ngay và TUYỆT ĐỐI không gọi fetch
      const result = await sendDiscordMessage(badUrl, 'Nội dung thử nghiệm');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('không đúng định dạng');
    }

    // Xác nhận fetch chưa từng được gọi lần nào
    expect(fetchSpy).not.toHaveBeenCalled();

    // Đối chiếu với URL hợp lệ: validate trả về true
    expect(validateDiscordWebhookUrl('https://discord.com/api/webhooks/123/abc')).toBe(true);
  });

  // Ca 4: webhookUrl không bao giờ xuất hiện trong log
  it('4. webhookUrl không bao giờ xuất hiện trong log', async () => {
    const secretWebhook = 'https://discord.com/api/webhooks/9876543210/topSecretWebhookTokenXYZ123';
    const secretToken = 'topSecretWebhookTokenXYZ123';

    // 4.1. Kiểm tra StorageService.addLog tự động redact URL webhook dạng discord.com/api/webhooks/...
    await StorageService.addLog('info', `Cấu hình thành công URL: ${secretWebhook}`);
    await StorageService.addLog('error', 'Gửi tin thất bại', {
      targetUrl: secretWebhook,
      reason: 'Network fail',
    });

    const logs = await StorageService.getLogs();
    expect(logs.length).toBe(2);

    for (const entry of logs) {
      // TUYỆT ĐỐI không chứa secretWebhook hay secretToken
      expect(entry.message).not.toContain(secretWebhook);
      expect(entry.message).not.toContain(secretToken);
      if (entry.details) {
        expect(entry.details).not.toContain(secretWebhook);
        expect(entry.details).not.toContain(secretToken);
      }
    }

    // Xác nhận đã được redact thành [REDACTED_WEBHOOK]
    expect(logs[1].message).toContain('[REDACTED_WEBHOOK]');
    expect(logs[0].details).toContain('[REDACTED_WEBHOOK]');

    // 4.2. Kiểm tra sendDiscordMessage TUYỆT ĐỐI không log webhookUrl ra console
    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection dropped'));
    await sendDiscordMessage(secretWebhook, 'Testing log privacy');

    const allConsoleCalls = [
      ...consoleLogSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ].flat().map(String);

    for (const logText of allConsoleCalls) {
      expect(logText).not.toContain(secretWebhook);
      expect(logText).not.toContain(secretToken);
    }
  });
});
