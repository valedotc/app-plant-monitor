import { Component, OnInit, OnDestroy } from '@angular/core';
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
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, leafOutline, refresh } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import {
  PlantStatusCardComponent,
  PlantStatus,
} from '../components/plant-status-card/plant-status-card.component';
import { ConfigurationService, SavedPlant } from '../services/configuration.service';

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
    IonRefresher,
    IonRefresherContent,
    RouterLink,
    PlantStatusCardComponent,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  plants: PlantStatus[] = [];
  private subscription?: Subscription;

  constructor(private configService: ConfigurationService) {
    addIcons({ leafOutline, add, refresh });
  }

  ngOnInit() {
    this.subscription = this.configService.plants$.subscribe((savedPlants) => {
      this.plants = this.convertToPlantStatus(savedPlants);
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  async handleRefresh(event: CustomEvent) {
    await this.configService.loadPlants();
    (event.target as HTMLIonRefresherElement).complete();
  }

  private convertToPlantStatus(savedPlants: SavedPlant[]): PlantStatus[] {
    return savedPlants.map((saved) => ({
      id: saved.id,
      name: saved.name,
      plantType: saved.plantType,
      // Without real-time MQTT data, show as unknown/offline
      mood: 'unknown' as const,
      temperature: 0,
      soilMoisture: 0,
      lightHours: 0,
      lastUpdate: new Date(saved.lastSeen || saved.createdAt),
    }));
  }
}
