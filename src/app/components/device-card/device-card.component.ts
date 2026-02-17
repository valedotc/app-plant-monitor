import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonRippleEffect } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { leaf, wifi, chevronForward, bluetooth } from 'ionicons/icons';

export interface Device {
  deviceId: string;
  name: string;
  rssi?: number;
}

@Component({
  selector: 'app-device-card',
  templateUrl: './device-card.component.html',
  styleUrls: ['./device-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonRippleEffect],
})
export class DeviceCardComponent {
  @Input() device!: Device;
  @Output() deviceSelected = new EventEmitter<Device>();

  constructor() {
    addIcons({
      leaf,
      wifi,
      bluetooth,
      'chevron-forward': chevronForward,
    });
  }

  onCardClick() {
    this.deviceSelected.emit(this.device);
  }

  /**
   * Convert RSSI (dBm, negative values) to signal bars (1-4)
   * Typical BLE RSSI range: -30 dBm (excellent) to -100 dBm (very weak)
   */
  getSignalBars(): number {
    const rssi = this.device.rssi ?? -80;
    if (rssi > -50) return 4; // Excellent
    if (rssi > -65) return 3; // Good
    if (rssi > -80) return 2; // Fair
    return 1; // Weak
  }

  /**
   * Get signal strength as percentage (for display)
   */
  getSignalPercentage(): number {
    const rssi = this.device.rssi ?? -80;
    // Map -100 to -30 dBm range to 0-100%
    const percent = Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
    return Math.round(percent);
  }
}
