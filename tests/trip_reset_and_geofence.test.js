import { describe, it, expect, beforeEach } from 'vitest';
import { TripMachine } from '../src/state/tripMachine.js';
import { TRIP_STATES, DEFAULT_SETTINGS, DEFAULT_SECRETS } from '../src/config/constants.js';
import { StorageService } from '../src/services/storage.js';

describe('TripMachine Stale Auto-Reset and Proximity Verification', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('auto-resets stale TIMEOUT trip if older than 2 hours', () => {
    const machine = new TripMachine({
      settings: DEFAULT_SETTINGS,
      secrets: DEFAULT_SECRETS,
    });

    const oldTimestamp = Date.now() - 3 * 3600 * 1000; // 3 hours ago
    machine.restoreFrom({
      state: TRIP_STATES.TIMEOUT,
      startedAt: oldTimestamp,
      lastGpsTimestamp: oldTimestamp,
      tripId: 'old_trip_123',
    });

    // Should be automatically reset to IDLE
    expect(machine.state).toBe(TRIP_STATES.IDLE);
    expect(machine.tripId).toBeNull();
  });

  it('keeps active TRACKING state on restore regardless of age', () => {
    const machine = new TripMachine({
      settings: DEFAULT_SETTINGS,
      secrets: DEFAULT_SECRETS,
    });

    const timestamp = Date.now() - 30 * 60 * 1000; // 30 mins ago
    machine.restoreFrom({
      state: TRIP_STATES.TRACKING,
      startedAt: timestamp,
      lastGpsTimestamp: timestamp,
      tripId: 'active_trip_456',
    });

    expect(machine.state).toBe(TRIP_STATES.TRACKING);
    expect(machine.tripId).toBe('active_trip_456');
  });

  it('signals insideGeofencePending when first sample enters radius but needs confirmation', async () => {
    const machine = new TripMachine({
      settings: {
        ...DEFAULT_SETTINGS,
        destinationLat: 21.0285,
        destinationLng: 105.8542,
        radiusMeters: 100,
      },
      secrets: DEFAULT_SECRETS,
    });

    await machine.start();
    await machine.confirmTracking();

    // Sample within 10 meters of destination (e.g., 4m)
    const result = await machine.handleGpsUpdate({
      lat: 21.02855,
      lng: 105.85425,
      accuracy: 10,
      speed: 0,
      timestamp: Date.now(),
    });

    // First sample should not immediately trigger arrived (needs 2 samples >= 5s),
    // but MUST return insideGeofencePending = true so timer can fetch the second sample
    expect(result.arrived).toBe(false);
    expect(result.insideGeofencePending).toBe(true);
  });
});
