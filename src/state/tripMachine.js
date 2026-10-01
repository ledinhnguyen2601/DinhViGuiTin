/**
 * Trip State Machine for Geofencing Tracker v1.0
 * Manages trip lifecycle, transitions, noise-immune arrival detection, and state restoration
 */

import { TRIP_STATES } from '../config/constants.js';
import { StorageService } from '../services/storage.js';
import {
  haversine,
  msToKmh,
  smoothSpeed,
  calculateEtaMinutes,
  checkGeofenceArrival,
  getDistanceFilterBand,
  filterGpsSample,
} from '../services/geo.js';

export class TripMachine {
  constructor({ settings, secrets, onStateChange = () => {}, onMetricsUpdate = () => {} }) {
    this.settings = settings;
    this.secrets = secrets;
    this.onStateChange = onStateChange;
    this.onMetricsUpdate = onMetricsUpdate;

    this.state = TRIP_STATES.IDLE;
    this.tripId = null;
    this.startedAt = null;
    this.arrivedNotified = false;
    this.lastSample = null;
    this.recentValidSamples = []; // For noise immunity check
    this.smoothedSpeedKmh = 0;
    this.currentDistanceMeters = null;
    this.currentEtaMinutes = null;
    this.currentFilterBand = 200;
    this.lastGpsTimestamp = null;
    this.gpsLostWarningSent = false;
    this.lowBatteryWarningSent = false;
  }

  /**
   * Serializes current machine state for persistence
   */
  toJSON() {
    return {
      state: this.state,
      tripId: this.tripId,
      startedAt: this.startedAt,
      arrivedNotified: this.arrivedNotified,
      lastSample: this.lastSample,
      smoothedSpeedKmh: this.smoothedSpeedKmh,
      currentDistanceMeters: this.currentDistanceMeters,
      currentEtaMinutes: this.currentEtaMinutes,
      currentFilterBand: this.currentFilterBand,
      lastGpsTimestamp: this.lastGpsTimestamp,
      gpsLostWarningSent: this.gpsLostWarningSent,
      lowBatteryWarningSent: this.lowBatteryWarningSent,
    };
  }

  /**
   * Restores state from persistence (FR-16)
   */
  restoreFrom(data) {
    if (!data) return;
    this.state = data.state || TRIP_STATES.IDLE;
    this.tripId = data.tripId || null;
    this.startedAt = data.startedAt || null;
    this.arrivedNotified = Boolean(data.arrivedNotified);
    this.lastSample = data.lastSample || null;
    this.smoothedSpeedKmh = data.smoothedSpeedKmh || 0;
    this.currentDistanceMeters = data.currentDistanceMeters ?? null;
    this.currentEtaMinutes = data.currentEtaMinutes ?? null;
    this.currentFilterBand = data.currentFilterBand || 200;
    this.lastGpsTimestamp = data.lastGpsTimestamp || null;
    this.gpsLostWarningSent = Boolean(data.gpsLostWarningSent);
    this.lowBatteryWarningSent = Boolean(data.lowBatteryWarningSent);

    this.emitStateChange();
  }

  async persist() {
    await StorageService.saveTripState(this.toJSON());
  }

  emitStateChange() {
    this.onStateChange(this.state, this.toJSON());
  }

  emitMetricsUpdate() {
    this.onMetricsUpdate({
      state: this.state,
      speedKmh: Math.round(this.smoothedSpeedKmh),
      distanceMeters: this.currentDistanceMeters,
      etaMinutes: this.currentEtaMinutes,
      accuracy: this.lastSample?.accuracy ?? null,
      lastUpdated: this.lastGpsTimestamp,
      filterBand: this.currentFilterBand,
    });
  }

  /**
   * Starts a new trip
   */
  async start() {
    if (this.state === TRIP_STATES.TRACKING || this.state === TRIP_STATES.STARTING) {
      return false;
    }

    this.state = TRIP_STATES.STARTING;
    this.tripId = `trip_${Date.now()}`;
    this.startedAt = Date.now();
    this.arrivedNotified = false;
    this.recentValidSamples = [];
    this.smoothedSpeedKmh = 0;
    this.lastGpsTimestamp = Date.now();
    this.gpsLostWarningSent = false;
    this.lowBatteryWarningSent = false;

    await this.persist();
    this.emitStateChange();
    await StorageService.addLog('info', `Hành trình mới được kích hoạt (Mã: ${this.tripId})`);
    return true;
  }

  /**
   * Switches to TRACKING state once GPS watcher is confirmed active
   */
  async confirmTracking() {
    if (this.state === TRIP_STATES.STARTING) {
      this.state = TRIP_STATES.TRACKING;
      await this.persist();
      this.emitStateChange();
    }
  }

