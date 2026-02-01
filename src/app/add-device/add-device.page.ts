import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonButton,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refresh, bluetoothOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { DeviceCardComponent, Device } from '../components/device-card/device-card.component';
import { BluetoothService } from '../services/bluetooth.service';
import { BleConnectionState } from '../../shared/models/ble-device.model';

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.page.html',
  styleUrls: ['./add-device.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonBackButton,
    IonButtons,
    IonSpinner,
    IonIcon,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    DeviceCardComponent,
  ],
})
export class AddDevicePage implements OnInit, OnDestroy {
  foundDevices: Device[] = [];
  isScanning = false;
  isConnecting = false;
  connectionState: BleConnectionState = BleConnectionState.DISCONNECTED;

  private subscriptions: Subscription[] = [];

  constructor(
    private bluetoothService: BluetoothService,
    private router: Router,
    private alertController: AlertController,
  ) {
    addIcons({ refresh, 'bluetooth-outline': bluetoothOutline });
  }

  async ngOnInit() {
    // Subscribe to discovered devices
    this.subscriptions.push(
      this.bluetoothService.discoveredDevices$.subscribe((devices) => {
        this.foundDevices = devices.map((d) => ({
          deviceId: d.deviceId,
          name: d.name || 'PlantMonitor',
          rssi: d.rssi,
        }));
      }),
    );

    // Subscribe to connection state
    this.subscriptions.push(
      this.bluetoothService.connectionState$.subscribe((state) => {
        this.connectionState = state;
        this.isScanning = state === BleConnectionState.SCANNING;
        this.isConnecting = state === BleConnectionState.CONNECTING;
      }),
    );

    // Subscribe to errors
    this.subscriptions.push(
      this.bluetoothService.errors$.subscribe((error) => {
        this.showError(error.message);
      }),
    );

    // Initialize BLE and start scanning
    await this.initAndScan();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.bluetoothService.stopScanning();
  }

  async initAndScan() {
    try {
      await this.bluetoothService.initializeBLE();

      const enabled = await this.bluetoothService.isBluetoothEnabled();
      if (!enabled) {
        await this.bluetoothService.requestEnableBluetooth();
      }

      await this.startScanning();
    } catch (error) {
      console.error('Failed to initialize BLE:', error);
      this.showError('Failed to initialize Bluetooth. Please make sure Bluetooth is enabled.');
    }
  }

  async startScanning() {
    this.foundDevices = [];
    await this.bluetoothService.scanForESP32Devices();
  }

  async onRefresh() {
    if (!this.isScanning && !this.isConnecting) {
      await this.startScanning();
    }
  }

  async onDeviceSelected(device: Device) {
    if (this.isConnecting) return;

    try {
      await this.bluetoothService.stopScanning();
      await this.bluetoothService.connectToDevice(device.deviceId);

      // Connection successful - navigate to setup page
      // Skip ping for now as ESP32 disconnects after receiving data
      // TODO: Fix ESP32 BLE receive callback
      console.log('Connection successful, navigating to setup...');
      this.router.navigate(['/device-setup'], {
        state: {
          device,
          deviceInfo: null, // No ping response
        },
      });
    } catch (error) {
      console.error('Failed to connect:', error);
      this.showError('Failed to connect to device. Please try again.');
      await this.bluetoothService.disconnect();
    }
  }

  onCancel() {
    this.bluetoothService.stopScanning();
    this.router.navigate(['/home']);
  }

  private async showError(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
