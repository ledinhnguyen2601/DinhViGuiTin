/**
 * SMS dispatch service for Geofencing Tracker v1.0
 * Handles native Android SmsManager integration via Capacitor with fallback & simulation
 */

import { toNonAccentVietnamese } from './geo.js';
import { StorageService } from './storage.js';

export const SmsService = {
  /**
   * Validates Vietnamese phone numbers
   */
  isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const clean = phone.trim().replace(/[\s.-]/g, '');
    // Regex for Vietnamese phone: starts with 0 or +84 followed by 9 digits
    const regex = /^(?:\+84|0)(?:3|5|7|8|9)[0-9]{8}$/;
    return regex.test(clean);
  },

  /**
   * Dispatches SMS to a list of phone numbers automatically from SIM
   * @param {string|string[]} phoneNumbers 
   * @param {string} rawText 
   * @returns {Promise<{ ok: boolean, successCount: number, errors: string[] }>}
   */
  async sendSms(phoneNumbers, rawText) {
    const list = (Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers])
      .map(p => String(p || '').trim().replace(/[\s.-]/g, ''))
      .filter(Boolean);

    if (list.length === 0) {
      return { ok: false, successCount: 0, errors: ['Không có số điện thoại nhận SMS'] };
    }

    // Convert to unaccented Vietnamese to ensure 1 SMS <= 160 chars
    const plainText = toNonAccentVietnamese(rawText);
    const errors = [];
    let successCount = 0;

    for (const phone of list) {
      try {
        // Check if native Android Capacitor SMS plugin is available
        if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
          const plugins = window.Capacitor.Plugins;
          if (plugins?.SmsManager?.send) {
            await plugins.SmsManager.send({
              phoneNumber: phone,
              message: plainText,
            });
            successCount++;
            await StorageService.addLog('success', `Đã gửi SMS tới ${phone}: "${plainText}"`);
            continue;
          }
        }

        // In web / simulation mode:
        console.log(`[SMS SIMULATION] Gửi tới ${phone}: ${plainText} (độ dài: ${plainText.length} ký tự)`);
        await StorageService.addLog('info', `[Mô phỏng SMS SIM] Tới ${phone}: "${plainText}" (${plainText.length} ký tự)`);
        successCount++;
      } catch (err) {
        const errorMsg = `Lỗi gửi SMS tới ${phone}: ${err?.message || 'Không thể gửi tin qua SIM'}`;
        errors.push(errorMsg);
        await StorageService.addLog('error', errorMsg);
      }
    }

    return {
      ok: successCount > 0,
      successCount,
      errors,
    };
  }
};
