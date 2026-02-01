import { Injectable } from '@angular/core';
import {
  BleClient,
  ScanResult,
  numberToUUID,
} from '@capacitor-community/bluetooth-le';
import {
  BleConnectionState,
  BleError,
  BleDevice as CustomBleDevice,
} from '../../shared/models/ble-device.model';
import {
  NUS_SERVICE_UUID,
  NUS_RX_CHARACTERISTIC_UUID,
  NUS_TX_CHARACTERISTIC_UUID,
  PLANT_MONITOR_MANUFACTURER_ID,
  PLANT_MONITOR_MANUFACTURER_DATA,
} from '../../shared/models/threshold-config.model';
import { BehaviorSubject, Subject, filter, firstValueFrom, timeout } from 'rxjs';

// ============================================================================
// ESP32 Protocol Types
// ============================================================================

export interface ESP32Response {
  type: 'ack' | 'status' | 'result' | 'pong' | 'info';
  cmd?: string;
  state?: string;
  progress?: number;
  status?: 'ok' | 'error';
  error?: string;
  msg?: string;
  fw_version?: string;
  hw_version?: string;
  configured?: boolean;
  device_id?: number;
  wifi_ssid?: string;
  plant_type?: number;
}

export interface DeviceConfig {
  ssid: string;
  pass: string;
  params: number[];
}

export interface ConfigResult {
  success: boolean;
  error?: string;
}

// Param indices (matching ESP32 firmware)
export enum ParamIndex {
  PLANT_TYPE_ID = 0,
  TEMP_MIN = 1,
  TEMP_MAX = 2,
  HUMIDITY_MIN = 3,
  HUMIDITY_MAX = 4,
  MOISTURE_MIN = 5,
  MOISTURE_MAX = 6,
  LIGHT_HOURS_MIN = 7,
  DEVICE_ID = 8,
}

@Injectable({
  providedIn: 'root',
})
export class BluetoothService {
  // State management
  private connectionStateSubject = new BehaviorSubject<BleConnectionState>(
    BleConnectionState.DISCONNECTED,
  );
  private connectedDeviceSubject = new BehaviorSubject<CustomBleDevice | null>(
    null,
  );
  private discoveredDevicesSubject = new BehaviorSubject<CustomBleDevice[]>([]);
  private errorSubject = new Subject<BleError>();

  // ESP32 Response subjects
  private responseSubject = new Subject<ESP32Response>();
  private configProgressSubject = new BehaviorSubject<number>(0);

  // Public observables
  public connectionState$ = this.connectionStateSubject.asObservable();
  public connectedDevice$ = this.connectedDeviceSubject.asObservable();
  public discoveredDevices$ = this.discoveredDevicesSubject.asObservable();
  public errors$ = this.errorSubject.asObservable();
  public response$ = this.responseSubject.asObservable();
  public configProgress$ = this.configProgressSubject.asObservable();

  private currentDevice: CustomBleDevice | null = null;
  private isScanning = false;
  private responseBuffer = '';

  constructor() {}

