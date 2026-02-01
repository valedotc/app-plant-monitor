import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonFab,
  IonFabButton,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { add, leafOutline } from 'ionicons/icons';
import {
  PlantStatusCardComponent,
  PlantStatus,
} from '../components/plant-status-card/plant-status-card.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonFab,
    IonFabButton,
    RouterLink,
    PlantStatusCardComponent,
  ],
})
export class HomePage {
  // Mock plants for testing - will be populated after device configuration
  plants: PlantStatus[] = [
    {
      id: '1',
      name: 'Living Room Fern',
      plantType: 'Fern',
      mood: 'happy',
      temperature: 22,
      soilMoisture: 65,
      lightHours: 6,
      lastUpdate: new Date(Date.now() - 5 * 60000), // 5 min ago
    },
    {
      id: '2',
      name: 'Kitchen Basil',
      plantType: 'Herb',
      mood: 'ok',
      temperature: 24,
      soilMoisture: 35,
      lightHours: 8,
      lastUpdate: new Date(Date.now() - 30 * 60000), // 30 min ago
    },
  ];

  constructor() {
    addIcons({ leafOutline });
    addIcons({ add });
  }
}
