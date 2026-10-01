/**
 * Storage service for Geofencing Tracker v1.0
 * Uses Capacitor Preferences with localStorage fallback for cross-platform compatibility
 * Implements strict data validation and privacy/security guards
 */

import { Preferences } from '@capacitor/preferences';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SECRETS,
  STORAGE_KEYS,
  MAX_LOG_ENTRIES,
  TRIP_STATES
} from '../config/constants.js';

const memStore = new Map();

// Safe wrapper for Capacitor Preferences vs browser localStorage vs in-memory fallback
const safeStorage = {
  async get(key) {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null && value !== undefined) return value;
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch {}
    return memStore.has(key) ? memStore.get(key) : null;
  },

  async set(key, value) {
    try {
      await Preferences.set({ key, value });
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
    memStore.set(key, String(value));
  },

  async remove(key) {
    try {
      await Preferences.remove({ key });
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
    memStore.delete(key);
  },

  async clear() {
    try {
      await Preferences.clear();
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {}
    memStore.clear();
  }
};

/**
 * Validates and sanitizes settings object
 */
export function validateSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };

  return {
    travelerName: (typeof raw.travelerName === 'string' && raw.travelerName.trim()) 
      ? raw.travelerName.trim().slice(0, 30) 
      : DEFAULT_SETTINGS.travelerName,
    destinationName: (typeof raw.destinationName === 'string' && raw.destinationName.trim()) 
      ? raw.destinationName.trim().slice(0, 50) 
      : DEFAULT_SETTINGS.destinationName,
    destinationLat: (typeof raw.destinationLat === 'number' && !isNaN(raw.destinationLat) && raw.destinationLat >= -90 && raw.destinationLat <= 90)
      ? raw.destinationLat
      : DEFAULT_SETTINGS.destinationLat,
    destinationLng: (typeof raw.destinationLng === 'number' && !isNaN(raw.destinationLng) && raw.destinationLng >= -180 && raw.destinationLng <= 180)
      ? raw.destinationLng
      : DEFAULT_SETTINGS.destinationLng,
    radiusMeters: (typeof raw.radiusMeters === 'number' && raw.radiusMeters >= 50 && raw.radiusMeters <= 500)
      ? Math.round(raw.radiusMeters)
      : DEFAULT_SETTINGS.radiusMeters,
    roadFactor: (typeof raw.roadFactor === 'number' && raw.roadFactor >= 1.0 && raw.roadFactor <= 2.0)
      ? raw.roadFactor
      : DEFAULT_SETTINGS.roadFactor,
    sendMode: ['telegram_only', 'telegram_with_sms_fallback', 'sms_only'].includes(raw.sendMode)
      ? raw.sendMode
      : DEFAULT_SETTINGS.sendMode,
    sendStartMessage: typeof raw.sendStartMessage === 'boolean'
      ? raw.sendStartMessage
      : DEFAULT_SETTINGS.sendStartMessage,
    alwaysSendSms: typeof raw.alwaysSendSms === 'boolean'
      ? raw.alwaysSendSms
      : DEFAULT_SETTINGS.alwaysSendSms,
    maxTripHours: (typeof raw.maxTripHours === 'number' && raw.maxTripHours >= 1 && raw.maxTripHours <= 24)
      ? Math.round(raw.maxTripHours)
      : DEFAULT_SETTINGS.maxTripHours,
  };
}

/**
 * Validates secrets (Bot Token, Chat ID, Backup phone numbers)
 */
export function validateSecrets(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SECRETS };

  return {
    telegramBotToken: typeof raw.telegramBotToken === 'string' ? raw.telegramBotToken.trim() : '',
    telegramChatId: typeof raw.telegramChatId === 'string' || typeof raw.telegramChatId === 'number'
      ? String(raw.telegramChatId).trim()
      : '',
    backupPhone1: typeof raw.backupPhone1 === 'string' ? raw.backupPhone1.trim().replace(/[^0-9+]/g, '') : '',
    backupPhone2: typeof raw.backupPhone2 === 'string' ? raw.backupPhone2.trim().replace(/[^0-9+]/g, '') : '',
  };
}

export const StorageService = {
  async getSettings() {
    try {
      const data = await safeStorage.get(STORAGE_KEYS.SETTINGS);
      if (!data) return { ...DEFAULT_SETTINGS };
      return validateSettings(JSON.parse(data));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  async saveSettings(settings) {
    const valid = validateSettings(settings);
    await safeStorage.set(STORAGE_KEYS.SETTINGS, JSON.stringify(valid));
    return valid;
  },

  async getSecrets() {
    try {
      const data = await safeStorage.get(STORAGE_KEYS.SECRETS);
      if (!data) return { ...DEFAULT_SECRETS };
      return validateSecrets(JSON.parse(data));
    } catch {
      return { ...DEFAULT_SECRETS };
    }
  },

  async saveSecrets(secrets) {
    const valid = validateSecrets(secrets);
    await safeStorage.set(STORAGE_KEYS.SECRETS, JSON.stringify(valid));
    return valid;
  },

  async getTripState() {
    try {
      const data = await safeStorage.get(STORAGE_KEYS.TRIP);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  async saveTripState(state) {
    if (!state) {
      await safeStorage.remove(STORAGE_KEYS.TRIP);
      return;
    }
    await safeStorage.set(STORAGE_KEYS.TRIP, JSON.stringify(state));
  },

  async clearTripState() {
    await safeStorage.remove(STORAGE_KEYS.TRIP);
  },

  async getQueue() {
    try {
      const data = await safeStorage.get(STORAGE_KEYS.QUEUE);
      if (!data) return [];
      const list = JSON.parse(data);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  async saveQueue(queue) {
    const safeQueue = Array.isArray(queue) ? queue : [];
    await safeStorage.set(STORAGE_KEYS.QUEUE, JSON.stringify(safeQueue));
  },

  async getLogs() {
    try {
      const data = await safeStorage.get(STORAGE_KEYS.LOGS);
      if (!data) return [];
      const list = JSON.parse(data);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  /**
   * Adds an entry to activity logs.
   * STRICT SECURITY: Redacts any token occurrences and preserves FIFO limit <= 200 lines
   */
  async addLog(level, message, details = null) {
    try {
      const logs = await this.getLogs();
      
      // Token redaction filter
      let sanitizedMessage = String(message || '');
      // Redact bot token pattern (e.g. 123456789:ABCdef...)
      sanitizedMessage = sanitizedMessage.replace(/\d{8,12}:[A-Za-z0-9_-]{30,45}/g, '[REDACTED_TOKEN]');

      const entry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: Date.now(),
        level: ['info', 'warn', 'error', 'success'].includes(level) ? level : 'info',
        message: sanitizedMessage,
        details: details ? JSON.stringify(details).replace(/\d{8,12}:[A-Za-z0-9_-]{30,45}/g, '[REDACTED_TOKEN]') : null,
      };

      logs.unshift(entry); // Newest first

      // Keep max 200 entries
      if (logs.length > MAX_LOG_ENTRIES) {
        logs.splice(MAX_LOG_ENTRIES);
      }

      await safeStorage.set(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      return entry;
    } catch (e) {
      console.error('Failed to write log', e);
    }
  },

  async clearLogs() {
    await safeStorage.remove(STORAGE_KEYS.LOGS);
  },

  async clearAll() {
    await safeStorage.clear();
  }
};
