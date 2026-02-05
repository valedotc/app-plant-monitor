/**
 * Notification Types - for distinguishing notification categories
 */
export enum NotificationType {
  DAILY_REMINDER = 'DAILY_REMINDER',
  CRITICAL_ALERT = 'CRITICAL_ALERT',
  INFO = 'INFO',
}

/**
 * Notification Priority - for display and sound handling
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Alert types from ESP32 devices
 */
export enum AlertType {
  TEMPERATURE_HIGH = 'TEMPERATURE_HIGH',
  TEMPERATURE_LOW = 'TEMPERATURE_LOW',
  HUMIDITY_HIGH = 'HUMIDITY_HIGH',
  HUMIDITY_LOW = 'HUMIDITY_LOW',
  MOISTURE_HIGH = 'MOISTURE_HIGH',
  MOISTURE_LOW = 'MOISTURE_LOW',
  DEVICE_OFFLINE = 'DEVICE_OFFLINE',
}

/**
 * Per-plant alert settings
 */
export interface PlantAlertSettings {
  plantId: string; // matches SavedPlant.id
  deviceId: string; // matches ESP32 deviceId
  alertsEnabled: boolean;
  temperatureAlerts: boolean;
  moistureAlerts: boolean;
  humidityAlerts: boolean;
}

/**
 * Notification Preferences - stored locally for settings page
 */
export interface NotificationPreferences {
  // Global settings
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;

  // Daily reminders
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // "HH:mm" format, default "09:00"

  // Critical alerts
  criticalAlertsEnabled: boolean;

  // Info notifications
  infoNotificationsEnabled: boolean;

  // Per-plant settings
  plantAlertSettings: PlantAlertSettings[];
}

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  dailyReminderEnabled: true,
  dailyReminderTime: '09:00',
  criticalAlertsEnabled: true,
  infoNotificationsEnabled: true,
  plantAlertSettings: [],
};

/**
 * In-app notification representation
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, string>;
  timestamp: Date;
  read: boolean;
}

/**
 * Alert from backend API
 */
export interface BackendAlert {
  _id: string;
  deviceId: string;
  alertType: AlertType;
  severity: string;
  message: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
  notificationSent: boolean;
  createdAt: string;
}
