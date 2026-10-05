import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService, validateSettings, validateSecrets } from '../src/services/storage.js';
import { DEFAULT_SETTINGS, DEFAULT_SECRETS } from '../src/config/constants.js';

describe('Settings Storage & Validation', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('saves and retrieves modified travelerName and destinationName', async () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      travelerName: 'Nguyễn Văn A',
      destinationName: 'Công ty FPT',
    };

    const saved = await StorageService.saveSettings(customSettings);
    expect(saved.travelerName).toBe('Nguyễn Văn A');
    expect(saved.destinationName).toBe('Công ty FPT');

    const retrieved = await StorageService.getSettings();
    expect(retrieved.travelerName).toBe('Nguyễn Văn A');
    expect(retrieved.destinationName).toBe('Công ty FPT');
  });

  it('validates empty travelerName or destinationName', () => {
    const invalid = validateSettings({
      travelerName: '',
      destinationName: '   ',
    });
    // Currently falls back to DEFAULT_SETTINGS
    expect(invalid.travelerName).toBe('');
    expect(invalid.destinationName).toBe('');
  });
});
