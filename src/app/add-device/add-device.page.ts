import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonFab,
  IonFabButton,
  IonIcon,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonButton,
} from '@ionic/angular/standalone';
import { DeviceCardComponent, Device } from '../components/device-card/device-card.component';

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
    IonFabButton,
    IonFab,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    DeviceCardComponent,
  ],
})
export class AddDevicePage implements OnInit {
  // Mock devices for testing
  foundDevices: Device[] = [
    {
      id: '1',
      name: 'Plant Monitor',
      macAddress: 'AA:BB:CC:DD:EE:01',
      signalStrength: 85,
    },
    {
      id: '2',
      name: 'Plant Monitor',
      macAddress: 'AA:BB:CC:DD:EE:02',
      signalStrength: 60,
    },
  ];

  constructor() {}

  ngOnInit() {}
  onCancel() {}
}
