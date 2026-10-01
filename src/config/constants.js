/**
 * Constants & Configuration for Geofencing Tracker v1.0
 * Based on technical design specification by Dinh Nguyen
 */

export const EARTH_RADIUS_METERS = 6371000;

export const DEFAULT_SETTINGS = {
  travelerName: 'Đình Nguyên',
  destinationName: 'Nhà',
  destinationLat: 21.028511, // Default Hanoi coords or customizable
  destinationLng: 105.854444,
  radiusMeters: 100, // 50 - 500m (default 100m)
  roadFactor: 1.3, // 1.0 - 2.0 (default 1.3)
  sendMode: 'telegram_with_sms_fallback', // 'telegram_only' | 'telegram_with_sms_fallback' | 'sms_only'
  sendStartMessage: true,
  alwaysSendSms: false,
  maxTripHours: 12, // 1 - 24 hours
};

export const DEFAULT_SECRETS = {
  telegramBotToken: '',
  telegramChatId: '',
  backupPhone1: '',
  backupPhone2: '',
};

export const DISTANCE_FILTER_BANDS = [
  { minDistance: 5000, filter: 200, label: '> 5 km' },
  { minDistance: 1000, filter: 50, label: '1 - 5 km' },
  { minDistance: 0, filter: 15, label: '< 1 km' },
];

export const GPS_THRESHOLDS = {
  MAX_ACCURACY_METERS: 50, // Samples with accuracy > 50m discarded
  MAX_REALISTIC_SPEED_MPS: 60, // 216 km/h max
  SPEED_EMA_ALPHA: 0.3, // Exponential moving average smoothing factor
  MIN_MOVING_SPEED_KMH: 1.0, // Under 1 km/h considered 0
  MIN_SPEED_FOR_ETA_KMH: 5.0, // Under 5 km/h ETA displays '—'
  GEOFENCE_CONSECUTIVE_SAMPLES: 2, // Must meet criteria 2 consecutive times
  GEOFENCE_SAMPLE_MIN_INTERVAL_MS: 5000, // Samples must be at least 5s apart
  NO_GPS_WARNING_MS: 5 * 60 * 1000, // 5 minutes without GPS triggers warning
  LOW_BATTERY_THRESHOLD: 15, // 15%
};

export const RETRY_SCHEDULE = {
  TELEGRAM_RETRY_INTERVALS_MS: [0, 5000, 20000], // 0s, 5s, 20s
  SMS_FALLBACK_TIMEOUT_MS: 60000, // 60s
  BACKGROUND_RETRY_MAX_HOURS: 6,
  BACKGROUND_RETRY_INTERVALS_MIN: [1, 5, 15, 30, 60],
};

export const STORAGE_KEYS = {
  SETTINGS: 'geofence_settings',
  SECRETS: 'geofence_secrets',
  TRIP: 'geofence_current_trip',
  QUEUE: 'geofence_message_queue',
  LOGS: 'geofence_activity_logs',
};

export const MAX_LOG_ENTRIES = 200;

export const TRIP_STATES = {
  IDLE: 'IDLE',
  STARTING: 'STARTING',
  TRACKING: 'TRACKING',
  ARRIVED: 'ARRIVED',
  DONE: 'DONE',
  STOPPED: 'STOPPED',
  TIMEOUT: 'TIMEOUT',
};

export const MESSAGE_TEMPLATES = {
  START: (name, dest, distanceStr, etaMinutes) => 
    `${name} bắt đầu đi tới ${dest}. Còn khoảng ${distanceStr}, dự kiến ${etaMinutes} phút.`,
  ARRIVED_TELEGRAM: (name, dest, timeStr) => 
    `${name} đã đến ${dest} lúc ${timeStr}. Mọi thứ ổn.`,
  ARRIVED_SMS: (name, dest, timeStr) => 
    `${name} da den ${dest} luc ${timeStr}. (Tin tu dong tu app)`,
  ARRIVED_TELEGRAM_LATE: (name, dest, timeStr, smsTimeStr) => 
    `${name} đã đến ${dest} lúc ${timeStr}. (Tin gửi trễ, đã báo qua SMS lúc ${smsTimeStr})`,
  GPS_LOST: (name, minutes, distanceStr) => 
    `${name}: mất tín hiệu GPS ${minutes} phút. Vị trí cuối còn cách điểm đến khoảng ${distanceStr}.`,
  LOW_BATTERY: (name, percent) => 
    `Điện thoại của ${name} còn ${percent}% pin.`,
  TIMEOUT: (hours) => 
    `Hành trình đã tự dừng sau ${hours} giờ mà chưa đến nơi.`,
};
