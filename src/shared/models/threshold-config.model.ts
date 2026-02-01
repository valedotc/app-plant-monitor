export interface ThresholdConfig {
  thresholds: number[];
  labels?: string[];
}

export interface ThresholdResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface DeviceStatus {
  connected: boolean;
  wifiConfigured: boolean;
  thresholdsSet: boolean;
  version: string;
  lastSeen: Date;
}

// ESP32 BLE Service UUIDs
export const ESP32_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
export const WIFI_CONFIG_CHARACTERISTIC_UUID = 'abcd1234-abcd-abcd-abcd-abcd12345678';
export const THRESHOLDS_CHARACTERISTIC_UUID = 'efgh5678-efgh-efgh-efgh-efgh56789012';
export const DEVICE_STATUS_CHARACTERISTIC_UUID = 'mnop3456-mnop-mnop-mnop-mnop34567890';