/**
 * Geographic and algorithmic computations for Geofencing Tracker v1.0
 * Pure functions designed for comprehensive unit testing
 */

import {
  EARTH_RADIUS_METERS,
  DEFAULT_RADIUS,
  GPS_THRESHOLDS,
  DISTANCE_FILTER_BANDS
} from '../config/constants.js';

/**
 * Calculates Great-Circle distance between two coordinates in meters using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in meters
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Converts meters per second to kilometers per hour
 * @param {number} mps 
 * @returns {number} km/h
 */
export function msToKmh(mps) {
  if (typeof mps !== 'number' || isNaN(mps) || mps < 0) return 0;
  return mps * 3.6;
}

/**
 * Filters GPS sample to reject outliers or degraded accuracy
 * @param {Object} sample { lat, lng, accuracy, speed, timestamp }
 * @param {Object|null} lastValidSample 
 * @returns {{ valid: boolean, reason?: string }}
 */
export function filterGpsSample(sample, lastValidSample = null) {
  if (!sample || typeof sample.lat !== 'number' || typeof sample.lng !== 'number') {
    return { valid: false, reason: 'Invalid coordinates' };
  }

  // Reject samples with accuracy worse than threshold
  const accuracy = typeof sample.accuracy === 'number' ? sample.accuracy : 999;
  if (accuracy > GPS_THRESHOLDS.MAX_ACCURACY_METERS) {
    return { valid: false, reason: `Accuracy too low (${accuracy.toFixed(1)}m > ${GPS_THRESHOLDS.MAX_ACCURACY_METERS}m)` };
  }

  // Check temporal and spatial consistency with last valid sample
  if (lastValidSample) {
    const timeDiffSeconds = Math.max(0.1, (sample.timestamp - lastValidSample.timestamp) / 1000);
    const distanceMeters = haversine(
      lastValidSample.lat,
      lastValidSample.lng,
      sample.lat,
      sample.lng
    );

    const impliedSpeedMps = distanceMeters / timeDiffSeconds;
    if (impliedSpeedMps > GPS_THRESHOLDS.MAX_REALISTIC_SPEED_MPS) {
      return { 
        valid: false, 
        reason: `Speed anomaly (${(impliedSpeedMps * 3.6).toFixed(1)} km/h exceeds realistic limit)` 
      };
    }
  }

  return { valid: true };
}

/**
 * Applies Exponential Moving Average (EMA) smoothing to speed
 * @param {number} currentRawSpeedKmh 
 * @param {number|null} lastSmoothedSpeedKmh 
 * @param {number} alpha EMA smoothing factor (0.3 default)
 * @returns {number} smoothed speed in km/h
 */
export function smoothSpeed(currentRawSpeedKmh, lastSmoothedSpeedKmh, alpha = GPS_THRESHOLDS.SPEED_EMA_ALPHA) {
  if (currentRawSpeedKmh < GPS_THRESHOLDS.MIN_MOVING_SPEED_KMH) {
    return 0;
  }
  if (lastSmoothedSpeedKmh === null || lastSmoothedSpeedKmh === undefined) {
    return currentRawSpeedKmh;
  }
  return alpha * currentRawSpeedKmh + (1 - alpha) * lastSmoothedSpeedKmh;
}

/**
 * Calculates Estimated Time of Arrival (ETA) in minutes
 * @param {number} distanceMeters Remaining distance
 * @param {number} smoothedSpeedKmh Current smoothed speed in km/h
 * @param {number} roadFactor Multiplier for road routing vs straight line (default 1.3)
 * @returns {number|null} Estimated minutes or null if stopped
 */
export function calculateEtaMinutes(distanceMeters, smoothedSpeedKmh, roadFactor = 1.3) {
  if (distanceMeters <= 0) return 0;
  if (!smoothedSpeedKmh || smoothedSpeedKmh < GPS_THRESHOLDS.MIN_SPEED_FOR_ETA_KMH) {
    return null; // When stopped/traffic light, ETA is undetermined
  }

  const effectiveDistanceKm = (distanceMeters * roadFactor) / 1000;
  const hours = effectiveDistanceKm / smoothedSpeedKmh;
  return Math.max(1, Math.round(hours * 60));
}

