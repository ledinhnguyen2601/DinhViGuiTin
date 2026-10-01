/**
 * Persistent Message Queue for Geofencing Tracker v1.0
 * Provides robust retry scheduling, exponential backoff, and SMS fallback tracking
 */

import { StorageService } from './storage.js';
import { RETRY_SCHEDULE } from '../config/constants.js';

export const QueueService = {
  /**
   * Retrieves current queue from persistent storage
   */
  async getQueue() {
    return await StorageService.getQueue();
  },

  /**
   * Adds a message to the persistent queue with strict deduplication
   * @param {Object} item { type, text, channel, tripId, meta }
   * @returns {Promise<Object|null>} queued item or null if duplicate
   */
  async enqueue({ type, text, channel = 'telegram', tripId = 'default', meta = {} }) {
    const queue = await this.getQueue();

    // Deduplication check: only one 'ARRIVED' message allowed per trip
    if (type === 'ARRIVED') {
      const existing = queue.find(
        (m) => m.type === 'ARRIVED' && m.tripId === tripId && m.status !== 'failed'
      );
      if (existing) {
        return null; // Prevent duplicate
      }
    }

    const item = {
      id: `msg_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      text,
      channel,
      tripId,
      meta,
      createdAt: Date.now(),
      attempts: 0,
      nextRetryAt: Date.now(),
      status: 'pending', // 'pending' | 'sent' | 'fallback_sms_sent' | 'failed'
      telegramSent: false,
      smsSent: false,
      smsFallbackTriggered: false,
    };

    queue.push(item);
    await StorageService.saveQueue(queue);
    return item;
  },

  /**
   * Marks Telegram as sent for an item
   */
  async markTelegramSuccess(id) {
    const queue = await this.getQueue();
    const item = queue.find((m) => m.id === id);
    if (!item) return;

    item.telegramSent = true;
    item.status = 'sent';
    await StorageService.saveQueue(queue);
  },

  /**
   * Marks SMS fallback as sent for an item
   */
  async markSmsFallbackSent(id) {
    const queue = await this.getQueue();
    const item = queue.find((m) => m.id === id);
    if (!item) return;

    item.smsSent = true;
    item.smsFallbackTriggered = true;
    if (item.status !== 'sent') {
      item.status = 'fallback_sms_sent';
    }
    await StorageService.saveQueue(queue);
  },

  /**
   * Updates retry schedule after failure
   */
  async handleRetry(id, retryAfterSeconds = null) {
    const queue = await this.getQueue();
    const item = queue.find((m) => m.id === id);
    if (!item) return;

    item.attempts += 1;
    const now = Date.now();

    // If Telegram API returned a 429 Retry-After header, use it
    if (retryAfterSeconds) {
      item.nextRetryAt = now + retryAfterSeconds * 1000;
      await StorageService.saveQueue(queue);
      return item;
    }

    // Attempt index determines delay
    const intervals = RETRY_SCHEDULE.TELEGRAM_RETRY_INTERVALS_MS;
    if (item.attempts < intervals.length) {
      item.nextRetryAt = now + intervals[item.attempts];
    } else {
      // Exponential backoff for background retries (1m, 5m, 15m, 30m, 60m...)
      const bgIndex = Math.min(
        item.attempts - intervals.length,
        RETRY_SCHEDULE.BACKGROUND_RETRY_INTERVALS_MIN.length - 1
      );
      const minutes = RETRY_SCHEDULE.BACKGROUND_RETRY_INTERVALS_MIN[bgIndex];
      item.nextRetryAt = now + minutes * 60 * 1000;
    }

    // If exceeded 6 hours of background retries, mark failed
    const maxRetryAgeMs = RETRY_SCHEDULE.BACKGROUND_RETRY_MAX_HOURS * 3600 * 1000;
    if (now - item.createdAt > maxRetryAgeMs) {
      item.status = 'failed';
    }

    await StorageService.saveQueue(queue);
    return item;
  },

  /**
   * Checks if an arrived message was ever queued or sent for this trip
   */
  async hasArrivedMessage(tripId = 'default') {
    const queue = await this.getQueue();
    return queue.some((m) => m.type === 'ARRIVED' && m.tripId === tripId);
  },

  /**
   * Cleans completed items older than 24 hours
   */
  async pruneCompleted() {
    const queue = await this.getQueue();
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const remaining = queue.filter(
      (m) => m.status === 'pending' || m.createdAt > cutoff
    );
    await StorageService.saveQueue(remaining);
  },

  async clearQueue() {
    await StorageService.saveQueue([]);
  }
};
