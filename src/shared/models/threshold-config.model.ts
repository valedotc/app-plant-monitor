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

// ESP32 BLE UUIDs - Nordic UART Service (NUS)
export const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // App -> ESP32 (write)
export const NUS_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // ESP32 -> App (notify)

// Manufacturer data per identificare il dispositivo PlantMonitor
// Bytes: 0x47, 0xE9, 0xA7, 0x3B, 0x01
export const PLANT_MONITOR_MANUFACTURER_ID = 0xe947; // Little-endian: 0x47, 0xE9
export const PLANT_MONITOR_MANUFACTURER_DATA = [0xa7, 0x3b, 0x01];