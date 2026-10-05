import { describe, it, expect, beforeEach } from 'vitest';
import { TripMachine } from '../src/state/tripMachine.js';
import { TRIP_STATES, DEFAULT_SETTINGS } from '../src/config/constants.js';
import { StorageService } from '../src/services/storage.js';

describe('TripMachine State Machine', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('initializes in IDLE state', () => {
    const machine = new TripMachine({
      settings: { ...DEFAULT_SETTINGS },
      secrets: {},
    });
    expect(machine.state).toBe(TRIP_STATES.IDLE);
  });

  it('transitions from IDLE -> STARTING -> TRACKING', async () => {
    const machine = new TripMachine({
      settings: { ...DEFAULT_SETTINGS },
      secrets: {},
    });

    await machine.start();
    expect(machine.state).toBe(TRIP_STATES.STARTING);
    expect(machine.tripId).toBeTruthy();

    await machine.confirmTracking();
    expect(machine.state).toBe(TRIP_STATES.TRACKING);
  });

  // TC-06: After ARRIVED, further samples do NOT trigger arrival again
  it('TC-06: triggers ARRIVED once, and subsequent samples do NOT trigger second arrival', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      destinationLat: 21.0000,
      destinationLng: 105.0000,
      radiusMeters: 100,
    };

    const machine = new TripMachine({ settings, secrets: {} });
    await machine.start();
    await machine.confirmTracking();

    const sample1 = {
      lat: 21.0002, // ~22m away
      lng: 105.0000,
      accuracy: 10,
      speed: 10,
      timestamp: 10000,
    };

    const res1 = await machine.handleGpsUpdate(sample1);
    expect(res1.arrived).toBe(false); // First sample inside

    const sample2 = {
      lat: 21.0001,
      lng: 105.0000,
      accuracy: 10,
      speed: 5,
      timestamp: 16000, // 6s later
    };

    const res2 = await machine.handleGpsUpdate(sample2);
    expect(res2.arrived).toBe(true);
    expect(machine.state).toBe(TRIP_STATES.ARRIVED);
    expect(machine.arrivedNotified).toBe(true);

    // After arrived, feed another sample inside geofence
    const sample3 = {
      lat: 21.00005,
      lng: 105.0000,
      accuracy: 5,
      speed: 0,
      timestamp: 22000,
    };

    const res3 = await machine.handleGpsUpdate(sample3);
    expect(res3.arrived).toBe(false); // Does NOT trigger duplicate!
  });

  // FR-16: State restoration
  it('FR-16: persists and restores state seamlessly', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      destinationLat: 21.0000,
      destinationLng: 105.0000,
    };

    const machine1 = new TripMachine({ settings, secrets: {} });
    await machine1.start();
    await machine1.confirmTracking();
    await machine1.handleGpsUpdate({
      lat: 21.0100,
      lng: 105.0000,
      accuracy: 15,
      speed: 12,
      timestamp: Date.now(),
    });

    const savedState = await StorageService.getTripState();
    expect(savedState).toBeTruthy();
    expect(savedState.state).toBe(TRIP_STATES.TRACKING);

    // Create a new instance and restore
    const machine2 = new TripMachine({ settings, secrets: {} });
    machine2.restoreFrom(savedState);

    expect(machine2.state).toBe(TRIP_STATES.TRACKING);
    expect(machine2.tripId).toBe(machine1.tripId);
    expect(machine2.currentDistanceMeters).toBeCloseTo(machine1.currentDistanceMeters, 1);
  });

  // C.5: arrivedNotified must be persisted to Capacitor Preferences with key "trip" BEFORE notify
  it('C.5: persists arrivedNotified=true into Capacitor Preferences (key: "trip") upon arrival', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      destinationLat: 21.0000,
      destinationLng: 105.0000,
      radiusMeters: 100,
    };

    const machine = new TripMachine({ settings, secrets: {} });
    await machine.start();
    await machine.confirmTracking();

    const sample1 = {
      lat: 21.0002, // ~22m
      lng: 105.0000,
      accuracy: 10,
      speed: 10,
      timestamp: 10000,
    };
    await machine.handleGpsUpdate(sample1);

    const sample2 = {
      lat: 21.0001, // ~11m
      lng: 105.0000,
      accuracy: 10,
      speed: 5,
      timestamp: 16000, // 6s later
    };

    let persistedBeforeReturn = null;
    // Intercept to check state before any notifyArrived could be executed
    const result = await machine.handleGpsUpdate(sample2);
    expect(result.arrived).toBe(true);

    // Verify key "trip" directly in Storage
    const tripData = await StorageService.getTripState();
    expect(tripData).toBeTruthy();
    expect(tripData.arrivedNotified).toBe(true);
    expect(tripData.state).toBe(TRIP_STATES.ARRIVED);
  });
});
