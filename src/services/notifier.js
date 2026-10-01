/**
 * Notification Coordinator (Notifier) for Geofencing Tracker v1.0
 * Implements primary Telegram dispatch, multi-stage retry, and automatic SMS fallback
 */

import { TelegramService } from './telegram.js';
import { SmsService } from './sms.js';
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

    // Enqueue to persistent queue (ensures only 1 arrived message per trip)
    const queueItem = await QueueService.enqueue({
      type: 'ARRIVED',
      text: tgText,
      channel: settings.sendMode,
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
    if (settings.sendMode === 'sms_only') {
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
   */
  async executeFallbackWorkflow(queueItem, settings, secrets, phones, customDelays = null) {
    const { smsText, timeStr } = queueItem.meta;
    const delay2 = customDelays?.retry2 ?? 5000;
    const delay3 = customDelays?.retry3 ?? 15000;

    // Fast-track SMS if mode requires SMS fallback and Telegram cannot be reached or token invalid
    const canUseSms = settings.sendMode === 'telegram_with_sms_fallback' && phones.length > 0;

    // Retry 2 after 5 seconds
    if (delay2 > 0) await new Promise((resolve) => setTimeout(resolve, delay2));
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      const retry2 = await TelegramService.sendMessage(
        secrets.telegramBotToken,
        secrets.telegramChatId,
        queueItem.text
      );
      if (retry2.ok) {
        await QueueService.markTelegramSuccess(queueItem.id);
        await StorageService.addLog('success', 'Telegram lần 2 thành công!');
        return { ok: true, channel: 'telegram' };
      }
      await QueueService.handleRetry(queueItem.id, retry2.retryAfter);
    }

    // Retry 3 after 15 seconds (total ~20s)
    if (delay3 > 0) await new Promise((resolve) => setTimeout(resolve, delay3));
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      const retry3 = await TelegramService.sendMessage(
        secrets.telegramBotToken,
        secrets.telegramChatId,
        queueItem.text
      );
      if (retry3.ok) {
        await QueueService.markTelegramSuccess(queueItem.id);
        await StorageService.addLog('success', 'Telegram lần 3 thành công!');
        return { ok: true, channel: 'telegram' };
      }
      await QueueService.handleRetry(queueItem.id, retry3.retryAfter);
    }

    // At T+60s (or when 3 retries failed): Trigger SMS Fallback!
    if (canUseSms && !queueItem.smsFallbackTriggered) {
      await StorageService.addLog(
        'warn',
        'Telegram chưa nhận tin sau các lần thử. Tự động kích hoạt SMS dự phòng từ SIM...'
      );
      const smsRes = await SmsService.sendSms(phones, smsText);
      if (smsRes.ok) {
        await QueueService.markSmsFallbackSent(queueItem.id);
        queueItem.smsFallbackTriggered = true;
        await StorageService.addLog('success', 'SMS dự phòng đã gửi thành công tới người thân!');
      }
    }

    // Background asynchronous retry for Telegram if internet restores
    this.scheduleBackgroundTelegramRetry(queueItem, settings, secrets);

    return {
      ok: queueItem.smsFallbackTriggered,
      channel: queueItem.smsFallbackTriggered ? 'sms_fallback' : 'pending_retry',
    };
  },

  /**
   * Background retry for Telegram with note that SMS was already sent
   */
  scheduleBackgroundTelegramRetry(queueItem, settings, secrets) {
    if (!secrets.telegramBotToken || !secrets.telegramChatId) return;

    // Run detached background retries
    (async () => {
      const delayMinutes = [1, 5, 15, 30];
      for (const mins of delayMinutes) {
        await new Promise((res) => setTimeout(res, mins * 60 * 1000));
        
        const nowTimeStr = formatTime();
        const lateText = MESSAGE_TEMPLATES.ARRIVED_TELEGRAM_LATE(
          settings.travelerName,
          settings.destinationName,
          queueItem.meta.timeStr,
          nowTimeStr
        );

        const res = await TelegramService.sendMessage(
          secrets.telegramBotToken,
          secrets.telegramChatId,
          lateText
        );

        if (res.ok) {
          await QueueService.markTelegramSuccess(queueItem.id);
          await StorageService.addLog('success', `Tin Telegram gửi bù (trễ) đã vào nhóm lúc ${nowTimeStr}!`);
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
    if (secrets.telegramBotToken && secrets.telegramChatId) {
      await TelegramService.sendMessage(secrets.telegramBotToken, secrets.telegramChatId, text);
    }
  }
};