  /**
   * Processes a new GPS location update
   * @param {Object} rawSample { lat, lng, accuracy, speed, timestamp }
   * @returns {{ arrived: boolean, filterChanged: boolean, newFilter?: number }}
   */
  async handleGpsUpdate(rawSample) {
    if (this.state !== TRIP_STATES.TRACKING) {
      return { arrived: false, filterChanged: false };
    }

    const now = Date.now();
    this.lastGpsTimestamp = now;

    // Check timeout
    const maxTripMs = (this.settings.maxTripHours || 12) * 3600 * 1000;
    if (this.startedAt && now - this.startedAt > maxTripMs) {
      await this.timeout();
      return { arrived: false, filterChanged: false };
    }

    // Step 1: Filter raw sample for noise/degradation
    const filterRes = filterGpsSample(rawSample, this.lastSample);
    if (!filterRes.valid) {
      await StorageService.addLog('warn', `Bỏ qua mẫu GPS nhiễu: ${filterRes.reason}`);
      return { arrived: false, filterChanged: false };
    }

    const sample = {
      lat: rawSample.lat,
      lng: rawSample.lng,
      accuracy: rawSample.accuracy,
      speed: rawSample.speed,
      timestamp: rawSample.timestamp || now,
    };

    // Step 2: Compute distance to destination
    const targetLat = this.settings.destinationLat;
    const targetLng = this.settings.destinationLng;
    const distMeters = haversine(sample.lat, sample.lng, targetLat, targetLng);
    this.currentDistanceMeters = distMeters;

    // Step 3: Compute and smooth speed
    let rawSpeedKmh = 0;
    if (typeof sample.speed === 'number' && sample.speed >= 0) {
      rawSpeedKmh = msToKmh(sample.speed);
    } else if (this.lastSample) {
      // Fallback: derive from distance and delta time
      const dt = Math.max(0.5, (sample.timestamp - this.lastSample.timestamp) / 1000);
      const dDist = haversine(this.lastSample.lat, this.lastSample.lng, sample.lat, sample.lng);
      rawSpeedKmh = msToKmh(dDist / dt);
    }

    this.smoothedSpeedKmh = smoothSpeed(rawSpeedKmh, this.smoothedSpeedKmh);

    // Step 4: Compute ETA
    this.currentEtaMinutes = calculateEtaMinutes(
      this.currentDistanceMeters,
      this.smoothedSpeedKmh,
      this.settings.roadFactor
    );

    // Maintain recent valid samples for geofence arrival check (keep last 5)
    this.recentValidSamples.unshift(sample);
    if (this.recentValidSamples.length > 5) {
      this.recentValidSamples.pop();
    }
    this.lastSample = sample;

    // Step 5: Check distanceFilter band transition
    const recommendedFilter = getDistanceFilterBand(distMeters, this.currentFilterBand);
    let filterChanged = false;
    if (recommendedFilter !== this.currentFilterBand) {
      this.currentFilterBand = recommendedFilter;
      filterChanged = true;
    }

    // Step 6: Noise-immune geofence check
    let arrived = false;
    if (!this.arrivedNotified) {
      const isArrived = checkGeofenceArrival(
        sample,
        this.recentValidSamples,
        targetLat,
        targetLng,
        this.settings.radiusMeters
      );

      if (isArrived) {
        this.state = TRIP_STATES.ARRIVED;
        this.arrivedNotified = true;
        arrived = true;
        await this.persist();
        this.emitStateChange();
        await StorageService.addLog(
          'success',
          `Xác nhận đến nơi! Khoảng cách ${Math.round(distMeters)}m <= ${this.settings.radiusMeters}m`
        );
        this.emitMetricsUpdate();
        return { arrived: true, filterChanged, newFilter: recommendedFilter };
      }
    }

    await this.persist();
    this.emitMetricsUpdate();

    return {
      arrived,
      filterChanged,
      newFilter: recommendedFilter,
    };
  }

  /**
   * Marks trip as DONE after notifications handled
   */
  async finish() {
    this.state = TRIP_STATES.DONE;
    await this.persist();
    this.emitStateChange();
    await StorageService.addLog('info', 'Hành trình hoàn tất thành công (DONE). Dừng dịch vụ định vị nền.');
  }

  /**
   * Stops trip manually
   */
  async stop() {
    this.state = TRIP_STATES.STOPPED;
    await this.persist();
    this.emitStateChange();
    await StorageService.addLog('info', 'Người dùng đã bấm Dừng hành trình.');
  }

  /**
   * Trip exceeded max duration
   */
  async timeout() {
    this.state = TRIP_STATES.TIMEOUT;
    await this.persist();
    this.emitStateChange();
    await StorageService.addLog('warn', `Hành trình đã tự động dừng vì vượt quá thời gian tối đa ${this.settings.maxTripHours}h.`);
  }

  /**
   * Resets machine back to IDLE
   */
  async reset() {
    this.state = TRIP_STATES.IDLE;
    this.tripId = null;
    this.startedAt = null;
    this.arrivedNotified = false;
    this.lastSample = null;
    this.recentValidSamples = [];
    this.smoothedSpeedKmh = 0;
    this.currentDistanceMeters = null;
    this.currentEtaMinutes = null;
    await StorageService.clearTripState();
    this.emitStateChange();
    this.emitMetricsUpdate();
  }
}
