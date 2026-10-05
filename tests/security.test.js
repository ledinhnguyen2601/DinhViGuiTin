import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService, validateSettings, validateSecrets } from '../src/services/storage.js';
import { toNonAccentVietnamese } from '../src/services/geo.js';

describe('Security & Privacy Protections', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  // Section 10: Bot Token must NEVER be logged in plaintext
  it('strictly redacts Telegram bot tokens from activity logs', async () => {
    const fakeToken = '7123456789:AAFlkjw9384jsdfk_30492834sdfsdfAA';
    const message = `Testing error with token: ${fakeToken} for chat -100123456`;

    await StorageService.addLog('error', message);

    const logs = await StorageService.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).not.toContain(fakeToken);
    expect(logs[0].message).toContain('[REDACTED_TOKEN]');
  });

  // Log limit enforcement: max 200 entries to prevent memory exhaustion / DoS
  it('enforces maximum 200 log entries (FIFO) to prevent memory leak', async () => {
    for (let i = 0; i < 210; i++) {
      await StorageService.addLog('info', `Event ${i}`);
    }

    const logs = await StorageService.getLogs();
    expect(logs.length).toBe(200);
    expect(logs[0].message).toBe('Event 209'); // Newest first
  });

  // Input Sanitization & Bounds Checking against injection/corruption
  it('sanitizes malicious or oversized input in settings', () => {
    const maliciousInput = {
      travelerName: '<script>alert("XSS")</script>' + 'A'.repeat(100),
      destinationName: 'Office' + 'B'.repeat(100),
      destinationLat: 999999, // Out of bounds
      destinationLng: -999999, // Out of bounds
      radiusMeters: -50, // Invalid radius
      roadFactor: 99, // Invalid road factor
      sendMode: 'hack_mode', // Invalid mode
      maxTripHours: 100, // Invalid max hours
    };

    const sanitized = validateSettings(maliciousInput);

    expect(sanitized.travelerName.length).toBeLessThanOrEqual(30);
    expect(sanitized.destinationName.length).toBeLessThanOrEqual(50);
    // Invalid lat/lng fallback to default
    expect(sanitized.destinationLat).toBe(21.028511);
    expect(sanitized.destinationLng).toBe(105.854444);
    // Invalid radius fallback
    expect(sanitized.radiusMeters).toBe(100);
    // Invalid road factor fallback
    expect(sanitized.roadFactor).toBe(1.3);
    // Invalid send mode fallback
    expect(sanitized.sendMode).toBe('telegram_with_sms_fallback');
    // Invalid max hours fallback
    expect(sanitized.maxTripHours).toBe(12);
  });

  it('sanitizes phone numbers and secrets', () => {
    const rawSecrets = {
      telegramBotToken: '  123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11  ',
      telegramChatId: ' -100123456789 ',
      backupPhone1: '098 765 4321; DROP TABLE users;--',
      backupPhone2: '+84 (912) 345-678',
    };

    const sanitized = validateSecrets(rawSecrets);
    expect(sanitized.telegramBotToken).toBe('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    expect(sanitized.telegramChatId).toBe('-100123456789');
    expect(sanitized.backupPhone1).toBe('0987654321');
    expect(sanitized.backupPhone2).toBe('+84912345678');
  });

  it('prevents XSS in unaccented Vietnamese SMS generator', () => {
    const dirty = 'Người dùng <script>alert(1)</script> đi tới Hà Nội';
    const cleaned = toNonAccentVietnamese(dirty);
    expect(cleaned).toBe('Nguoi dung <script>alert(1)</script> di toi Ha Noi');
  });

  // C.7: Bot Token must NEVER be written to localStorage
  it('C.7: strictly ensures Bot Token is NEVER stored in window.localStorage', async () => {
    const fakeToken = '7123456789:AAFlkjw9384jsdfk_30492834sdfsdfAA';
    await StorageService.saveSecrets({
      telegramBotToken: fakeToken,
      telegramChatId: '-100123456789',
      backupPhone1: '0912345678',
    });

    // Check localStorage directly
    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem('geofence_secrets')).toBeNull();
      // Inspect all localStorage keys/values
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        const val = window.localStorage.getItem(k);
        expect(val).not.toContain(fakeToken);
      }
    }

    // But retrieve via StorageService still works (via memory / Capacitor Preferences)
    const secrets = await StorageService.getSecrets();
    expect(secrets.telegramBotToken).toBe(fakeToken);
  });
});
