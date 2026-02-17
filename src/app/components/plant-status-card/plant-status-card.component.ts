import { Component, Input, Output, EventEmitter, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonRippleEffect } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { LanguageService } from '../../services/language.service';
import {
  leaf,
  thermometer,
  water,
  sunny,
  happy,
  sad,
  helpCircle,
  alertCircle,
  cloudOfflineOutline,
} from 'ionicons/icons';

export type PlantMood = 'happy' | 'ok' | 'sad' | 'unknown';

export interface PlantStatus {
  id: string;
  name: string;
  plantType: string;
  mood: PlantMood;
  temperature: number;
  soilMoisture: number;
  humidity?: number;
  lightHours: number;
  lastUpdate: Date;
  isOnline: boolean;
}

@Component({
  selector: 'app-plant-status-card',
  templateUrl: './plant-status-card.component.html',
  styleUrls: ['./plant-status-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonRippleEffect, TranslateModule],
})
export class PlantStatusCardComponent implements OnDestroy {
  @Input() plant!: PlantStatus;
  @Output() longPress = new EventEmitter<void>();

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressThreshold = 500; // ms

  constructor(private lang: LanguageService) {
    addIcons({
      leaf,
      thermometer,
      water,
      sunny,
      happy,
      sad,
      'help-circle': helpCircle,
      'alert-circle': alertCircle,
      'cloud-offline-outline': cloudOfflineOutline,
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
        return this.lang.instant('mood.happy');
      case 'ok':
        return this.lang.instant('mood.needsAttention');
      case 'sad':
        return this.lang.instant('mood.unhappy');
      default:
        return this.lang.instant('mood.unknown');
    }
  }

  getTimeAgo(): string {
    const now = new Date();
    const diff = now.getTime() - this.plant.lastUpdate.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return this.lang.instant('time.justNow');
    if (minutes < 60) return this.lang.instant('time.minutesAgo', { minutes });

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.lang.instant('time.hoursAgo', { hours });

    const days = Math.floor(hours / 24);
    return this.lang.instant('time.daysAgo', { days });
  }

  onTouchStart(event: TouchEvent): void {
    this.pressTimer = setTimeout(() => {
      this.longPress.emit();
      this.pressTimer = null;
    }, this.longPressThreshold);
  }

  onTouchEnd(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  onTouchMove(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  ngOnDestroy(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }
  }
}
