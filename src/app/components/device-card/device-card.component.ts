import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon, IonRippleEffect } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { leaf, wifi, chevronForward, bluetooth } from 'ionicons/icons';

export interface Device {
  id: string;
  name: string;
  macAddress: string;
  signalStrength: number;
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

  constructor(private router: Router) {
    addIcons({
      leaf,
      wifi,
      bluetooth,
      'chevron-forward': chevronForward,
    });
  }

  onCardClick() {
    this.router.navigate(['/device-setup']);
  }

  getSignalBars(): number {
    if (this.device.signalStrength > 75) return 4;
    if (this.device.signalStrength > 50) return 3;
    if (this.device.signalStrength > 25) return 2;
    return 1;
  }
}
