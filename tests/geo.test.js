import { describe, it, expect } from 'vitest';
import {
  haversine,
  msToKmh,
  filterGpsSample,
  smoothSpeed,
  calculateEtaMinutes,
  checkGeofenceArrival,
  getDistanceFilterBand,
  toNonAccentVietnamese,
  formatDistance,
} from '../src/services/geo.js';

describe('Geo calculations and noise immunity', () => {
  // TC-01: Haversine distance verification
  it('TC-01: Haversine calculates correct distance (~1000.8m for 0.009 deg lat change)', () => {
    const lat1 = 21.0000;
    const lon1 = 105.0000;
    const lat2 = 21.0090;
    const lon2 = 105.0000;

    const dist = haversine(lat1, lon1, lat2, lon2);
    // Theoretical: 0.009 * (pi / 180) * 6,371,000 = 1000.75m
    expect(dist).toBeCloseTo(1000.8, 0); // Difference < 1m
    expect(Math.abs(dist - 1000.8)).toBeLessThan(1.0);
  });

  // TC-02: Speed conversion
  it('TC-02: msToKmh converts 11.11 m/s to ~40 km/h', () => {
    const kmh = msToKmh(11.11);
    expect(kmh).toBeCloseTo(39.996, 1);
    expect(Math.round(kmh)).toBe(40);
  });

  // TC-03: Two consecutive samples inside radius separated by >= 5s trigger ARRIVED
  it('TC-03: triggers arrival after 2 consecutive valid samples inside radius separated by >= 5s', () => {
    const targetLat = 21.0285;
    const targetLng = 105.8544;
    const radius = 100;

    const sample1 = {
      lat: 21.0286,
      lng: 105.8545, // distance ~15m
      accuracy: 10,
      timestamp: 10000,
    };

    const sample2 = {
      lat: 21.02855,
      lng: 105.85445, // distance ~8m
      accuracy: 8,
      timestamp: 16000, // 6s later
    };

    // First sample alone shouldn't trigger without prior history
    const arrivedSample1 = checkGeofenceArrival(sample1, [], targetLat, targetLng, radius);
    expect(arrivedSample1).toBe(false);

    // Second sample with sample1 in history (>5s apart) triggers arrival
    const arrivedSample2 = checkGeofenceArrival(sample2, [sample1], targetLat, targetLng, radius);
    expect(arrivedSample2).toBe(true);
  });

  // TC-04: Single anomaly jump inside radius then outside does NOT trigger
  it('TC-04: Single anomaly sample inside radius does NOT trigger arrival without 2nd sample >= 5s', () => {
    const targetLat = 21.0285;
    const targetLng = 105.8544;
    const radius = 100;

    // Previous sample was 2km away
    const farSample = {
      lat: 21.0400,
      lng: 105.8544,
      accuracy: 15,
      timestamp: 10000,
    };

    // Glitch sample momentarily inside radius
    const glitchSample = {
      lat: 21.0285,
      lng: 105.8544,
      accuracy: 12,
      timestamp: 12000, // only 2s later
    };

    const isArrived = checkGeofenceArrival(glitchSample, [farSample], targetLat, targetLng, radius);
    expect(isArrived).toBe(false);
  });

  // TC-05: Sample within radius but accuracy 120m is rejected
  it('TC-05: Sample with accuracy > 50m (e.g. 120m) is rejected and does NOT trigger arrival', () => {
    const targetLat = 21.0285;
    const targetLng = 105.8544;
    const radius = 100;

    const lowAccSample = {
      lat: 21.0285,
      lng: 105.8544,
      accuracy: 120, // Low accuracy!
      timestamp: 10000,
    };

    const filterResult = filterGpsSample(lowAccSample);
    expect(filterResult.valid).toBe(false);
    expect(filterResult.reason).toContain('Accuracy too low');

    const isArrived = checkGeofenceArrival(lowAccSample, [], targetLat, targetLng, radius);
    expect(isArrived).toBe(false);
  });

  // Speed outlier detection
  it('rejects unrealistic speed jumps (> 60 m/s ~ 216 km/h)', () => {
    const sample1 = {
      lat: 21.0000,
      lng: 105.0000,
      accuracy: 10,
      timestamp: 10000,
    };

    const sample2 = {
      lat: 21.0200, // ~2.2 km away
      lng: 105.0000,
      accuracy: 10,
      timestamp: 12000, // in 2 seconds -> 1100 m/s (~4000 km/h)
    };

    const filterResult = filterGpsSample(sample2, sample1);
    expect(filterResult.valid).toBe(false);
    expect(filterResult.reason).toContain('Speed anomaly');
  });

  // EMA speed smoothing
  it('smoothes speed using EMA and zeroes out speeds < 1 km/h', () => {
    expect(smoothSpeed(0.5, 20)).toBe(0); // under 1 km/h -> 0
    expect(smoothSpeed(40, null)).toBe(40);
    // EMA with alpha=0.3: 0.3 * 40 + 0.7 * 20 = 12 + 14 = 26
    expect(smoothSpeed(40, 20, 0.3)).toBeCloseTo(26, 1);
  });

  // ETA calculation
  it('calculates ETA with road factor and returns null when speed < 5 km/h', () => {
    // 13 km straight line * 1.3 roadFactor = 16.9 km road distance
    // At 50.7 km/h -> 16.9 / 50.7 = 0.333 hours = 20 minutes
    const eta = calculateEtaMinutes(13000, 50.7, 1.3);
    expect(eta).toBe(20);

    // When stopped (< 5 km/h)
    const stoppedEta = calculateEtaMinutes(13000, 3.5, 1.3);
    expect(stoppedEta).toBeNull();
  });

  // Distance filter bands with hysteresis
  it('selects appropriate distanceFilter bands', () => {
    expect(getDistanceFilterBand(10000)).toBe(200); // > 5km
    expect(getDistanceFilterBand(3000)).toBe(50); // 1-5km
    expect(getDistanceFilterBand(500)).toBe(15); // < 1km
  });

  // TC-16: Unaccented Vietnamese text for SMS economy
  it('TC-16: toNonAccentVietnamese removes diacritics and fits single SMS', () => {
    const input = 'Đình Nguyên đã đến Nhà lúc 14:30. Mọi thứ ổn định.';
    const result = toNonAccentVietnamese(input);
    expect(result).toBe('Dinh Nguyen da den Nha luc 14:30. Moi thu on dinh.');
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('formats distance correctly in m and km', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(1250)).toBe('1.3 km');
    expect(formatDistance(12000)).toBe('12.0 km');
  });
});
