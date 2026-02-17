import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  thermometer,
  water,
  leaf,
  sunny,
  sunnyOutline,
  alertCircle,
  checkmarkCircle,
  timeOutline,
  statsChart,
  cloudOfflineOutline,
} from 'ionicons/icons';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import {
  PlantDataService,
  DeviceSummary,
  StatsResponse,
  ChartDataPoint,
} from '../services/plant-data.service';
import { ConfigurationService, SavedPlant } from '../services/configuration.service';
import { LanguageService } from '../services/language.service';

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend
);

type StatPeriod = '24h' | '7d' | '30d';

interface StatCard {
  id: string;
  labelKey: string;
  value: number | null;
  unit: string;
  icon: string;
  color: string;
  min?: number;
  max?: number;
  status: 'normal' | 'warning' | 'critical';
}

@Component({
  selector: 'app-plant-detail',
  templateUrl: './plant-detail.page.html',
  styleUrls: ['./plant-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    BaseChartDirective,
    TranslateModule,
  ],
})
export class PlantDetailPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  plant: SavedPlant | null = null;
  summary: DeviceSummary | null = null;
  isLoading = true;
  error: string | null = null;
  isOnline = false;

  selectedPeriod: StatPeriod = '24h';
  stats: ChartDataPoint[] = [];

  statCards: StatCard[] = [];

  // Chart configuration
  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#a0a0a0',
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#666',
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#666',
        },
      },
    },
  };

  chartType: ChartType = 'line';

  private destroy$ = new Subject<void>();
  private deviceId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private plantDataService: PlantDataService,
    private configService: ConfigurationService,
    private lang: LanguageService
  ) {
    addIcons({
      thermometer,
      water,
      leaf,
      sunny,
      'sunny-outline': sunnyOutline,
      'alert-circle': alertCircle,
      'checkmark-circle': checkmarkCircle,
      'time-outline': timeOutline,
      'stats-chart': statsChart,
      'cloud-offline-outline': cloudOfflineOutline,
    });
  }

  async ngOnInit() {
    // Get plant ID from route
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(async (params) => {
      const plantId = params.get('id');
      if (plantId) {
        await this.loadPlant(plantId);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    // Start polling when page becomes visible
    this.plantDataService.startPolling();

    // Subscribe to device updates for online status
    this.plantDataService.devices$
      .pipe(takeUntil(this.destroy$))
      .subscribe((devices) => {
        this.updateOnlineStatus(devices);
      });
  }

  ionViewWillLeave() {
    // Stop polling when leaving page
    this.plantDataService.stopPolling();
  }

  private updateOnlineStatus(devices: { deviceId: string; numericDeviceId?: number; lastSeen: Date }[]) {
    if (!this.plant?.parameters?.deviceId) return;

    const espDeviceId = this.plant.parameters.deviceId;
    const device = devices.find(
      (d) => d.numericDeviceId === espDeviceId ||
        d.deviceId === `esp32_${String(espDeviceId).padStart(3, '0')}`
    );

    if (device) {
      this.isOnline = this.plantDataService.isDeviceOnline(device.lastSeen);
    } else {
      this.isOnline = false;
    }
  }

  private async loadPlant(plantId: string) {
    try {
      this.isLoading = true;
      this.error = null;

      // Load plant config from local storage
      const plants = await this.configService.getPlants();
      this.plant = plants.find((p) => p.id === plantId) || null;

      if (!this.plant) {
        this.error = this.lang.instant('plantDetail.errors.notFound');
        this.isLoading = false;
        return;
      }

      // Extract the ESP32 device ID from the saved plant
      // The deviceId saved is the BLE ID, but for MongoDB we need the esp32_XXX format
      // We'll use the device_id from parameters (DEVICE_ID index)
      this.deviceId = `esp32_${String(this.plant.parameters?.deviceId || '005').padStart(3, '0')}`;

      await this.loadData();
    } catch (error) {
      console.error('Error loading plant:', error);
      this.error = this.lang.instant('plantDetail.errors.loadFailed');
    } finally {
      this.isLoading = false;
    }
  }

  private async loadData() {
    if (!this.deviceId) return;

    try {
      // Load summary and stats in parallel
      const [summaryResult, statsResult] = await Promise.all([
        this.plantDataService.getDeviceSummary(this.deviceId).toPromise(),
        this.plantDataService.getStats(this.deviceId, this.selectedPeriod).toPromise(),
      ]);

      this.summary = summaryResult || null;
      this.stats = statsResult?.data || [];

      this.updateStatCards();
      this.updateChart();
    } catch (error) {
      console.error('Error loading data:', error);
      // Don't show error if it's just no data yet
    }
  }

  private updateStatCards() {
    if (!this.summary?.latest) {
      this.statCards = [];
      return;
    }

    const latest = this.summary.latest;
    const params = this.plant?.parameters;

    this.statCards = [
      {
        id: 'temperature',
        labelKey: 'parameters.temperature',
        value: latest.temperature,
        unit: '°C',
        icon: 'thermometer',
        color: '#ef4444',
        min: params?.tempMin,
        max: params?.tempMax,
        status: this.getStatus(latest.temperature, params?.tempMin, params?.tempMax),
      },
      {
        id: 'humidity',
        labelKey: 'parameters.humidity',
        value: latest.humidity,
        unit: '%',
        icon: 'water',
        color: '#3b82f6',
        min: params?.humidityMin,
        max: params?.humidityMax,
        status: this.getStatus(latest.humidity, params?.humidityMin, params?.humidityMax),
      },
      {
        id: 'moisture',
        labelKey: 'parameters.soilMoisture',
        value: latest.moisture,
        unit: '%',
        icon: 'leaf',
        color: '#22c55e',
        min: params?.moistureMin,
        max: params?.moistureMax,
        status: this.getStatus(latest.moisture, params?.moistureMin, params?.moistureMax),
      },
      {
        id: 'light',
        labelKey: 'parameters.light',
        value: latest.light ? 1 : 0,
        unit: latest.light ? this.lang.instant('plantDetail.lightOn') : this.lang.instant('plantDetail.lightOff'),
        icon: latest.light ? 'sunny' : 'sunny-outline',
        color: '#eab308',
        status: 'normal',
      },
    ];
  }

  private getStatus(
    value: number | null | undefined,
    min: number | undefined,
    max: number | undefined
  ): 'normal' | 'warning' | 'critical' {
    if (value === null || value === undefined) return 'normal';
    if (min === undefined || max === undefined) return 'normal';

    if (value < min || value > max) {
      const diff = value < min ? min - value : value - max;
      const range = max - min;
      return diff > range * 0.2 ? 'critical' : 'warning';
    }
    return 'normal';
  }

  private updateChart() {
    if (!this.stats.length) {
      this.chartData = { labels: [], datasets: [] };
      return;
    }

    const labels = this.stats.map((s) => this.formatChartLabel(s.timestamp));

    this.chartData = {
      labels,
      datasets: [
        {
          label: this.lang.instant('plantDetail.chart.temperature'),
          data: this.stats.map((s) => s.temperature.avg),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
        },
        {
          label: this.lang.instant('plantDetail.chart.humidity'),
          data: this.stats.map((s) => s.humidity.avg),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
        },
        {
          label: this.lang.instant('plantDetail.chart.soilMoisture'),
          data: this.stats.map((s) => s.moisture.avg),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
        },
      ],
    };

    // Update chart if it exists
    if (this.chart) {
      this.chart.update();
    }
  }

  private formatChartLabel(timestamp: string): string {
    const date = new Date(timestamp);

    if (this.selectedPeriod === '24h') {
      return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    }
  }

  onPeriodChange(event: CustomEvent) {
    this.selectedPeriod = event.detail.value as StatPeriod;
    this.loadData();
  }

  async onRefresh(event: RefresherCustomEvent) {
    await this.loadData();
    event.target.complete();
  }

  formatLastSeen(date: Date | undefined): string {
    if (!date) return this.lang.instant('time.na');
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return this.lang.instant('time.justNow');
    if (minutes < 60) return this.lang.instant('time.minutesAgo', { minutes });
    if (minutes < 1440) return this.lang.instant('time.hoursAgo', { hours: Math.floor(minutes / 60) });
    const days = Math.floor(minutes / 1440);
    return this.lang.instant('time.daysAgo', { days });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'critical':
        return 'var(--ion-color-danger)';
      case 'warning':
        return 'var(--ion-color-warning)';
      default:
        return 'var(--ion-color-success)';
    }
  }
}
