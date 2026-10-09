import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../src/services/storage.js';

describe('Saved Destinations (Điểm đến yêu thích / Bookmarks)', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('initially returns empty list when no destinations are stored', async () => {
    const list = await StorageService.getSavedDestinations();
    expect(list).toEqual([]);
  });

  it('adds new destination and retrieves it correctly', async () => {
    const newDest = {
      name: 'Nhà riêng',
      lat: 21.028511,
      lng: 105.854444,
      address: 'Hoàn Kiếm, Hà Nội',
    };

    const created = await StorageService.addSavedDestination(newDest);
    expect(created.name).toBe('Nhà riêng');
    expect(created.lat).toBe(21.028511);
    expect(created.lng).toBe(105.854444);
    expect(created.id).toBeDefined();

    const list = await StorageService.getSavedDestinations();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Nhà riêng');
  });

  it('updates existing point name if coordinates are virtually identical', async () => {
    await StorageService.addSavedDestination({
      name: 'Bãi xe số 1',
      lat: 18.70537,
      lng: 105.49849,
    });

    await StorageService.addSavedDestination({
      name: 'Bãi gửi xe ô tô',
      lat: 18.70537,
      lng: 105.49849,
    });

    const list = await StorageService.getSavedDestinations();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Bãi gửi xe ô tô');
  });

  it('removes a saved destination by id', async () => {
    const d1 = await StorageService.addSavedDestination({
      name: 'Cơ quan',
      lat: 21.0300,
      lng: 105.8500,
    });
    const d2 = await StorageService.addSavedDestination({
      name: 'Nhà bà ngoại',
      lat: 21.0400,
      lng: 105.8600,
    });

    let list = await StorageService.getSavedDestinations();
    expect(list.length).toBe(2);

    await StorageService.removeSavedDestination(d1.id);
    list = await StorageService.getSavedDestinations();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Nhà bà ngoại');
  });
});
