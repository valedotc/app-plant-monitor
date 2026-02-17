import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  ActionSheetController,
  AlertController,
  ModalController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, leafOutline, trash, close } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import {
  PlantStatusCardComponent,
  PlantStatus,
} from '../components/plant-status-card/plant-status-card.component';
import { ConfigurationService, SavedPlant } from '../services/configuration.service';
import { PlantDataService, DeviceOverview } from '../services/plant-data.service';
import { AddDeviceModalComponent } from '../add-device/add-device-modal.component';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonFab,
    IonFabButton,
    IonRefresher,
    IonRefresherContent,
    PlantStatusCardComponent,
  ],
})
export class HomePage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  plants: PlantStatus[] = [];
  private configSubscription?: Subscription;
  private devicesSubscription?: Subscription;
  private deviceData: Map<string, DeviceOverview> = new Map();

  constructor(
    private configService: ConfigurationService,
    private plantDataService: PlantDataService,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private router: Router,
    private lang: LanguageService
  ) {
    addIcons({ leafOutline, add, trash, close });
  }

  ngOnInit() {
    // Subscribe to saved plants changes
    this.configSubscription = this.configService.plants$.subscribe((savedPlants) => {
      this.plants = this.convertToPlantStatus(savedPlants);
      this.updatePlantsWithRealData();
    });

    // Subscribe to real-time device data updates
    this.devicesSubscription = this.plantDataService.devices$.subscribe((devices) => {
      if (devices.length > 0) {
        this.deviceData.clear();
        devices.forEach((d) => {
          this.deviceData.set(d.deviceId, d);
          if (d.numericDeviceId !== undefined) {
            this.deviceData.set(`numeric_${d.numericDeviceId}`, d);
          }
        });
        this.updatePlantsWithRealData();
      }
    });
  }

  ionViewWillEnter() {
    // Start polling when page becomes visible
    this.plantDataService.startPolling();
  }

  ionViewWillLeave() {
    // Stop polling when leaving page
    this.plantDataService.stopPolling();
  }

  ngOnDestroy() {
    this.configSubscription?.unsubscribe();
    this.devicesSubscription?.unsubscribe();
  }

  async handleRefresh(event: CustomEvent) {
    await this.configService.loadPlants();
    await this.plantDataService.refreshDevices();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async openAddDevice() {
    const modal = await this.modalCtrl.create({
      component: AddDeviceModalComponent,
      cssClass: 'full-screen-modal',
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data?.added) {
      await this.configService.loadPlants();
    }
  }

  onPlantClick(plant: PlantStatus) {
    this.router.navigate(['/plant', plant.id]);
  }

  async onPlantLongPress(plant: PlantStatus) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: plant.name,
      buttons: [
        {
          text: this.lang.instant('home.deleteDevice'),
          role: 'destructive',
          icon: 'trash',
          handler: () => {
            this.confirmDelete(plant);
          },
        },
        {
          text: this.lang.instant('common.cancel'),
          role: 'cancel',
          icon: 'close',
        },
      ],
    });

    await actionSheet.present();
  }

  private async confirmDelete(plant: PlantStatus) {
    const alert = await this.alertCtrl.create({
      header: this.lang.instant('home.deleteConfirmTitle'),
      message: this.lang.instant('home.deleteConfirmMessage', { name: plant.name }),
      buttons: [
        {
          text: this.lang.instant('common.cancel'),
          role: 'cancel',
        },
        {
          text: this.lang.instant('common.delete'),
          role: 'destructive',
          handler: async () => {
            await this.configService.deletePlant(plant.id);
          },
        },
      ],
    });

    await alert.present();
  }

  private updatePlantsWithRealData() {
    const savedPlants = this.configService.getPlants();

    this.plants = this.plants.map((plant) => {
      const savedPlant = savedPlants.find((p) => p.id === plant.id);
      const espDeviceId = savedPlant?.parameters?.deviceId;

      let data: DeviceOverview | undefined;

      if (espDeviceId !== undefined) {
        // Try matching by numeric device ID first
        data = this.deviceData.get(`numeric_${espDeviceId}`);

        // Fallback: try matching by constructed string ID
        if (!data) {
          const deviceKey = `esp32_${String(espDeviceId).padStart(3, '0')}`;
          data = this.deviceData.get(deviceKey);
        }
      }

      if (data) {
        const params = savedPlant?.parameters;
        const isOnline = this.plantDataService.isDeviceOnline(data.lastSeen);
        return {
          ...plant,
          temperature: data.temperature,
          soilMoisture: data.moisture,
          humidity: data.humidity,
          lightHours: data.light ? 1 : 0,
          lastUpdate: new Date(data.lastSeen),
          mood: this.calculateMood(data, params),
          isOnline,
        };
      }

      return { ...plant, isOnline: false };
    });
  }

  private calculateMood(
    data: DeviceOverview,
    params?: { tempMin?: number; tempMax?: number; moistureMin?: number; moistureMax?: number }
  ): 'happy' | 'ok' | 'sad' | 'unknown' {
    if (!params) return 'unknown';

    let issues = 0;

    // Check temperature
    if (params.tempMin && params.tempMax) {
      if (data.temperature < params.tempMin || data.temperature > params.tempMax) {
        issues++;
      }
    }

    // Check moisture
    if (params.moistureMin && params.moistureMax) {
      if (data.moisture < params.moistureMin || data.moisture > params.moistureMax) {
        issues++;
      }
    }

    if (issues === 0) return 'happy';
    if (issues === 1) return 'ok';
    return 'sad';
  }

  private convertToPlantStatus(savedPlants: SavedPlant[]): PlantStatus[] {
    return savedPlants.map((saved) => ({
      id: saved.id,
      name: saved.name,
      plantType: saved.plantType,
      mood: 'unknown' as const,
      temperature: 0,
      soilMoisture: 0,
      lightHours: 0,
      lastUpdate: new Date(saved.lastSeen || saved.createdAt),
      isOnline: false,
    }));
  }
}
