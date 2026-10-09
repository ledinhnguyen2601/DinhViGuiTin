import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { TelegramService } from '../src/services/telegram.js';
import fs from 'fs';
import path from 'path';

describe('SmartInput and Vietnamese IME / Backspace Readiness', () => {
  it('verifies capacitor.config.json has captureInput disabled to avoid swallowing Backspace', () => {
    const configPath = path.resolve(process.cwd(), 'capacitor.config.json');
    const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(content.android?.captureInput).toBe(false);
  });

  it('verifies AndroidManifest.xml contains windowSoftInputMode="adjustResize" for smooth keyboard input', () => {
    const manifestPath = path.resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml');
    const content = fs.readFileSync(manifestPath, 'utf8');
    expect(content).toContain('android:windowSoftInputMode="adjustResize"');
  });

  it('verifies SmartInput code does NOT suppress onChange with composition locks', () => {
    const componentPath = path.resolve(process.cwd(), 'src/components/SmartInput.jsx');
    const content = fs.readFileSync(componentPath, 'utf8');
    // Ensure we do not have the faulty composition blocker: if (!isComposingRef.current) { onChange(...) }
    expect(content).not.toContain('!isComposingRef.current');
    expect(content).toContain('onInput={handleInput}');
    expect(content).toContain('defaultValue=');
  });
});

describe('Telegram Bot Polling Resiliency', () => {
  it('handles getUpdates abort signal and fast timeout cleanly without throwing unhandled exceptions', async () => {
    const controller = new AbortController();
    // Simulate immediate abort
    controller.abort();

    const res = await TelegramService.getUpdates('dummy_token', 1, 5, controller.signal);
    expect(res.ok).toBe(false);
    expect(res.retryable).toBe(true);
  });

  it('validates useTelegramBot decouples polling from metrics.lastUpdated', () => {
    const hookPath = path.resolve(process.cwd(), 'src/hooks/useTelegramBot.js');
    const content = fs.readFileSync(hookPath, 'utf8');
    // Ensure metrics.lastUpdated is NOT in the useEffect dependency array
    expect(content).not.toContain('metrics.lastUpdated]');
    expect(content).toContain('App.addListener(\'appStateChange\'');
    expect(content).toContain('trackerRef.current');
  });
});
