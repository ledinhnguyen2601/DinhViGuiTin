import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotifierService } from '../src/services/notifier.js';
import { TelegramService } from '../src/services/telegram.js';
import { SmsService } from '../src/services/sms.js';
import { StorageService } from '../src/services/storage.js';
import { QueueService } from '../src/services/queue.js';
import { DEFAULT_SETTINGS } from '../src/config/constants.js';

describe('Notifier Dispatcher and Fallback Integration', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
    vi.restoreAllMocks();
  });

  // TC-07: Send telegram with valid configuration succeeds
  it('TC-07: dispatches arrived notification via Telegram when configured', async () => {
    const tgSpy = vi.spyOn(TelegramService, 'sendMessage').mockResolvedValue({
      ok: true,
      messageId: 999,
    });

    const settings = { ...DEFAULT_SETTINGS, sendMode: 'telegram_with_sms_fallback' };
    const secrets = {
      telegramBotToken: '123456:ABC-DEF1234',
      telegramChatId: '-100123456789',
      backupPhone1: '0912345678',
    };

    const res = await NotifierService.notifyArrived({
      settings,
      secrets,
      tripId: 'trip_success',
    });

    expect(res.ok).toBe(true);
    expect(res.channel).toBe('telegram');
    expect(tgSpy).toHaveBeenCalledTimes(1);
    expect(tgSpy.mock.calls[0][2]).toContain(settings.travelerName);
    expect(tgSpy.mock.calls[0][2]).toContain(settings.destinationName);
  });

  // TC-08 & TC-09: Token error or Network failure triggers SMS fallback
  it('TC-08 / TC-09: falls back to SMS when Telegram is unreachable or token is invalid', async () => {
    // Mock Telegram failure (e.g. 401 Unauthorized or Network blocked)
    vi.spyOn(TelegramService, 'sendMessage').mockResolvedValue({
      ok: false,
      code: 401,
      message: 'Token invalid or Telegram blocked',
    });

    const smsSpy = vi.spyOn(SmsService, 'sendSms').mockResolvedValue({
      ok: true,
      successCount: 1,
      errors: [],
    });

    const settings = { ...DEFAULT_SETTINGS, sendMode: 'telegram_with_sms_fallback' };
    const secrets = {
      telegramBotToken: 'invalid_token',
      telegramChatId: '-100123456789',
      backupPhone1: '0912345678',
    };

    // Execute fallback flow directly without waiting for real timeouts
    const queueItem = await QueueService.enqueue({
      type: 'ARRIVED',
      text: 'Nguyen da den Nha',
      tripId: 'trip_fallback',
      meta: {
        smsText: 'Nguyen da den Nha luc 14:30. (Tin tu dong tu app)',
        timeStr: '14:30',
      },
    });

    const res = await NotifierService.executeFallbackWorkflow(
      queueItem,
      settings,
      secrets,
      [secrets.backupPhone1],
      { retry2: 1, retry3: 1 } // fast delays for unit test
    );

    expect(smsSpy).toHaveBeenCalled();
    expect(res.channel).toBe('sms_fallback');
  });

  it('handles SMS only mode directly', async () => {
    const smsSpy = vi.spyOn(SmsService, 'sendSms').mockResolvedValue({
      ok: true,
      successCount: 1,
      errors: [],
    });

    const settings = { ...DEFAULT_SETTINGS, sendMode: 'sms_only' };
    const secrets = {
      backupPhone1: '0987654321',
    };

    const res = await NotifierService.notifyArrived({
      settings,
      secrets,
      tripId: 'trip_sms_only',
    });

    expect(res.ok).toBe(true);
    expect(res.channel).toBe('sms');
    expect(smsSpy).toHaveBeenCalled();
  });
});
