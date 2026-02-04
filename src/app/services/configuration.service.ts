import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject } from 'rxjs';

// ============================================================================
// Saved Plant Types
// ============================================================================

export interface PlantParameters {
  tempMin: number;
  tempMax: number;
  humidityMin: number;
  humidityMax: number;
  moistureMin: number;
  moistureMax: number;
  lightHoursMin: number;
  deviceId?: number; // ESP32 device ID (matches device_id in MongoDB)
}

export interface SavedPlant {
  id: string;
  deviceId: string;
  name: string;
  plantType: string;
  plantTypeId: number;
  wifiSsid: string;
  parameters: PlantParameters;
  createdAt: string;
  lastSeen?: string;
}

export interface PlantWithStatus extends SavedPlant {
  // Real-time data from MQTT (when available)
  temperature?: number;
  humidity?: number;
  moisture?: number;
  lightDetected?: boolean;
  mood: 'happy' | 'ok' | 'sad' | 'unknown';
  isOnline: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  PLANTS: 'plant_monitor_plants',
  LAST_DEVICE_ID: 'plant_monitor_last_device_id',
};

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private plantsSubject = new BehaviorSubject<SavedPlant[]>([]);
  public plants$ = this.plantsSubject.asObservable();

  constructor() {
    this.loadPlants();
  }

  /**
   * Load saved plants from storage
   */
  async loadPlants(): Promise<SavedPlant[]> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.PLANTS });
      const plants: SavedPlant[] = value ? JSON.parse(value) : [];
      this.plantsSubject.next(plants);
      return plants;
    } catch (error) {
      console.error('Failed to load plants:', error);
      return [];
    }
  }

  /**
   * Get all saved plants
   */
  getPlants(): SavedPlant[] {
    return this.plantsSubject.value;
  }

  /**
   * Get plants with status for display
   */
  getPlantsWithStatus(): PlantWithStatus[] {
    return this.plantsSubject.value.map((plant) => ({
      ...plant,
      mood: 'unknown' as const,
      isOnline: false,
    }));
  }

  /**
   * Save a new plant configuration
   */
  async savePlant(plant: Omit<SavedPlant, 'id' | 'createdAt'>): Promise<SavedPlant> {
    const newPlant: SavedPlant = {
      ...plant,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    const plants = [...this.plantsSubject.value, newPlant];
    await this.savePlants(plants);
    return newPlant;
  }

  /**
   * Update an existing plant
   */
  async updatePlant(id: string, updates: Partial<SavedPlant>): Promise<SavedPlant | null> {
    const plants = this.plantsSubject.value;
    const index = plants.findIndex((p) => p.id === id);

    if (index === -1) {
      return null;
    }

    const updatedPlant = { ...plants[index], ...updates };
    plants[index] = updatedPlant;
    await this.savePlants(plants);
    return updatedPlant;
  }

  /**
   * Delete a plant
   */
  async deletePlant(id: string): Promise<boolean> {
    const plants = this.plantsSubject.value.filter((p) => p.id !== id);

    if (plants.length === this.plantsSubject.value.length) {
      return false;
    }

    await this.savePlants(plants);
    return true;
  }

  /**
   * Get plant by device ID
   */
  getPlantByDeviceId(deviceId: string): SavedPlant | undefined {
    return this.plantsSubject.value.find((p) => p.deviceId === deviceId);
  }

  /**
   * Check if a device is already configured
   */
  isDeviceConfigured(deviceId: string): boolean {
    return this.plantsSubject.value.some((p) => p.deviceId === deviceId);
  }

  /**
   * Get next device ID for ESP32 params
   */
  async getNextDeviceId(): Promise<number> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.LAST_DEVICE_ID });
      const lastId = value ? parseInt(value, 10) : 0;
      const nextId = lastId + 1;
      await Preferences.set({
        key: STORAGE_KEYS.LAST_DEVICE_ID,
        value: nextId.toString(),
      });
      return nextId;
    } catch {
      return 1;
    }
  }

  /**
   * Clear all saved data
   */
  async clearAll(): Promise<void> {
    await Preferences.remove({ key: STORAGE_KEYS.PLANTS });
    await Preferences.remove({ key: STORAGE_KEYS.LAST_DEVICE_ID });
    this.plantsSubject.next([]);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async savePlants(plants: SavedPlant[]): Promise<void> {
    await Preferences.set({
      key: STORAGE_KEYS.PLANTS,
      value: JSON.stringify(plants),
    });
    this.plantsSubject.next(plants);
  }

  private generateId(): string {
    return `plant_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
