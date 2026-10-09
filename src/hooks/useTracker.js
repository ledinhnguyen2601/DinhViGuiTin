import { useState, useEffect, useRef, useCallback } from 'react';
import { TripMachine } from '../state/tripMachine.js';
import { LocationService } from '../services/location.js';
import { NotifierService } from '../services/notifier.js';
import { StorageService } from '../services/storage.js';
import { TelegramService } from '../services/telegram.js';
import { SmsService } from '../services/sms.js';
import { haversine } from '../services/geo.js';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';
import { TRIP_STATES, DEFAULT_SETTINGS, DEFAULT_SECRETS } from '../config/constants.js';

export function useTracker() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [secrets, setSecrets] = useState(DEFAULT_SECRETS);
  const [savedDestinations, setSavedDestinations] = useState([]);
  const [tripState, setTripState] = useState(TRIP_STATES.IDLE);
  const [metrics, setMetrics] = useState({
    speedKmh: 0,
    distanceMeters: null,
    etaMinutes: null,
    accuracy: null,
    lat: null,
    lng: null,
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
  const proximityTimerRef = useRef(null);

  // Initialize and load persistent state on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const storedSettings = await StorageService.getSettings();
      const storedSecrets = await StorageService.getSecrets();
      const storedTrip = await StorageService.getTripState();
      let storedSaved = await StorageService.getSavedDestinations();

      if (!isMounted) return;

      // Seed default saved destination from initial settings if empty
      if (storedSaved.length === 0 && storedSettings.destinationName) {
        const seed = await StorageService.addSavedDestination({
          name: storedSettings.destinationName,
          lat: storedSettings.destinationLat,
          lng: storedSettings.destinationLng,
        });
        storedSaved = [seed];
      }
      setSavedDestinations(storedSaved);

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
          if (isMounted) {
            setMetrics((prev) => ({
              ...prev,
              ...newMetrics,
            }));
          }
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

      // Pre-warm GPS immediately on launch so coordinates & distance are ready right away
      try {
        LocationService.getCurrentPosition().then((pos) => {
          if (!isMounted || !pos) return;
          const dist = haversine(pos.lat, pos.lng, storedSettings.destinationLat, storedSettings.destinationLng);
          setMetrics((prev) => ({
            ...prev,
            accuracy: pos.accuracy,
            lat: pos.lat,
            lng: pos.lng,
            distanceMeters: Math.round(dist),
            lastUpdated: pos.timestamp || Date.now(),
          }));
        }).catch((err) => {
          console.warn('Initial GPS warm-up skipped:', err?.message);
        });
      } catch {}
    }

    init();

    // Tự động cập nhật GPS khi app resume / mở lại màn hình
    const handleAppActive = () => {
      if (isMounted) {
        LocationService.getCurrentPosition()
          .then((pos) => {
            if (!isMounted || !pos) return;
            const currentSettings = machineRef.current?.settings || settings;
            const dist = haversine(
              pos.lat,
              pos.lng,
              currentSettings.destinationLat,
              currentSettings.destinationLng
            );
            setMetrics((prev) => ({
              ...prev,
              accuracy: pos.accuracy,
              lat: pos.lat,
              lng: pos.lng,
              distanceMeters: Math.round(dist),
              lastUpdated: pos.timestamp || Date.now(),
            }));
            setGpsError(null);
          })
          .catch(() => {});
      }
    };

    let appResumeHandle = null;
    App.addListener('appStateChange', (state) => {
      if (state.isActive && isMounted) {
        handleAppActive();
      }
    })
      .then((h) => {
        appResumeHandle = h;
      })
      .catch(() => {});

    const onVisChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        handleAppActive();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);

    // Quét định kỳ vị trí nhẹ nhàng (mỗi 12s) khi app mở ở màn hình chính (IDLE)
    // Giúp tọa độ và khoảng cách luôn luôn tươi mới mà không cần ấn nút tròn tải lại
    const foregroundGpsInterval = setInterval(() => {
      if (!isMounted) return;
      if (!machineRef.current || machineRef.current.state === TRIP_STATES.IDLE) {
        LocationService.getCurrentPosition()
          .then((pos) => {
            if (!isMounted || !pos) return;
            const currentSettings = machineRef.current?.settings || settings;
            const dist = haversine(
              pos.lat,
              pos.lng,
              currentSettings.destinationLat,
              currentSettings.destinationLng
            );
            setMetrics((prev) => ({
              ...prev,
              accuracy: pos.accuracy,
              lat: pos.lat,
              lng: pos.lng,
              distanceMeters: Math.round(dist),
              lastUpdated: pos.timestamp || Date.now(),
            }));
            setGpsError(null);
          })
          .catch(() => {});
      }
    }, 12000);

    // Track Device Info (Battery & Network)
    let deviceInterval;
    const updateDeviceInfo = async () => {
      try {
        const [bat, net] = await Promise.all([
          Device.getBatteryInfo().catch(() => ({})),
          Network.getStatus().catch(() => ({})),
        ]);
        if (!isMounted) return;
        setDeviceInfo({
          battery: bat.batteryLevel !== undefined ? Math.round(bat.batteryLevel * 100) : null,
          isCharging: bat.isCharging || false,
          networkType: net.connectionType || 'unknown',
          isConnected: net.connected ?? true,
        });
      } catch (e) {}
    };

    updateDeviceInfo();
    deviceInterval = setInterval(updateDeviceInfo, 10000); // Update every 10s

    const networkListener = Network.addListener('networkStatusChange', (status) => {
      if (!isMounted) return;
      setDeviceInfo((prev) => ({
        ...prev,
        networkType: status.connectionType,
        isConnected: status.connected,
      }));
    });

    return () => {
      isMounted = false;
      clearInterval(deviceInterval);
      clearInterval(foregroundGpsInterval);
      if (appResumeHandle?.remove) appResumeHandle.remove();
      document.removeEventListener('visibilitychange', onVisChange);
      if (networkListener.remove) networkListener.remove();
      if (proximityTimerRef.current) clearTimeout(proximityTimerRef.current);
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
            if (proximityTimerRef.current) {
              clearTimeout(proximityTimerRef.current);
              proximityTimerRef.current = null;
            }
            await LocationService.stopWatching();
            await NotifierService.notifyArrived({
              settings: currentSettings,
              secrets: machine.secrets,
              tripId: machine.tripId,
              arrivalTime: Date.now(),
            });
            await machine.finish();
            return;
          }

          // If inside geofence but waiting for 2nd confirmation sample (e.g. stopped at 4m)
          if (result.insideGeofencePending && !proximityTimerRef.current) {
            proximityTimerRef.current = setTimeout(async () => {
              proximityTimerRef.current = null;
              try {
                const freshSample = await LocationService.getCurrentPosition();
                if (machine.state === TRIP_STATES.TRACKING) {
                  const check = await machine.handleGpsUpdate(freshSample);
                  if (check.arrived) {
                    await LocationService.stopWatching();
                    await NotifierService.notifyArrived({
                      settings: currentSettings,
                      secrets: machine.secrets,
                      tripId: machine.tripId,
                      arrivalTime: Date.now(),
                    });
                    await machine.finish();
                  }
                }
              } catch (e) {
                console.warn('Proximity recheck failed', e);
              }
            }, 5500);
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

  /**
   * Adds a new saved destination bookmark
   */
  const addSavedDestination = useCallback(async (dest) => {
    const created = await StorageService.addSavedDestination(dest);
    const updated = await StorageService.getSavedDestinations();
    setSavedDestinations(updated);
    return created;
  }, []);

  /**
   * Removes a saved destination bookmark
   */
  const removeSavedDestination = useCallback(async (id) => {
    const updated = await StorageService.removeSavedDestination(id);
    setSavedDestinations(updated);
    return updated;
  }, []);

  /**
   * Selects a saved destination as current target
   */
  const selectSavedDestination = useCallback(async (dest) => {
    if (!dest) return;
    const newSettings = {
      ...settings,
      destinationName: dest.name,
      destinationLat: dest.lat,
      destinationLng: dest.lng,
    };
    await updateSettings(newSettings);

    // Recompute distance to selected destination immediately if GPS fix available
    const lastPos = LocationService.getLastKnownPosition() || (metrics.lat && metrics.lng ? { lat: metrics.lat, lng: metrics.lng } : null);
    if (lastPos && lastPos.lat && lastPos.lng) {
      const dist = haversine(lastPos.lat, lastPos.lng, dest.lat, dest.lng);
      setMetrics((prev) => ({
        ...prev,
        distanceMeters: Math.round(dist),
      }));
    }
    await StorageService.addLog('info', `Đã chuyển điểm đến sang: ${dest.name}`);
  }, [settings, updateSettings, metrics.lat, metrics.lng]);

  /**
   * Forces an immediate GPS check and recalculates metrics
   */
  const refreshCurrentPosition = useCallback(async () => {
    try {
      const pos = await LocationService.getCurrentPosition();
      const dist = haversine(pos.lat, pos.lng, settings.destinationLat, settings.destinationLng);
      setMetrics((prev) => ({
        ...prev,
        accuracy: pos.accuracy,
        lat: pos.lat,
        lng: pos.lng,
        distanceMeters: Math.round(dist),
        lastUpdated: pos.timestamp || Date.now(),
      }));
      return pos;
    } catch (e) {
      console.warn('Refresh position error', e);
      return null;
    }
  }, [settings.destinationLat, settings.destinationLng]);

  return {
    settings,
    secrets,
    savedDestinations,
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
    addSavedDestination,
    removeSavedDestination,
    selectSavedDestination,
    refreshCurrentPosition,
    deviceInfo,
  };
}
