export interface WiFiConfig {
  ssid: string;
  password: string;
}

export interface WiFiStatus {
  connected: boolean;
  ssid?: string;
  signalStrength?: number;
  ip?: string;
}

export interface WiFiConfigResult {
  success: boolean;
  message?: string;
  error?: string;
}