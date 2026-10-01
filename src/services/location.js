/**
 * Location Service for Geofencing Tracker v1.0
 * Handles native background geolocation via Capacitor with web browser fallback & simulation
 */

import { Geolocation } from '@capacitor/geolocation';
import { StorageService } from './storage.js';

let activeWatchId = null;
let currentDistanceFilter = 15;
let simulationInterval = null;

export const LocationService = {
  /**
   * Checks current geolocation permission status
   */
  async checkPermissions() {
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
        const status = await Geolocation.checkPermissions();
        return status;
      }
      if ('permissions' in navigator) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        return { location: perm.state }; // 'granted' | 'prompt' | 'denied'
      }
    } catch {}
    return { location: 'prompt' };
  },

  /**
   * Requests geolocation permissions
   */
  async requestPermissions() {
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
        const res = await Geolocation.requestPermissions({
          permissions: ['location', 'coarseLocation'],
        });
        return res;
      }
    } catch (e) {
      console.warn('Native permission request error', e);
    }
    return { location: 'granted' };
  },

  /**
   * Gets current location once (for "Dùng vị trí hiện tại" in Settings)
   */
  async getCurrentPosition() {
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      }
    } catch (e) {
      console.warn('Capacitor getCurrentPosition failed, falling back to browser', e);
    }

    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Thiết bị không hỗ trợ định vị GPS'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  },

  /**
   * Starts tracking GPS updates
   */
  async startWatching({ distanceFilter = 15, destinationName = 'Điểm đến' }, onLocation, onError) {
    await this.stopWatching();
    currentDistanceFilter = distanceFilter;

    // Check if running natively in Android
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
      try {
        const plugins = window.Capacitor.Plugins;
        // If a background geolocation plugin is installed:
        if (plugins?.BackgroundGeolocation) {
          activeWatchId = await plugins.BackgroundGeolocation.addWatcher(
            {
              backgroundTitle: 'Đang theo dõi hành trình',
              backgroundMessage: `Sẽ báo cho người thân khi bạn đến ${destinationName}`,
              requestPermissions: true,
              stale: false,
              distanceFilter,
            },
            (location, error) => {
              if (error) {
                onError && onError(error);
                return;
              }
              if (location) {
                onLocation({
                  lat: location.latitude,
                  lng: location.longitude,
                  accuracy: location.accuracy,
                  speed: location.speed,
                  timestamp: location.time || Date.now(),
                });
              }
            }
          );
          return activeWatchId;
        }

        // Native Capacitor Geolocation fallback
        activeWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000 },
          (pos, err) => {
            if (err) {
              onError && onError(err);
              return;
            }
            if (pos) {
              onLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                speed: pos.coords.speed,
                timestamp: pos.timestamp || Date.now(),
              });
            }
          }
        );
        return activeWatchId;
      } catch (err) {
        console.error('Failed to start native geolocation watcher', err);
      }
    }

    // Standard Browser / Web Geolocation watcher
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      activeWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          onLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            timestamp: pos.timestamp || Date.now(),
          });
        },
        (err) => onError && onError(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
      return activeWatchId;
    }

    throw new Error('Không tìm thấy nguồn định vị GPS trên thiết bị');
  },

  /**
   * Updates distanceFilter dynamically
   */
  async updateDistanceFilter(newFilter, destinationName = 'Điểm đến', onLocation, onError) {
    if (newFilter === currentDistanceFilter) return;
    currentDistanceFilter = newFilter;
    await StorageService.addLog('info', `Cập nhật tần suất định vị: distanceFilter = ${newFilter}m`);
    // Recreate watcher with updated filter if needed
    if (activeWatchId) {
      await this.startWatching({ distanceFilter: newFilter, destinationName }, onLocation, onError);
    }
  },

  /**
   * Stops GPS watcher
   */
  async stopWatching() {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }

    if (activeWatchId !== null) {
      try {
        if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
          const plugins = window.Capacitor.Plugins;
          if (plugins?.BackgroundGeolocation && typeof activeWatchId === 'string') {
            await plugins.BackgroundGeolocation.removeWatcher({ id: activeWatchId });
          } else {
            await Geolocation.clearWatch({ id: activeWatchId });
          }
        } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(activeWatchId);
        }
      } catch (e) {
        console.warn('Error clearing watch', e);
      }
      activeWatchId = null;
    }
  },

  /**
   * Starts a simulated GPS journey along waypoint coordinates (for live testing)
   */
  startSimulation(waypoints, intervalMs = 2500, onLocation) {
    this.stopWatching();
    let index = 0;

    // Send first sample immediately
    if (waypoints.length > 0) {
      onLocation(waypoints[0]);
      index = 1;
    }

    simulationInterval = setInterval(() => {
      if (index >= waypoints.length) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        return;
      }
      onLocation(waypoints[index]);
      index++;
    }, intervalMs);

    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }
    };
  }
};
