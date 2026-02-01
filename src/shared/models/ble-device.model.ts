export interface BleDevice {
  deviceId: string;
  name: string;
  rssi?: number;
  uuids?: string[];
}

export interface BleService {
  uuid: string;
  characteristics: BleCharacteristic[];
}

export interface BleCharacteristic {
  uuid: string;
  properties: string[];
  value?: DataView;
}

export enum BleConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SCANNING = 'scanning',
  ERROR = 'error'
}

export interface BleError {
  message: string;
  code?: string;
  stack?: string;
}