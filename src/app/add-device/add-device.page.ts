import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonSpinner,
  IonButtons,
  IonButton,
  IonNav,
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refresh, bluetoothOutline, close } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { DeviceCardComponent, Device } from '../components/device-card/device-card.component';
import { BluetoothService } from '../services/bluetooth.service';
import { BleConnectionState } from '../../shared/models/ble-device.model';
import { SelectedPage } from './selected/selected.page';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.page.html',
  styleUrls: ['./add-device.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonSpinner,
    IonIcon,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    TranslateModule,
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
    private modalCtrl: ModalController,
    private nav: IonNav,
    private alertController: AlertController,
    private lang: LanguageService
  ) {
    addIcons({ refresh, 'bluetooth-outline': bluetoothOutline, close });
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
      this.showError(this.lang.instant('addDevice.bluetoothError'));
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

      // Ping to verify connection and get device info
      console.log('Connection successful, pinging device...');
      const deviceInfo = await this.bluetoothService.ping();

      if (!deviceInfo) {
        console.warn('No pong response, continuing anyway...');
      } else {
        console.log('Pong received:', deviceInfo);
      }

      // Navigate to setup page
      await this.nav.push(SelectedPage, {
        device,
        deviceInfo,
      });
    } catch (error) {
      console.error('Failed to connect:', error);
      this.showError(this.lang.instant('addDevice.connectionError'));
      await this.bluetoothService.disconnect();
    }
  }

  onCancel() {
    this.bluetoothService.stopScanning();
    this.modalCtrl.dismiss(null, 'cancel');
  }

  private async showError(message: string) {
    const alert = await this.alertController.create({
      header: this.lang.instant('common.error'),
      message,
      buttons: [this.lang.instant('common.ok')],
    });
    await alert.present();
  }
}
