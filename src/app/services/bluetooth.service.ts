import { Injectable } from '@angular/core';
import { BleClient, BleDevice, RequestBleDeviceOptions } from '@capacitor-community/bluetooth-le';
import { 
  BleConnectionState, 
  BleError, 
  BleDevice as CustomBleDevice 
} from '../../shared/models/ble-device.model';
import { WiFiConfig, WiFiConfigResult } from '../../shared/models/wifi-config.model';
import { 
  ThresholdConfig, 
  ThresholdResult,
  DeviceStatus,
  ESP32_SERVICE_UUID,
  WIFI_CONFIG_CHARACTERISTIC_UUID,
  THRESHOLDS_CHARACTERISTIC_UUID,
  DEVICE_STATUS_CHARACTERISTIC_UUID
} from '../../shared/models/threshold-config.model';
import { BehaviorSubject, Subject, fromEvent, of } from 'rxjs';
import { catchError, timeout, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class BluetoothService {
  // State management
  private connectionStateSubject = new BehaviorSubject<BleConnectionState>(BleConnectionState.DISCONNECTED);
  private connectedDeviceSubject = new BehaviorSubject<CustomBleDevice | null>(null);
  private discoveredDevicesSubject = new BehaviorSubject<CustomBleDevice[]>([]);
  private errorSubject = new Subject<BleError>();

  // Public observables
  public connectionState$ = this.connectionStateSubject.asObservable();
  public connectedDevice$ = this.connectedDeviceSubject.asObservable();
  public discoveredDevices$ = this.discoveredDevicesSubject.asObservable();
  public errors$ = this.errorSubject.asObservable();

  private currentDevice: CustomBleDevice | null = null;
  private isScanning = false;

  constructor() {}

  /**
   * Initialize Bluetooth Low Energy
   */
  async initializeBLE(): Promise<void> {
    try {
      this.connectionStateSubject.next(BleConnectionState.CONNECTING);
      
      await BleClient.initialize({
        androidNeverForLocation: true
      });
      
      this.connectionStateSubject.next(BleConnectionState.DISCONNECTED);
      console.log('BLE initialized successfully');
    } catch (error) {
      this.handleError(error as BleError);
      throw error;
    }
  }

  /**
   * Check if Bluetooth is available and enabled
   */
  async isBluetoothEnabled(): Promise<boolean> {
    try {
      return await BleClient.isEnabled();
    } catch (error) {
      this.handleError(error as BleError);
      return false;
    }
  }

  /**
   * Request user to enable Bluetooth (Android only)
   */
  async requestEnableBluetooth(): Promise<void> {
    try {
      await BleClient.requestEnable();
    } catch (error) {
      this.handleError(error as BleError);
      throw error;
    }
  }

  /**
   * Scan for ESP32 devices
   */
  async scanForESP32Devices(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    try {
      this.isScanning = true;
      this.connectionStateSubject.next(BleConnectionState.SCANNING);
      this.discoveredDevicesSubject.next([]);

      const options: RequestBleDeviceOptions = {
        services: [ESP32_SERVICE_UUID],
        optionalServices: [],
        allowDuplicates: false
      };

      await BleClient.requestLEScan(options, (result) => {
        const device: CustomBleDevice = {
          deviceId: result.device.deviceId,
          name: result.device.name || 'Unknown ESP32',
          rssi: result.rssi,
          uuids: result.device.uuids
        };

        // Filter for ESP32 devices
        if (this.isESP32Device(device)) {
          this.discoveredDevicesSubject.next([
            ...this.discoveredDevicesSubject.value,
            device
          ]);
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        this.stopScanning();
      }, 10000);

    } catch (error) {
      this.handleError(error as BleError);
      this.isScanning = false;
      this.connectionStateSubject.next(BleConnectionState.DISCONNECTED);
    }
  }

  /**
   * Stop scanning for devices
   */
  async stopScanning(): Promise<void> {
    try {
      await BleClient.stopLEScan();
      this.isScanning = false;
      this.connectionStateSubject.next(BleConnectionState.DISCONNECTED);
    } catch (error) {
      this.handleError(error as BleError);
    }
  }

  /**
   * Connect to a BLE device
   */
  async connectToDevice(deviceId: string): Promise<void> {
    try {
      this.connectionStateSubject.next(BleConnectionState.CONNECTING);

      await BleClient.connect(deviceId, (disconnectedDeviceId) => {
        console.log('Device disconnected:', disconnectedDeviceId);
        this.handleDisconnection();
      });

      const device = this.discoveredDevicesSubject.value.find(d => d.deviceId === deviceId);
      if (device) {
        this.currentDevice = device;
        this.connectedDeviceSubject.next(device);
        this.connectionStateSubject.next(BleConnectionState.CONNECTED);
      }

    } catch (error) {
      this.handleError(error as BleError);
      this.connectionStateSubject.next(BleConnectionState.ERROR);
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    if (this.currentDevice) {
      try {
        await BleClient.disconnect(this.currentDevice.deviceId);
        this.handleDisconnection();
      } catch (error) {
        this.handleError(error as BleError);
      }
    }
  }

  /**
   * Write WiFi configuration to ESP32
   */
  async writeWiFiConfig(wifiConfig: WiFiConfig): Promise<WiFiConfigResult> {
    if (!this.currentDevice) {
      return {
        success: false,
        error: 'No device connected'
      };
    }

    try {
      const configString = JSON.stringify(wifiConfig);
      const encoder = new TextEncoder();
      const configData = encoder.encode(configString);
      const dataView = new DataView(configData.buffer);

      await BleClient.write(
        this.currentDevice.deviceId,
        ESP32_SERVICE_UUID,
        WIFI_CONFIG_CHARACTERISTIC_UUID,
        dataView
      );

      return {
        success: true,
        message: 'WiFi configuration sent successfully'
      };

    } catch (error) {
      this.handleError(error as BleError);
      return {
        success: false,
        error: (error as BleError).message || 'Failed to send WiFi configuration'
      };
    }
  }

  /**
   * Write threshold configuration to ESP32
   */
  async writeThresholds(thresholdConfig: ThresholdConfig): Promise<ThresholdResult> {
    if (!this.currentDevice) {
      return {
        success: false,
        error: 'No device connected'
      };
    }

    try {
      // Create buffer for float array
      const buffer = new ArrayBuffer(thresholdConfig.thresholds.length * 4);
      const dataView = new DataView(buffer);

      // Write each threshold as 32-bit float
      thresholdConfig.thresholds.forEach((threshold: number, index: number) => {
        dataView.setFloat32(index * 4, threshold, true); // little-endian
      });

      await BleClient.write(
        this.currentDevice.deviceId,
        ESP32_SERVICE_UUID,
        THRESHOLDS_CHARACTERISTIC_UUID,
        dataView
      );

      return {
        success: true,
        message: 'Threshold configuration sent successfully'
      };

    } catch (error) {
      this.handleError(error as BleError);
      return {
        success: false,
        error: (error as BleError).message || 'Failed to send threshold configuration'
      };
    }
  }

  /**
   * Read device status from ESP32
   */
  async readDeviceStatus(): Promise<DeviceStatus | null> {
    if (!this.currentDevice) {
      return null;
    }

    try {
      const result = await BleClient.read(
        this.currentDevice.deviceId,
        ESP32_SERVICE_UUID,
        DEVICE_STATUS_CHARACTERISTIC_UUID
      );

      // Parse status data (implement based on ESP32 protocol)
      const status = this.parseDeviceStatus(result);
      return status;

    } catch (error) {
      this.handleError(error as BleError);
      return null;
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): BleConnectionState {
    return this.connectionStateSubject.value;
  }

  /**
   * Get current connected device
   */
  getConnectedDevice(): CustomBleDevice | null {
    return this.connectedDeviceSubject.value;
  }

  /**
   * Private helper methods
   */
  private handleDisconnection(): void {
    this.currentDevice = null;
    this.connectedDeviceSubject.next(null);
    this.connectionStateSubject.next(BleConnectionState.DISCONNECTED);
  }

  private handleError(error: BleError): void {
    console.error('Bluetooth Error:', error);
    this.errorSubject.next(error);
  }

  private isESP32Device(device: CustomBleDevice): boolean {
    const deviceName = device.name?.toLowerCase() || '';
    return deviceName.includes('esp32') || 
           deviceName.includes('plant') || 
           deviceName.includes('sensor') ||
           device.uuids?.includes(ESP32_SERVICE_UUID);
  }

  private parseDeviceStatus(dataView: DataView): DeviceStatus {
    // This needs to be implemented based on your ESP32 protocol
    // For now, return a basic structure
    return {
      connected: true,
      wifiConfigured: false,
      thresholdsSet: false,
      version: '1.0.0',
      lastSeen: new Date()
    };
  }
}