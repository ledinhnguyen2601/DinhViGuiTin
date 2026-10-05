/**
 * useTracker Hook for Geofencing Tracker v1.0
 * Connects UI with TripMachine, LocationService, NotifierService and StorageService
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TripMachine } from '../state/tripMachine.js';
import { LocationService } from '../services/location.js';
import { NotifierService } from '../services/notifier.js';
import { StorageService } from '../services/storage.js';
import { TelegramService } from '../services/telegram.js';
import { SmsService } from '../services/sms.js';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { TRIP_STATES, DEFAULT_SETTINGS, DEFAULT_SECRETS } from '../config/constants.js';

export function useTracker() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [secrets, setSecrets] = useState(DEFAULT_SECRETS);
  const [tripState, setTripState] = useState(TRIP_STATES.IDLE);
  const [metrics, setMetrics] = useState({
    speedKmh: 0,
    distanceMeters: null,
    etaMinutes: null,
    accuracy: null,
    lastUpdated: null,
    filterBand: 15,
  });
  const [gpsError, setGpsError] = useState(null);
  const [telegramStatus, setTelegramStatus] = useState('not_configured'); // 'connected' | 'not_configured' | 'error'
  const [deviceInfo, setDeviceInfo] = useState({
    battery: null, // percentage
    isCharging: false,
    networkType: 'unknown', // 'wifi', 'cellular', 'none', etc.
    isConnected: true
  });

  const machineRef = useRef(null);

  // Initialize and load persistent state on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const storedSettings = await StorageService.getSettings();
      const storedSecrets = await StorageService.getSecrets();
      const storedTrip = await StorageService.getTripState();

      if (!isMounted) return;

      setSettings(storedSettings);
      setSecrets(storedSecrets);

      // Evaluate initial Telegram status
      if (storedSecrets.telegramBotToken && storedSecrets.telegramChatId) {
        setTelegramStatus('connected');
      } else {
        setTelegramStatus('not_configured');
      }

      // Create TripMachine instance
      const machine = new TripMachine({
        settings: storedSettings,
        secrets: storedSecrets,
        onStateChange: (newState) => {
          if (isMounted) setTripState(newState);
        },
        onMetricsUpdate: (newMetrics) => {
          if (isMounted) setMetrics(newMetrics);
        },
      });

      // Restore active trip if app was re-opened (FR-16)
      if (storedTrip && [TRIP_STATES.TRACKING, TRIP_STATES.STARTING, TRIP_STATES.ARRIVED].includes(storedTrip.state)) {
        machine.restoreFrom(storedTrip);
        // Resume GPS watcher if it was tracking
        if (storedTrip.state === TRIP_STATES.TRACKING) {
          startWatchingGps(machine, storedSettings);
        }
      }

      machineRef.current = machine;
    }

    init();

    // Track Device Info (Battery & Network)
    let deviceInterval;
    const updateDeviceInfo = async () => {
      try {
        const [bat, net] = await Promise.all([
          Device.getBatteryInfo().catch(() => ({})),
          Network.getStatus().catch(() => ({}))
        ]);
        if (!isMounted) return;
        setDeviceInfo({
          battery: bat.batteryLevel !== undefined ? Math.round(bat.batteryLevel * 100) : null,
          isCharging: bat.isCharging || false,
          networkType: net.connectionType || 'unknown',
          isConnected: net.connected ?? true
        });
      } catch (e) {}
    };
    
    updateDeviceInfo();
    deviceInterval = setInterval(updateDeviceInfo, 10000); // Update every 10s

    const networkListener = Network.addListener('networkStatusChange', (status) => {
      if (!isMounted) return;
      setDeviceInfo(prev => ({
        ...prev,
        networkType: status.connectionType,
        isConnected: status.connected
      }));
    });

    return () => {
      isMounted = false;
      clearInterval(deviceInterval);
      if (networkListener.remove) networkListener.remove();
      LocationService.stopWatching();
    };
  }, []);

  // Internal helper to start GPS watcher and pipe samples into tripMachine
  const startWatchingGps = useCallback(async (machine, currentSettings) => {
    setGpsError(null);
    try {
      await LocationService.startWatching(
        {
          distanceFilter: machine.currentFilterBand,
          destinationName: currentSettings.destinationName,
        },
        async (sample) => {
          setGpsError(null);
          const result = await machine.handleGpsUpdate(sample);

          // If arrived, trigger arrival notification
          if (result.arrived) {
            await LocationService.stopWatching();
            await NotifierService.notifyArrived({
              settings: currentSettings,
              secrets: machine.secrets,
              tripId: machine.tripId,
              arrivalTime: Date.now(),
            });
            await machine.finish();
          }

          // If distance band changed, adjust distanceFilter
          if (result.filterChanged && result.newFilter) {
            await LocationService.updateDistanceFilter(
              result.newFilter,
              currentSettings.destinationName
            );
          }
        },
        (err) => {
          console.warn('GPS Watch Error', err);
          setGpsError(err.message || 'Lỗi nhận tín hiệu GPS');
          StorageService.addLog('warn', `Lỗi GPS: ${err.message || 'Không có tín hiệu'}`);
        }
      );
    } catch (e) {
      setGpsError(e.message || 'Không thể bật GPS');
      await StorageService.addLog('error', `Lỗi khởi động định vị: ${e.message}`);
    }
  }, []);

  /**
   * Starts trip
   */
  const startTrip = useCallback(async () => {
    if (!machineRef.current) return;
    const machine = machineRef.current;
    machine.settings = settings;
    machine.secrets = secrets;

    const started = await machine.start();
    if (!started) return;

    // Check GPS permissions
    const perm = await LocationService.checkPermissions();
    if (perm.location === 'denied') {
      setGpsError('Chưa cấp quyền truy cập vị trí GPS.');
      await StorageService.addLog('error', 'Người dùng chưa cấp quyền truy cập vị trí.');
      await machine.reset();
      return;
    }

    // Attempt to get initial fix to calculate starting distance & ETA
    try {
      const initialPos = await LocationService.getCurrentPosition();
      await machine.handleGpsUpdate({
        ...initialPos,
        timestamp: Date.now(),
      });

      // Send start message via Telegram (if enabled)
      await NotifierService.notifyStart({
        settings,
        secrets,
        distanceMeters: machine.currentDistanceMeters || 0,
        etaMinutes: machine.currentEtaMinutes,
        tripId: machine.tripId,
      });
    } catch (e) {
      console.warn('Could not acquire initial fix for start message', e);
    }

    // Start background watcher & confirm tracking state
    await startWatchingGps(machine, settings);
    await machine.confirmTracking();
  }, [settings, secrets, startWatchingGps]);

  /**
   * Stops trip
   */
  const stopTrip = useCallback(async () => {
    if (!machineRef.current) return;
    await LocationService.stopWatching();
    await machineRef.current.stop();
  }, []);

  /**
   * Resets trip
   */
  const resetTrip = useCallback(async () => {
    if (!machineRef.current) return;
    await LocationService.stopWatching();
    await machineRef.current.reset();
    setMetrics({
      speedKmh: 0,
      distanceMeters: null,
      etaMinutes: null,
      accuracy: null,
      lastUpdated: null,
      filterBand: 15,
    });
  }, []);

  /**
   * Updates and saves settings
   */
  const updateSettings = useCallback(async (newSettings) => {
    const saved = await StorageService.saveSettings(newSettings);
    setSettings(saved);
    if (machineRef.current) {
      machineRef.current.settings = saved;
    }
    return saved;
  }, []);

  /**
   * Updates and saves secrets
   */
  const updateSecrets = useCallback(async (newSecrets) => {
    const saved = await StorageService.saveSecrets(newSecrets);
    setSecrets(saved);
    if (machineRef.current) {
      machineRef.current.secrets = saved;
    }
    if (saved.telegramBotToken && saved.telegramChatId) {
      setTelegramStatus('connected');
    } else {
      setTelegramStatus('not_configured');
    }
    return saved;
  }, []);

  /**
   * Tests Telegram Bot connection
   */
  const testTelegramConnection = useCallback(async () => {
    if (!secrets.telegramBotToken) {
      return { ok: false, message: 'Vui lòng nhập Bot Token trước' };
    }
    const res = await TelegramService.getMe(secrets.telegramBotToken);
    if (res.ok) {
      setTelegramStatus('connected');
      await StorageService.addLog('success', `Kiểm tra Telegram thành công (Bot: @${res.botInfo.username})`);
    } else {
      setTelegramStatus('error');
      await StorageService.addLog('error', `Kiểm tra Telegram thất bại: ${res.message}`);
    }
    return res;
  }, [secrets.telegramBotToken]);

  /**
   * Sends test message to Telegram
   */
  const sendTestTelegram = useCallback(async () => {
    if (!secrets.telegramBotToken || !secrets.telegramChatId) {
      return { ok: false, message: 'Chưa đủ Bot Token hoặc Chat ID' };
    }
    const text = `🔔 <b>Kiểm tra kết nối Geofencing Tracker</b>\nTin nhắn thử nghiệm lúc ${new Date().toLocaleTimeString('vi-VN')}. Kết nối hoạt động tốt!`;
    const res = await TelegramService.sendMessage(
      secrets.telegramBotToken,
      secrets.telegramChatId,
      text
    );
    if (res.ok) {
      await StorageService.addLog('success', 'Đã gửi tin nhắn thử nghiệm tới nhóm Telegram!');
    } else {
      await StorageService.addLog('error', `Gửi tin thử nghiệm Telegram thất bại: ${res.message}`);
    }
    return res;
  }, [secrets.telegramBotToken, secrets.telegramChatId]);

  /**
   * Sends test SMS
   */
  const sendTestSms = useCallback(async () => {
    const phones = [secrets.backupPhone1, secrets.backupPhone2].filter(Boolean);
    if (phones.length === 0) {
      return { ok: false, message: 'Chưa nhập số điện thoại nhận SMS' };
    }
    const text = `Kiem tra Geofencing Tracker: Tin thu nghiem thanh cong luc ${new Date().toLocaleTimeString('vi-VN')}.`;
    const res = await SmsService.sendSms(phones, text);
    return res;
  }, [secrets.backupPhone1, secrets.backupPhone2]);

  return {
    settings,
    secrets,
    tripState,
    metrics,
    gpsError,
    telegramStatus,
    startTrip,
    stopTrip,
    resetTrip,
    updateSettings,
    updateSecrets,
    testTelegramConnection,
    sendTestTelegram,
    sendTestSms,
    deviceInfo,
  };
}
