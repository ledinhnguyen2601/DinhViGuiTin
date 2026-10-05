/**
 * Constants & Configuration for Geofencing Tracker v1.0
 * Based on technical design specification by Dinh Nguyen
 */

export const EARTH_RADIUS_METERS = 6371000;

// FR-02: Bán kính geofence mặc định là 100 m (không phải 50 m)
export const DEFAULT_RADIUS = 100;
export const DEFAULT_RADIUS_METERS = 100;

// NFR: Ngưỡng phi chức năng độ chính xác: "≤ 100 m với bán kính mặc định"
export const ACCURACY_THRESHOLD_NFR = '≤ 100 m với bán kính mặc định';
export const NFR_ACCURACY_THRESHOLD_METERS = 100;

export const DEFAULT_SETTINGS = {
  travelerName: 'Đình Nguyên',
  destinationName: 'Nhà',
  destinationLat: 21.028511, // Default Hanoi coords or customizable
  destinationLng: 105.854444,
  radiusMeters: DEFAULT_RADIUS, // FR-02: Bán kính geofence mặc định 100m (50 - 500m)
  roadFactor: 1.3, // 1.0 - 2.0 (default 1.3)
  sendMode: 'telegram_with_sms_fallback', // 'telegram_only' | 'telegram_with_sms_fallback' | 'sms_only'
  sendStartMessage: true,
  alwaysSendSms: false,
  maxTripHours: 12, // 1 - 24 hours
};

export const DEFAULT_SECRETS = {
  telegramBotToken: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TELEGRAM_BOT_TOKEN) || '',
  telegramChatId: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TELEGRAM_CHAT_ID) || '',
  discordWebhookUrl: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DISCORD_WEBHOOK_URL) || '',
  backupPhone1: '',
  backupPhone2: '',
};

export const DISTANCE_FILTER_BANDS = [
  { minDistance: 5000, filter: 200, label: '> 5 km' },
  { minDistance: 1000, filter: 50, label: '1 - 5 km' },
  { minDistance: 0, filter: 15, label: '< 1 km' },
];

export const GPS_THRESHOLDS = {
  MAX_ACCURACY_METERS: 50, // Điều kiện mẫu GPS hợp lệ <= 50m
  ACCURACY_THRESHOLD_NFR: 100, // NFR: Ngưỡng phi chức năng độ chính xác ≤ 100 m với bán kính mặc định
  MAX_REALISTIC_SPEED_MPS: 60, // 216 km/h max
  SPEED_EMA_ALPHA: 0.3, // Exponential moving average smoothing factor
  MIN_MOVING_SPEED_KMH: 1.0, // Under 1 km/h considered 0
  MIN_SPEED_FOR_ETA_KMH: 5.0, // Under 5 km/h ETA displays '—'
  GEOFENCE_CONSECUTIVE_SAMPLES: 2, // Phải đạt 2 mẫu liên tiếp cách nhau >= 5s
  GEOFENCE_SAMPLE_MIN_INTERVAL_MS: 5000, // Các mẫu cách nhau ít nhất 5s
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
  TRIP: 'trip', // C.5: Lưu bền vào Capacitor Preferences với key "trip"
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
    smsTimeStr
      ? `${name} đã đến ${dest} lúc ${timeStr}. (tin gửi trễ, đã báo SMS lúc ${smsTimeStr})`
      : `${name} đã đến ${dest} lúc ${timeStr}. (tin gửi trễ, đã báo SMS)`,
  GPS_LOST: (name, minutes, distanceStr) => 
    `${name}: mất tín hiệu GPS ${minutes} phút. Vị trí cuối còn cách điểm đến khoảng ${distanceStr}.`,
  LOW_BATTERY: (name, percent) => 
    `Điện thoại của ${name} còn ${percent}% pin.`,
  TIMEOUT: (hours) => 
    `Hành trình đã tự dừng sau ${hours} giờ mà chưa đến nơi.`,
};

export const NOTIFICATION_CHANNELS = {
  TELEGRAM: 'telegram',
  DISCORD:  'discord',
  SMS:      'sms',
};

export const DISCORD_DEFAULTS = {
  USERNAME: 'Geofencing Tracker',   // tên hiển thị trong Discord
  AVATAR_URL: '',                    // để trống, dùng avatar mặc định
};
