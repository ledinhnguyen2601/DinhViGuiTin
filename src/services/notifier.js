/**
 * Notification Coordinator (Notifier) for Geofencing Tracker v1.0
 * Implements primary Telegram dispatch, multi-stage retry, and automatic SMS fallback
 */

import { TelegramService } from './telegram.js';
import { SmsService } from './sms.js';
import { sendDiscordMessage } from './discord.js';
import { QueueService } from './queue.js';
import { StorageService } from './storage.js';
import { MESSAGE_TEMPLATES, RETRY_SCHEDULE } from '../config/constants.js';
import { formatTime, formatDistance } from './geo.js';

export const NotifierService = {
  /**
   * Dispatches start notification
   */
  async notifyStart({ settings, secrets, distanceMeters, etaMinutes, tripId }) {
    if (!settings.sendStartMessage) return;

    const distStr = formatDistance(distanceMeters);
    const etaStr = etaMinutes ? String(etaMinutes) : '—';
    const text = MESSAGE_TEMPLATES.START(
      settings.travelerName,
      settings.destinationName,
      distStr,
      etaStr
    );

    await StorageService.addLog('info', `Gửi tin bắt đầu hành trình: "${text}"`);

    const mode = settings.chedoGui || settings.sendMode;
    if (mode === 'discord' || mode === 'discord_with_sms_fallback') {
      if (secrets.discordWebhookUrl) {
        const res = await sendDiscordMessage(secrets.discordWebhookUrl, text);
        if (res.ok) {
          await StorageService.addLog('success', 'Đã gửi thông báo xuất phát qua Discord');
        } else {
          await StorageService.addLog('warn', `Không thể gửi tin xuất phát qua Discord: ${res.error}`);
        }
      }
      return;
    }

    // START messages only go through Telegram
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      const res = await TelegramService.sendMessage(
        secrets.telegramBotToken,
        secrets.telegramChatId,
        text
      );
      if (res.ok) {
        await StorageService.addLog('success', 'Đã gửi thông báo xuất phát qua Telegram');
      } else {
        await StorageService.addLog('warn', `Không thể gửi tin xuất phát: ${res.message || res.error}`);
      }
    }
  },

  /**
   * Dispatches arrived notification with strict retry, deduplication and SMS fallback
   */
  async notifyArrived({ settings, secrets, tripId, arrivalTime = Date.now() }) {
    const timeStr = formatTime(arrivalTime);
    const tgText = MESSAGE_TEMPLATES.ARRIVED_TELEGRAM(
      settings.travelerName,
      settings.destinationName,
      timeStr
    );
    const smsText = MESSAGE_TEMPLATES.ARRIVED_SMS(
      settings.travelerName,
      settings.destinationName,
      timeStr
    );

    const currentMode = settings.chedoGui || settings.sendMode;

    // Enqueue to persistent queue (ensures only 1 arrived message per trip)
    const queueItem = await QueueService.enqueue({
      type: 'ARRIVED',
      text: tgText,
      channel: currentMode,
      tripId,
      meta: {
        arrivalTime,
        timeStr,
        smsText,
      }
    });

    if (!queueItem) {
      // Already queued or processed
      return { duplicate: true };
    }

    await StorageService.addLog('info', `Phát hiện đã đến nơi! Đang kích hoạt tiến trình gửi tin...`);

    const phones = [secrets.backupPhone1, secrets.backupPhone2].filter(Boolean);

    // Mode: SMS Only
    if (currentMode === 'sms_only') {
      const smsRes = await SmsService.sendSms(phones, smsText);
      if (smsRes.ok) {
        await QueueService.markSmsFallbackSent(queueItem.id);
      }
      return { ok: smsRes.ok, channel: 'sms' };
    }

    // Always send SMS option enabled by user
    if (settings.alwaysSendSms && phones.length > 0) {
      SmsService.sendSms(phones, smsText);
    }

    // Mode (d): Discord + SMS dự phòng
    if (currentMode === 'discord' || currentMode === 'discord_with_sms_fallback') {
      if (secrets.discordWebhookUrl) {
        const discordRes = await sendDiscordMessage(secrets.discordWebhookUrl, tgText);
        if (discordRes.ok) {
          await QueueService.markTelegramSuccess(queueItem.id);
          await StorageService.addLog('success', 'Đã báo tin đến nơi qua Discord thành công!');
          return { ok: true, channel: 'discord' };
        } else {
          await StorageService.addLog('warn', `Discord lần 1 thất bại (${discordRes.error}). Lên lịch thử lại...`);
          await QueueService.handleRetry(queueItem.id);
        }
      } else {
        await StorageService.addLog('warn', 'Chưa cấu hình Discord Webhook URL.');
      }

      return await this.executeDiscordFallbackWorkflow(queueItem, settings, secrets, phones);
    }

    // Attempt 1 for Telegram
    let telegramSuccess = false;
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      const tgRes = await TelegramService.sendMessage(
        secrets.telegramBotToken,
        secrets.telegramChatId,
        tgText
      );

      if (tgRes.ok) {
        telegramSuccess = true;
        await QueueService.markTelegramSuccess(queueItem.id);
        await StorageService.addLog('success', `Đã báo tin đến nơi qua Telegram tới nhóm thành công!`);
        return { ok: true, channel: 'telegram' };
      } else {
        await StorageService.addLog('warn', `Telegram lần 1 thất bại (${tgRes.message}). Lên lịch thử lại...`);
        await QueueService.handleRetry(queueItem.id, tgRes.retryAfter);
      }
    } else {
      await StorageService.addLog('warn', 'Chưa cấu hình Telegram Bot Token hoặc Chat ID.');
    }

    // If Telegram failed or not configured, initiate fallback flow
    return await this.executeFallbackWorkflow(queueItem, settings, secrets, phones);
  },

  /**
   * Handles retry schedule and 60-second SMS fallback
   * T+0s  -> gửi Telegram lần 1 (đã gọi ở notifyArrived)
   * T+5s  -> nếu lỗi, thử lần 2
   * T+20s -> nếu vẫn lỗi, thử lần 3
   * T+60s -> nếu chưa có ok=true, gửi SMS (1 lần duy nhất)
   * Sau đó -> thử lại Telegram theo lịch lùi dần 1->5->15 phút, tối đa 6 giờ;
   *           nếu gửi được ghi rõ "tin gửi trễ, đã báo SMS"
   */
  async executeFallbackWorkflow(queueItem, settings, secrets, phones, customDelays = null) {
    const mode = settings.chedoGui || settings.sendMode || queueItem.channel;
    if (mode === 'discord' || mode === 'discord_with_sms_fallback') {
      return await this.executeDiscordFallbackWorkflow(queueItem, settings, secrets, phones, customDelays);
    }

    const { smsText, timeStr } = queueItem.meta;
    const delay2 = customDelays?.retry2 ?? 5000; // T+5s
    const delay3 = customDelays?.retry3 ?? 15000; // T+20s (5s + 15s)
    const delaySms = customDelays?.smsFallback ?? (customDelays ? 0 : 40000); // T+60s (20s + 40s)

    const canUseSms = settings.sendMode === 'telegram_with_sms_fallback' && phones.length > 0;

    // T+5s: Thử lần 2 nếu lần 1 lỗi
    if (delay2 > 0) await new Promise((resolve) => setTimeout(resolve, delay2));
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      const retry2 = await TelegramService.sendMessage(
        secrets.telegramBotToken,
        secrets.telegramChatId,
        queueItem.text
      );
      if (retry2.ok) {
        await QueueService.markTelegramSuccess(queueItem.id);
        await StorageService.addLog('success', 'Telegram lần 2 (T+5s) thành công!');
        return { ok: true, channel: 'telegram' };
      }
      await QueueService.handleRetry(queueItem.id, retry2.retryAfter);
    }

    // T+20s: Thử lần 3 nếu lần 2 vẫn lỗi
    if (delay3 > 0) await new Promise((resolve) => setTimeout(resolve, delay3));
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      const retry3 = await TelegramService.sendMessage(
        secrets.telegramBotToken,
        secrets.telegramChatId,
        queueItem.text
      );
      if (retry3.ok) {
        await QueueService.markTelegramSuccess(queueItem.id);
        await StorageService.addLog('success', 'Telegram lần 3 (T+20s) thành công!');
        return { ok: true, channel: 'telegram' };
      }
      await QueueService.handleRetry(queueItem.id, retry3.retryAfter);
    }

    // T+60s: Nếu chưa có ok=true, gửi SMS (1 lần duy nhất)
    if (delaySms > 0) await new Promise((resolve) => setTimeout(resolve, delaySms));
    if (canUseSms && !queueItem.smsFallbackTriggered) {
      await StorageService.addLog(
        'warn',
        'Telegram chưa nhận tin sau 60s (3 lần thử). Tự động gửi SMS dự phòng từ SIM (1 lần duy nhất)...'
      );
      const smsRes = await SmsService.sendSms(phones, smsText);
      if (smsRes.ok) {
        await QueueService.markSmsFallbackSent(queueItem.id);
        queueItem.smsFallbackTriggered = true;
        await StorageService.addLog('success', 'SMS dự phòng đã gửi thành công tới người thân!');
      }
    }

    // Sau đó: Thử lại Telegram theo lịch lùi dần 1->5->15 phút, tối đa 6 giờ; nếu gửi được ghi rõ "tin gửi trễ, đã báo SMS"
    this.scheduleBackgroundTelegramRetry(queueItem, settings, secrets, customDelays?.backgroundSchedule);

    return {
      ok: queueItem.smsFallbackTriggered,
      channel: queueItem.smsFallbackTriggered ? 'sms_fallback' : 'pending_retry',
    };
  },

  /**
   * Background retry for Telegram with note that SMS was already sent
   * Thử lại Telegram theo lịch lùi dần 1->5->15 phút, tối đa 6 giờ;
   * Ghi rõ "tin gửi trễ, đã báo SMS"
   */
  scheduleBackgroundTelegramRetry(queueItem, settings, secrets, customSchedule = null) {
    if (!secrets.telegramBotToken || !secrets.telegramChatId) return;

    // Run detached background retries: 1 -> 5 -> 15 -> 30 -> 60 min, up to 6 hours max
    (async () => {
      const intervalsMin = customSchedule?.intervalsMin ?? [1, 5, 15, 30, 60, 60, 60, 60, 60];
      const maxHours = customSchedule?.maxHours ?? RETRY_SCHEDULE.BACKGROUND_RETRY_MAX_HOURS;
      const startTime = Date.now();
      const maxDurationMs = maxHours * 3600 * 1000;

      for (const mins of intervalsMin) {
        if (Date.now() - startTime >= maxDurationMs) {
          await StorageService.addLog('warn', 'Hết thời gian tối đa 6 giờ thử lại Telegram.');
          break;
        }

        const waitMs = customSchedule ? (mins * 10) : (mins * 60 * 1000);
        await new Promise((res) => setTimeout(res, waitMs));

        if (Date.now() - startTime >= maxDurationMs) {
          break;
        }

        const lateText = MESSAGE_TEMPLATES.ARRIVED_TELEGRAM_LATE(
          settings.travelerName,
          settings.destinationName,
          queueItem.meta.timeStr
        );

        const res = await TelegramService.sendMessage(
          secrets.telegramBotToken,
          secrets.telegramChatId,
          lateText
        );

        if (res.ok) {
          await QueueService.markTelegramSuccess(queueItem.id);
          await StorageService.addLog(
            'success',
            `Tin Telegram gửi bù đã vào nhóm thành công (tin gửi trễ, đã báo SMS)!`
          );
          break;
        }
      }
    })().catch(() => {});
  },

  /**
   * Handles Discord retry schedule and 60-second SMS fallback
   * T+0s  -> gửi Discord lần 1 (đã gọi ở notifyArrived)
   * T+5s  -> nếu lỗi, thử lần 2
   * T+20s -> nếu vẫn lỗi, thử lần 3
   * T+60s -> nếu chưa có ok=true, gửi SMS (1 lần duy nhất)
   * Sau đó -> thử lại Discord theo lịch lùi dần 1->5->15 phút, tối đa 6 giờ;
   *           nếu gửi được ghi rõ "tin gửi trễ, đã báo SMS"
   */
  async executeDiscordFallbackWorkflow(queueItem, settings, secrets, phones, customDelays = null) {
    const { smsText } = queueItem.meta;
    const delay2 = customDelays?.retry2 ?? 5000; // T+5s
    const delay3 = customDelays?.retry3 ?? 15000; // T+20s (5s + 15s)
    const delaySms = customDelays?.smsFallback ?? (customDelays ? 0 : 40000); // T+60s (20s + 40s)

    const canUseSms = phones.length > 0;

    // T+5s: Thử lần 2 nếu lần 1 lỗi
    if (delay2 > 0) await new Promise((resolve) => setTimeout(resolve, delay2));
    if (secrets.discordWebhookUrl) {
      const retry2 = await sendDiscordMessage(secrets.discordWebhookUrl, queueItem.text);
      if (retry2.ok) {
        await QueueService.markTelegramSuccess(queueItem.id);
        await StorageService.addLog('success', 'Discord lần 2 (T+5s) thành công!');
        return { ok: true, channel: 'discord' };
      }
      await QueueService.handleRetry(queueItem.id);
    }

    // T+20s: Thử lần 3 nếu lần 2 vẫn lỗi
    if (delay3 > 0) await new Promise((resolve) => setTimeout(resolve, delay3));
    if (secrets.discordWebhookUrl) {
      const retry3 = await sendDiscordMessage(secrets.discordWebhookUrl, queueItem.text);
      if (retry3.ok) {
        await QueueService.markTelegramSuccess(queueItem.id);
        await StorageService.addLog('success', 'Discord lần 3 (T+20s) thành công!');
        return { ok: true, channel: 'discord' };
      }
      await QueueService.handleRetry(queueItem.id);
    }

    // T+60s: Nếu chưa có ok=true, gửi SMS (1 lần duy nhất)
    if (delaySms > 0) await new Promise((resolve) => setTimeout(resolve, delaySms));
    if (canUseSms && !queueItem.smsFallbackTriggered) {
      await StorageService.addLog(
        'warn',
        'Discord chưa nhận tin sau 60s (3 lần thử). Tự động gửi SMS dự phòng từ SIM (1 lần duy nhất)...'
      );
      const smsRes = await SmsService.sendSms(phones, smsText);
      if (smsRes.ok) {
        await QueueService.markSmsFallbackSent(queueItem.id);
        queueItem.smsFallbackTriggered = true;
        await StorageService.addLog('success', 'SMS dự phòng đã gửi thành công tới người thân!');
      }
    }

    // Sau đó: Thử lại Discord theo lịch lùi dần 1->5->15 phút, tối đa 6 giờ; nếu gửi được ghi rõ "tin gửi trễ, đã báo SMS"
    this.scheduleBackgroundDiscordRetry(queueItem, settings, secrets, customDelays?.backgroundSchedule);

    return {
      ok: queueItem.smsFallbackTriggered,
      channel: queueItem.smsFallbackTriggered ? 'sms_fallback' : 'pending_retry',
    };
  },

  /**
   * Background retry for Discord with note that SMS was already sent
   */
  scheduleBackgroundDiscordRetry(queueItem, settings, secrets, customSchedule = null) {
    if (!secrets.discordWebhookUrl) return;

    (async () => {
      const intervalsMin = customSchedule?.intervalsMin ?? [1, 5, 15, 30, 60, 60, 60, 60, 60];
      const maxHours = customSchedule?.maxHours ?? RETRY_SCHEDULE.BACKGROUND_RETRY_MAX_HOURS;
      const startTime = Date.now();
      const maxDurationMs = maxHours * 3600 * 1000;

      for (const mins of intervalsMin) {
        if (Date.now() - startTime >= maxDurationMs) {
          await StorageService.addLog('warn', 'Hết thời gian tối đa 6 giờ thử lại Discord.');
          break;
        }

        const waitMs = customSchedule ? (mins * 10) : (mins * 60 * 1000);
        await new Promise((res) => setTimeout(res, waitMs));

        if (Date.now() - startTime >= maxDurationMs) {
          break;
        }

        const lateText = MESSAGE_TEMPLATES.ARRIVED_TELEGRAM_LATE(
          settings.travelerName,
          settings.destinationName,
          queueItem.meta.timeStr
        );

        const res = await sendDiscordMessage(secrets.discordWebhookUrl, lateText);

        if (res.ok) {
          await QueueService.markTelegramSuccess(queueItem.id);
          await StorageService.addLog(
            'success',
            'Tin Discord gửi bù đã gửi thành công (tin gửi trễ, đã báo SMS)!'
          );
          break;
        }
      }
    })().catch(() => {});
  },

  /**
   * Dispatches GPS Lost warning
   */
  async notifyGpsLost({ settings, secrets, minutes, distanceMeters }) {
    const distStr = formatDistance(distanceMeters);
    const text = MESSAGE_TEMPLATES.GPS_LOST(settings.travelerName, minutes, distStr);
    await StorageService.addLog('warn', `Cảnh báo mất GPS: "${text}"`);
    const mode = settings.chedoGui || settings.sendMode;
    if (mode === 'discord' || mode === 'discord_with_sms_fallback') {
      if (secrets.discordWebhookUrl) {
        await sendDiscordMessage(secrets.discordWebhookUrl, text);
      }
      return;
    }
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      await TelegramService.sendMessage(secrets.telegramBotToken, secrets.telegramChatId, text);
    }
  },

  /**
   * Dispatches Low Battery warning
   */
  async notifyLowBattery({ settings, secrets, percent }) {
    const text = MESSAGE_TEMPLATES.LOW_BATTERY(settings.travelerName, percent);
    await StorageService.addLog('warn', `Cảnh báo pin yếu: "${text}"`);
    const mode = settings.chedoGui || settings.sendMode;
    if (mode === 'discord' || mode === 'discord_with_sms_fallback') {
      if (secrets.discordWebhookUrl) {
        await sendDiscordMessage(secrets.discordWebhookUrl, text);
      }
      return;
    }
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      await TelegramService.sendMessage(secrets.telegramBotToken, secrets.telegramChatId, text);
    }
  },

  /**
   * Dispatches Timeout warning
   */
  async notifyTimeout({ settings, secrets, hours }) {
    const text = MESSAGE_TEMPLATES.TIMEOUT(hours);
    await StorageService.addLog('warn', `Chuyến đi quá giờ tối đa: "${text}"`);
    const mode = settings.chedoGui || settings.sendMode;
    if (mode === 'discord' || mode === 'discord_with_sms_fallback') {
      if (secrets.discordWebhookUrl) {
        await sendDiscordMessage(secrets.discordWebhookUrl, text);
      }
      return;
    }
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      await TelegramService.sendMessage(secrets.telegramBotToken, secrets.telegramChatId, text);
    }
  }
};

