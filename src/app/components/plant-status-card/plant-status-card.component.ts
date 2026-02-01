import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonRippleEffect } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  leaf,
  thermometer,
  water,
  sunny,
  happy,
  sad,
  helpCircle,
  alertCircle,
} from 'ionicons/icons';

export type PlantMood = 'happy' | 'ok' | 'sad' | 'unknown';

export interface PlantStatus {
  id: string;
  name: string;
  plantType: string;
  mood: PlantMood;
  temperature: number;
  soilMoisture: number;
  lightHours: number;
  lastUpdate: Date;
}

@Component({
  selector: 'app-plant-status-card',
  templateUrl: './plant-status-card.component.html',
  styleUrls: ['./plant-status-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonRippleEffect],
})
export class PlantStatusCardComponent {
  @Input() plant!: PlantStatus;

  constructor() {
    addIcons({
      leaf,
      thermometer,
      water,
      sunny,
      happy,
      sad,
      'help-circle': helpCircle,
      'alert-circle': alertCircle,
    });
  }

  getMoodIcon(): string {
    switch (this.plant.mood) {
      case 'happy':
        return 'happy';
      case 'ok':
        return 'help-circle';
      case 'sad':
        return 'sad';
      default:
        return 'alert-circle';
    }
  }

  getMoodColor(): string {
    switch (this.plant.mood) {
      case 'happy':
        return 'success';
      case 'ok':
        return 'warning';
      case 'sad':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getMoodLabel(): string {
    switch (this.plant.mood) {
      case 'happy':
        return 'Happy';
      case 'ok':
        return 'Needs attention';
      case 'sad':
        return 'Unhappy';
      default:
        return 'Unknown';
    }
  }

  getTimeAgo(): string {
    const now = new Date();
    const diff = now.getTime() - this.plant.lastUpdate.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