  /**
   * Initialize Bluetooth Low Energy
   */
  async initializeBLE(): Promise<void> {
    try {
      await BleClient.initialize({
        androidNeverForLocation: true,
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
   * Scan for PlantMonitor ESP32 devices using manufacturer data
   */
  async scanForESP32Devices(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    try {
      this.isScanning = true;
      this.connectionStateSubject.next(BleConnectionState.SCANNING);
      this.discoveredDevicesSubject.next([]);

      await BleClient.requestLEScan(
        {
          allowDuplicates: false,
        },
        (result: ScanResult) => {
          if (this.isPlantMonitorDevice(result)) {
            const device: CustomBleDevice = {
              deviceId: result.device.deviceId,
              name: result.device.name || 'PlantMonitor',
              rssi: result.rssi,
              uuids: result.uuids,
            };

            // Evita duplicati
            const existing = this.discoveredDevicesSubject.value;
            if (!existing.find((d) => d.deviceId === device.deviceId)) {
              this.discoveredDevicesSubject.next([...existing, device]);
              console.log('Found PlantMonitor device:', device.name, device.deviceId);
            }
          }
        },
      );

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
   * Check if device is a PlantMonitor by manufacturer data
   */
  private isPlantMonitorDevice(result: ScanResult): boolean {
    // Check manufacturer data
    if (result.manufacturerData) {
      // iOS returns manufacturer ID as decimal string (e.g., "59719")
      // Android may return it as UUID format
      const mfgIdDecimal = PLANT_MONITOR_MANUFACTURER_ID.toString();
      const mfgIdUuid = numberToUUID(PLANT_MONITOR_MANUFACTURER_ID);

      // Try both formats
      const mfgData =
        result.manufacturerData[mfgIdDecimal] ||
        result.manufacturerData[mfgIdUuid];

      if (mfgData) {
        const dataView = new DataView(mfgData.buffer);
        // Verifica i bytes rimanenti: 0xA7, 0x3B, 0x01
        if (mfgData.byteLength >= 3) {
          const matches =
            dataView.getUint8(0) === PLANT_MONITOR_MANUFACTURER_DATA[0] &&
            dataView.getUint8(1) === PLANT_MONITOR_MANUFACTURER_DATA[1] &&
            dataView.getUint8(2) === PLANT_MONITOR_MANUFACTURER_DATA[2];
          if (matches) {
            console.log('PlantMonitor identified by manufacturer data!');
            return true;
          }
        }
      }
    }

    // Fallback: check device name
    const deviceName = result.device.name?.toLowerCase() || '';
    return deviceName.includes('plant') || deviceName.includes('esp32');
  }

  /**
   * Stop scanning for devices
   */
  async stopScanning(): Promise<void> {
    try {
      await BleClient.stopLEScan();
      this.isScanning = false;
      if (this.connectionStateSubject.value === BleConnectionState.SCANNING) {
        this.connectionStateSubject.next(BleConnectionState.DISCONNECTED);
      }
    } catch (error) {
      this.handleError(error as BleError);
    }
  }

  /**
   * Connect to a BLE device and subscribe to TX notifications
   */
  async connectToDevice(deviceId: string): Promise<void> {
    try {
      this.connectionStateSubject.next(BleConnectionState.CONNECTING);

      // Connect with extended timeout for service discovery
      await BleClient.connect(
        deviceId,
        (disconnectedDeviceId) => {
          console.log('Device disconnected:', disconnectedDeviceId);
          this.handleDisconnection();
        },
        { timeout: 30000 }, // 30 seconds timeout for connection + service discovery
      );

      console.log('BLE connected, discovering services...');

      // Force service discovery by calling getServices
      const services = await BleClient.getServices(deviceId);
      console.log('Discovered services:', services.map((s) => s.uuid));

      // Find NUS service and log its characteristics
      const nusService = services.find(
        (s) => s.uuid.toLowerCase() === NUS_SERVICE_UUID.toLowerCase(),
      );
      if (nusService) {
        console.log(
          'NUS service found with characteristics:',
          nusService.characteristics.map((c) => c.uuid),
        );
      } else {
        console.error('NUS service not found! Available services:', services);
        throw new Error('NUS service not found on device');
      }

      // Small delay to ensure service discovery is complete
      await this.delay(500);

      console.log('Starting notifications on TX characteristic...');

      // Subscribe to TX characteristic (ESP32 -> App notifications)
      await BleClient.startNotifications(
        deviceId,
        NUS_SERVICE_UUID,
        NUS_TX_CHARACTERISTIC_UUID,
        (value: DataView) => {
          this.handleTxNotification(value);
        },
      );

      console.log('Notifications started successfully');

      // Wait for connection to stabilize before allowing writes
      console.log('=== CONNECT: Waiting 1s for connection to stabilize... ===');
      await this.delay(1000);
      console.log('=== CONNECT: Connection stabilized ===');

      const device = this.discoveredDevicesSubject.value.find(
        (d) => d.deviceId === deviceId,
      );
      if (device) {
        this.currentDevice = device;
        this.connectedDeviceSubject.next(device);
        this.connectionStateSubject.next(BleConnectionState.CONNECTED);
        console.log('=== CONNECT: SUCCESS! Connected to PlantMonitor:', device.name, '===');
        console.log('=== CONNECT: currentDevice set to:', this.currentDevice.deviceId, '===');
      } else {
        console.error('=== CONNECT: Device not found in discovered devices! ===');
      }
    } catch (error) {
      console.error('=== CONNECT: Connection FAILED! ===', error);
      this.handleError(error as BleError);
      this.connectionStateSubject.next(BleConnectionState.ERROR);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handle incoming TX notifications from ESP32
   */
  private handleTxNotification(value: DataView): void {
    console.log('=== NOTIFICATION RECEIVED! ===');
    console.log('=== NOTIFICATION: DataView byteLength:', value.byteLength, '===');

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(value.buffer);
    console.log('=== NOTIFICATION: RX from ESP32:', text, '===');

    // Buffer per messaggi frammentati
    this.responseBuffer += text;
    console.log('=== NOTIFICATION: Buffer now:', this.responseBuffer, '===');

    // Processa messaggi completi (terminati con } o separati da newline)
    // L'ESP32 invia JSON senza newline finale, quindi controlliamo anche le parentesi
    this.processBuffer();
  }

  private processBuffer(): void {
    // Cerca oggetti JSON completi nel buffer
    let startIndex = 0;
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < this.responseBuffer.length; i++) {
      const char = this.responseBuffer[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            startIndex = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            // Trovato JSON completo
            const jsonStr = this.responseBuffer.substring(startIndex, i + 1);
            this.parseAndEmitResponse(jsonStr);
            this.responseBuffer = this.responseBuffer.substring(i + 1).trim();
            // Ricomincia dal nuovo buffer
            this.processBuffer();
            return;
          }
        }
      }
    }
  }

  private parseAndEmitResponse(jsonStr: string): void {
    console.log('=== PARSE: Attempting to parse:', jsonStr, '===');
    try {
      const response = JSON.parse(jsonStr) as ESP32Response;
      console.log('=== PARSE: Successfully parsed! Response:', response, '===');
      console.log('=== PARSE: Response type:', response.type, '===');

      // Aggiorna progress se è uno status
      if (response.type === 'status' && response.progress !== undefined) {
        this.configProgressSubject.next(response.progress);
      }

      console.log('=== PARSE: Emitting to responseSubject... ===');
      this.responseSubject.next(response);
      console.log('=== PARSE: Emitted! ===');
    } catch (error) {
      console.error('=== PARSE: Failed to parse ESP32 response:', jsonStr, error, '===');
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    if (this.currentDevice) {
      try {
        await BleClient.stopNotifications(
          this.currentDevice.deviceId,
          NUS_SERVICE_UUID,
          NUS_TX_CHARACTERISTIC_UUID,
        );
        await BleClient.disconnect(this.currentDevice.deviceId);
        this.handleDisconnection();
      } catch (error) {
        this.handleError(error as BleError);
      }
    }
  }

  /**
   * Send raw data to ESP32 via UART RX characteristic
   * Uses writeWithoutResponse for NUS RX characteristic (default for Nordic UART)
   */
  async sendData(data: string): Promise<boolean> {
    console.log('=== SEND_DATA: Starting ===');
    console.log('=== SEND_DATA: currentDevice:', this.currentDevice?.deviceId, '===');

    if (!this.currentDevice) {
      console.error('=== SEND_DATA: No device connected! ===');
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);
      const dataView = new DataView(encoded.buffer);

      console.log('=== SEND_DATA: Writing to', NUS_RX_CHARACTERISTIC_UUID, '===');
      console.log('=== SEND_DATA: Data length:', encoded.length, 'bytes ===');

      // Use writeWithoutResponse - NUS RX characteristic uses WRITE_WITHOUT_RESPONSE property
      await BleClient.writeWithoutResponse(
        this.currentDevice.deviceId,
        NUS_SERVICE_UUID,
        NUS_RX_CHARACTERISTIC_UUID,
        dataView,
      );

      console.log('=== SEND_DATA: Write successful! TX:', data, '===');
      return true;
    } catch (error) {
      console.error('=== SEND_DATA: Write FAILED! ===', error);
      this.handleError(error as BleError);
      return false;
    }
  }

  /**
   * Send a JSON command to ESP32
   */
  async sendCommand(command: object): Promise<boolean> {
    const json = JSON.stringify(command);
    return this.sendData(json);
  }

  // ============================================================================
  // ESP32 Protocol Commands
  // ============================================================================

  /**
   * Ping device to check connection and get basic info
   */
  async ping(): Promise<ESP32Response | null> {
    console.log('=== PING: Starting ===');
    const sent = await this.sendCommand({ cmd: 'ping' });
    console.log('=== PING: Command sent:', sent, '===');
    if (!sent) {
      console.log('=== PING: Failed to send command ===');
      return null;
    }

    try {
      console.log('=== PING: Waiting for pong response (5s timeout)... ===');
      const response = await firstValueFrom(
        this.response$.pipe(
          filter((r) => {
            console.log('=== PING: Checking response:', r, '===');
            return r.type === 'pong';
          }),
          timeout(5000),
        ),
      );
      console.log('=== PING: Got pong response:', response, '===');
      return response;
    } catch (error) {
      console.log('=== PING: Timeout or error waiting for pong ===', error);
      return null;
    }
  }

  /**
   * Get device info
   */
  async getInfo(): Promise<ESP32Response | null> {
    const sent = await this.sendCommand({ cmd: 'get_info' });
    if (!sent) return null;

    try {
      return await firstValueFrom(
        this.response$.pipe(
          filter((r) => r.type === 'info'),
          timeout(5000),
        ),
      );
    } catch {
      return null;
    }
  }

  /**
   * Send full device configuration (WiFi + params)
   * Returns a promise that resolves when the config result is received
   */
  async sendConfig(config: DeviceConfig): Promise<ConfigResult> {
    this.configProgressSubject.next(0);

    const command = {
      cmd: 'config',
      ssid: config.ssid,
      pass: config.pass,
      params: config.params,
    };

    const sent = await this.sendCommand(command);
    if (!sent) {
      return { success: false, error: 'Failed to send command' };
    }

    try {
      // Aspetta il result (con timeout di 30 secondi per dare tempo al WiFi test)
      const result = await firstValueFrom(
        this.response$.pipe(
          filter((r) => r.type === 'result' && r.cmd === 'config'),
          timeout(30000),
        ),
      );

      return {
        success: result.status === 'ok',
        error: result.error,
      };
    } catch {
      return { success: false, error: 'Configuration timeout' };
    }
  }

  /**
   * Test WiFi connection without saving
   */
  async testWifi(ssid: string, password: string): Promise<ConfigResult> {
    this.configProgressSubject.next(0);

    const command = {
      cmd: 'test_wifi',
      ssid,
      pass: password,
    };

    const sent = await this.sendCommand(command);
    if (!sent) {
      return { success: false, error: 'Failed to send command' };
    }

    try {
      const result = await firstValueFrom(
        this.response$.pipe(
          filter((r) => r.type === 'result' && r.cmd === 'test_wifi'),
          timeout(20000),
        ),
      );

      return {
        success: result.status === 'ok',
        error: result.error,
      };
    } catch {
      return { success: false, error: 'WiFi test timeout' };
    }
  }

  /**
   * Reset device configuration
   */
  async resetDevice(): Promise<ConfigResult> {
    const sent = await this.sendCommand({ cmd: 'reset' });
    if (!sent) {
      return { success: false, error: 'Failed to send command' };
    }

    try {
      const result = await firstValueFrom(
        this.response$.pipe(
          filter((r) => r.type === 'result' && r.cmd === 'reset'),
          timeout(5000),
        ),
      );

      return {
        success: result.status === 'ok',
        error: result.error,
      };
    } catch {
      return { success: false, error: 'Reset timeout' };
    }
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  getConnectionState(): BleConnectionState {
    return this.connectionStateSubject.value;
  }

  getConnectedDevice(): CustomBleDevice | null {
    return this.connectedDeviceSubject.value;
  }

  isConnected(): boolean {
    return this.connectionStateSubject.value === BleConnectionState.CONNECTED;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private handleDisconnection(): void {
    this.currentDevice = null;
    this.connectedDeviceSubject.next(null);
    this.connectionStateSubject.next(BleConnectionState.DISCONNECTED);
    this.responseBuffer = '';
    this.configProgressSubject.next(0);
  }

  private handleError(error: BleError): void {
    console.error('Bluetooth Error:', error);
    this.errorSubject.next(error);
  }
}