/**
 * Evaluates whether device has arrived in geofence with noise immunity (C.4)
 * Điều kiện "đã đến nơi" phải thỏa mãn đủ CẢ BA:
 * 1. Khoảng cách <= bán kính (mặc định 100 m)
 * 2. Độ chính xác GPS <= 50 m
 * 3. 2 mẫu liên tiếp cách nhau ít nhất 5 giây
 * 
 * @param {Object} currentSample { lat, lng, accuracy, timestamp }
 * @param {Array<Object>} historySamples recent valid samples (newest first)
 * @param {number} targetLat 
 * @param {number} targetLng 
 * @param {number} radiusMeters (mặc định 100 m - FR-02)
 * @returns {boolean}
 */
export function checkGeofenceArrival(currentSample, historySamples, targetLat, targetLng, radiusMeters = DEFAULT_RADIUS) {
  if (!currentSample || typeof currentSample.lat !== 'number' || typeof currentSample.lng !== 'number') {
    return false;
  }

  // Điều kiện 2: Độ chính xác GPS <= 50 m
  const currentAccuracy = typeof currentSample.accuracy === 'number' ? currentSample.accuracy : 999;
  if (currentAccuracy > GPS_THRESHOLDS.MAX_ACCURACY_METERS) {
    return false;
  }

  // Điều kiện 1: Khoảng cách <= bán kính (mặc định 100 m)
  const effectiveRadius = (typeof radiusMeters === 'number' && radiusMeters > 0) ? radiusMeters : DEFAULT_RADIUS;
  const currentDist = haversine(currentSample.lat, currentSample.lng, targetLat, targetLng);
  if (currentDist > effectiveRadius) {
    return false;
  }

  // Điều kiện 3: 2 mẫu liên tiếp cách nhau ít nhất 5 giây
  if (!Array.isArray(historySamples) || historySamples.length === 0) {
    return false;
  }

  for (const prev of historySamples) {
    if (prev === currentSample) continue;

    if (!prev || typeof prev.lat !== 'number' || typeof prev.lng !== 'number') {
      continue;
    }

    const prevAcc = typeof prev.accuracy === 'number' ? prev.accuracy : 999;
    if (prevAcc > GPS_THRESHOLDS.MAX_ACCURACY_METERS) {
      continue;
    }

    const prevDist = haversine(prev.lat, prev.lng, targetLat, targetLng);
    if (prevDist > effectiveRadius) {
      // Mẫu gần nhất ngoài bán kính -> chuỗi liên tiếp trong geofence bị ngắt
      return false;
    }

    const timeDiff = Math.abs(currentSample.timestamp - prev.timestamp);
    if (timeDiff >= GPS_THRESHOLDS.GEOFENCE_SAMPLE_MIN_INTERVAL_MS) {
      return true;
    }
  }

  return false;
}

/**
 * Determines optimal distanceFilter with hysteresis to prevent flapping
 * @param {number} distanceMeters 
 * @param {number|null} currentFilter 
 * @returns {number} recommended distanceFilter in meters
 */
export function getDistanceFilterBand(distanceMeters, currentFilter = null) {
  // Apply 10% hysteresis buffer if currentFilter is provided
  if (currentFilter === 200 && distanceMeters > 4500) return 200;
  if (currentFilter === 50 && distanceMeters >= 900 && distanceMeters <= 5500) return 50;
  if (currentFilter === 15 && distanceMeters < 1100) return 15;

  for (const band of DISTANCE_FILTER_BANDS) {
    if (distanceMeters >= band.minDistance) {
      return band.filter;
    }
  }
  return 15;
}

/**
 * Human-readable distance format
 * @param {number} meters 
 * @returns {string} e.g. "1.2 km" or "350 m"
 */
export function formatDistance(meters) {
  if (typeof meters !== 'number' || isNaN(meters)) return '—';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format timestamp to HH:mm (24-hour)
 * @param {number|Date} dateOrTimestamp 
 * @returns {string} e.g. "14:30"
 */
export function formatTime(dateOrTimestamp = Date.now()) {
  const d = new Date(dateOrTimestamp);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Converts Vietnamese accented characters to plain ASCII for SMS economy (<= 160 chars)
 * @param {string} str 
 * @returns {string} unaccented string
 */
export function toNonAccentVietnamese(str) {
  if (!str) return '';
  let res = str;
  res = res.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  res = res.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  res = res.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  res = res.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  res = res.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  res = res.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  res = res.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  res = res.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  res = res.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  res = res.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  res = res.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  res = res.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  res = res.replace(/đ/g, 'd');
  res = res.replace(/Đ/g, 'D');
  // Some system encodings
  res = res.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, '');
  res = res.replace(/\u02C6|\u0306|\u031B/g, '');
  return res;
}
