import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject } from 'rxjs';
import {
  NotificationPreferences,
  PlantAlertSettings,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../models/notification.model';

const STORAGE_KEY = 'notification_preferences';

@Injectable({
  providedIn: 'root',
})
export class NotificationPreferencesService {
  private preferencesSubject = new BehaviorSubject<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  public preferences$ = this.preferencesSubject.asObservable();

  constructor() {
    this.loadPreferences();
  }

  /**
   * Load preferences from storage
   */
  async loadPreferences(): Promise<NotificationPreferences> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      const prefs = value
        ? JSON.parse(value)
        : DEFAULT_NOTIFICATION_PREFERENCES;

      // Merge with defaults to handle new fields
      const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs };
      this.preferencesSubject.next(merged);
      return merged;
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }

  /**
   * Update preferences
   */
  async updatePreferences(
    updates: Partial<NotificationPreferences>
  ): Promise<void> {
    const current = this.preferencesSubject.value;
    const updated = { ...current, ...updates };
    await this.savePreferences(updated);
  }

  /**
   * Toggle notifications globally
   */
  async toggleNotifications(enabled: boolean): Promise<void> {
    await this.updatePreferences({ notificationsEnabled: enabled });
  }

  /**
   * Toggle sound
   */
  async toggleSound(enabled: boolean): Promise<void> {
    await this.updatePreferences({ soundEnabled: enabled });
  }

  /**
   * Toggle vibration
   */
  async toggleVibration(enabled: boolean): Promise<void> {
    await this.updatePreferences({ vibrationEnabled: enabled });
  }

  /**
   * Set daily reminder time
   */
  async setDailyReminderTime(time: string): Promise<void> {
    await this.updatePreferences({ dailyReminderTime: time });
  }

  /**
   * Toggle daily reminder
   */
  async toggleDailyReminder(enabled: boolean): Promise<void> {
    await this.updatePreferences({ dailyReminderEnabled: enabled });
  }

  /**
   * Toggle critical alerts
   */
  async toggleCriticalAlerts(enabled: boolean): Promise<void> {
    await this.updatePreferences({ criticalAlertsEnabled: enabled });
  }

  /**
   * Update per-plant alert settings
   */
  async updatePlantAlertSettings(
    plantId: string,
    settings: Partial<PlantAlertSettings>
  ): Promise<void> {
    const current = this.preferencesSubject.value;
    const plantSettings = [...current.plantAlertSettings];
    const index = plantSettings.findIndex((p) => p.plantId === plantId);

    if (index >= 0) {
      plantSettings[index] = { ...plantSettings[index], ...settings };
    } else {
      plantSettings.push({
        plantId,
        deviceId: settings.deviceId || '',
        alertsEnabled: true,
        temperatureAlerts: true,
        moistureAlerts: true,
        humidityAlerts: true,
        ...settings,
      });
    }

    await this.updatePreferences({ plantAlertSettings: plantSettings });
  }

  /**
   * Remove plant alert settings when plant is deleted
   */
  async removePlantAlertSettings(plantId: string): Promise<void> {
    const current = this.preferencesSubject.value;
    const plantSettings = current.plantAlertSettings.filter(
      (p) => p.plantId !== plantId
    );
    await this.updatePreferences({ plantAlertSettings: plantSettings });
  }

  /**
   * Get current preferences synchronously
   */
  getPreferences(): NotificationPreferences {
    return this.preferencesSubject.value;
  }

  /**
   * Check if alerts are enabled for a specific device
   */
  isAlertEnabledForDevice(deviceId: string): boolean {
    const prefs = this.preferencesSubject.value;

    if (!prefs.notificationsEnabled || !prefs.criticalAlertsEnabled) {
      return false;
    }

    const plantSettings = prefs.plantAlertSettings.find(
      (p) => p.deviceId === deviceId
    );

    // Default to enabled if no specific settings
    return plantSettings?.alertsEnabled ?? true;
  }

  /**
   * Save preferences to storage
   */
  private async savePreferences(prefs: NotificationPreferences): Promise<void> {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(prefs),
    });
    this.preferencesSubject.next(prefs);
  }
}
