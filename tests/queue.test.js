import { describe, it, expect, beforeEach } from 'vitest';
import { QueueService } from '../src/services/queue.js';
import { StorageService } from '../src/services/storage.js';

describe('Message Queue and Retry Scheduling', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('enqueues messages with unique ID and pending status', async () => {
    const item = await QueueService.enqueue({
      type: 'START',
      text: 'Bắt đầu đi',
      tripId: 'trip_1',
    });

    expect(item).toBeTruthy();
    expect(item.id).toContain('msg_start_');
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);

    const queue = await QueueService.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(item.id);
  });

  it('strictly prevents duplicate ARRIVED messages for the same trip', async () => {
    const item1 = await QueueService.enqueue({
      type: 'ARRIVED',
      text: 'Đã đến nơi',
      tripId: 'trip_100',
    });
    expect(item1).toBeTruthy();

    // Second attempt to enqueue ARRIVED for same trip
    const item2 = await QueueService.enqueue({
      type: 'ARRIVED',
      text: 'Đã đến nơi (trùng)',
      tripId: 'trip_100',
    });
    expect(item2).toBeNull(); // Rejected duplicate

    const queue = await QueueService.getQueue();
    expect(queue.length).toBe(1);
  });

  it('marks telegram success and updates status to sent', async () => {
    const item = await QueueService.enqueue({
      type: 'ARRIVED',
      text: 'Đã đến nơi',
      tripId: 'trip_101',
    });

    await QueueService.markTelegramSuccess(item.id);

    const queue = await QueueService.getQueue();
    expect(queue[0].telegramSent).toBe(true);
    expect(queue[0].status).toBe('sent');
  });

  it('marks SMS fallback as sent', async () => {
    const item = await QueueService.enqueue({
      type: 'ARRIVED',
      text: 'Đã đến nơi',
      tripId: 'trip_102',
    });

    await QueueService.markSmsFallbackSent(item.id);

    const queue = await QueueService.getQueue();
    expect(queue[0].smsSent).toBe(true);
    expect(queue[0].smsFallbackTriggered).toBe(true);
    expect(queue[0].status).toBe('fallback_sms_sent');
  });

  it('increments attempts on handleRetry and schedules next retry', async () => {
    const item = await QueueService.enqueue({
      type: 'ARRIVED',
      text: 'Đã đến nơi',
      tripId: 'trip_103',
    });

    const updated = await QueueService.handleRetry(item.id);
    expect(updated.attempts).toBe(1);
    expect(updated.nextRetryAt).toBeGreaterThan(Date.now() + 4000);
  });
});
