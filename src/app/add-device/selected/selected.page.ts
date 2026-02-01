import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonLabel,
  IonRange,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonSpinner,
  IonProgressBar,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  wifi,
  lockClosed,
  eye,
  eyeOff,
  leaf,
  flower,
  options,
  checkmark,
  checkmarkCircle,
  ellipseOutline,
  arrowBack,
  arrowForward,
  chevronDown,
  chevronUp,
  thermometer,
  water,
  sunny,
  rose,
  cloudUpload,
  alertCircle,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import {
  BluetoothService,
  DeviceConfig,
  ParamIndex,
  ESP32Response,
} from '../../services/bluetooth.service';
import {
  ConfigurationService,
  PlantParameters,
} from '../../services/configuration.service';
import { Device } from '../../components/device-card/device-card.component';

interface PlantType {
  id: number;
  name: string;
  icon: string;
  presets: PlantPresets;
}

interface PlantPresets {
  temperature: { lower: number; upper: number };
  soilMoisture: { lower: number; upper: number };
  lightHours: { lower: number; upper: number };
}

interface Parameter {
  id: string;
  name: string;
  description: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  value: { lower: number; upper: number };
  expanded: boolean;
}

interface Step {
  number: number;
  label: string;
}

type ConfigState = 'idle' | 'configuring' | 'success' | 'error';

@Component({
  selector: 'app-selected',
  templateUrl: './selected.page.html',
  styleUrls: ['./selected.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonIcon,
    IonLabel,
    IonRange,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    IonProgressBar,
  ],
})
export class SelectedPage implements OnInit, OnDestroy {
  currentStep = 1;

  steps: Step[] = [
    { number: 1, label: 'WiFi' },
    { number: 2, label: 'Device' },
    { number: 3, label: 'Settings' },
    { number: 4, label: 'Review' },
  ];

  // Device info from previous page
  device: Device | null = null;
  deviceInfo: ESP32Response | null = null;

  // Step 1: WiFi (manual input)
  wifiSsid = '';
  wifiPassword = '';
  showPassword = false;
  isTestingWifi = false;
  wifiTestResult: 'none' | 'success' | 'error' = 'none';

  // Step 2: Device Info
  deviceName = '';
  plantTypes: PlantType[] = [
    {
      id: 1,
      name: 'Succulent',
      icon: 'leaf',
      presets: {
        temperature: { lower: 18, upper: 26 },
        soilMoisture: { lower: 10, upper: 30 },
        lightHours: { lower: 4, upper: 6 },
      },
    },
    {
      id: 2,
      name: 'Tropical',
      icon: 'flower',
      presets: {
        temperature: { lower: 20, upper: 30 },
        soilMoisture: { lower: 60, upper: 80 },
        lightHours: { lower: 10, upper: 14 },
      },
    },
    {
      id: 3,
      name: 'Fern',
      icon: 'leaf',
      presets: {
        temperature: { lower: 16, upper: 24 },
        soilMoisture: { lower: 50, upper: 70 },
        lightHours: { lower: 4, upper: 8 },
      },
    },
    {
      id: 4,
      name: 'Flowering',
      icon: 'rose',
      presets: {
        temperature: { lower: 18, upper: 25 },
        soilMoisture: { lower: 40, upper: 60 },
        lightHours: { lower: 6, upper: 10 },
      },
    },
    {
      id: 5,
      name: 'Herb',
      icon: 'leaf',
      presets: {
        temperature: { lower: 18, upper: 28 },
        soilMoisture: { lower: 40, upper: 60 },
        lightHours: { lower: 6, upper: 10 },
      },
    },
    {
      id: 6,
      name: 'Custom',
      icon: 'options',
      presets: {
        temperature: { lower: 18, upper: 28 },
        soilMoisture: { lower: 40, upper: 70 },
        lightHours: { lower: 6, upper: 12 },
      },
    },
  ];
  selectedPlantId: number | null = null;

  // Step 3: Parameters
  parameters: Parameter[] = [
    {
      id: 'temperature',
      name: 'Temperature',
      description: 'The ideal temperature range for healthy growth',
      icon: 'thermometer',
      unit: '°C',
      min: 0,
      max: 50,
      value: { lower: 18, upper: 28 },
      expanded: false,
    },
    {
      id: 'soilMoisture',
      name: 'Soil Moisture',
      description: 'Optimal soil humidity percentage',
      icon: 'water',
      unit: '%',
      min: 0,
      max: 100,
      value: { lower: 40, upper: 70 },
      expanded: false,
    },
    {
      id: 'lightHours',
      name: 'Light Hours',
      description: 'Minimum daily light exposure for your plant',
      icon: 'sunny',
      unit: 'h',
      min: 0,
      max: 24,
      value: { lower: 6, upper: 12 },
      expanded: false,
    },
  ];

  // Configuration state
  configState: ConfigState = 'idle';
  configProgress = 0;
  configError = '';
  configStatusText = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private bluetoothService: BluetoothService,
    private configService: ConfigurationService,
    private alertController: AlertController,
  ) {
    addIcons({
      wifi,
      'lock-closed': lockClosed,
      eye,
      'eye-off': eyeOff,
      leaf,
      flower,
      options,
      checkmark,
      'checkmark-circle': checkmarkCircle,
      'ellipse-outline': ellipseOutline,
      'arrow-back': arrowBack,
      'arrow-forward': arrowForward,
      'chevron-down': chevronDown,
      'chevron-up': chevronUp,
      thermometer,
      water,
      sunny,
      rose,
      'cloud-upload': cloudUpload,
      'alert-circle': alertCircle,
    });

    // Get device info from navigation state
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.device = nav.extras.state['device'] as Device;
      this.deviceInfo = nav.extras.state['deviceInfo'] as ESP32Response;
    }
  }

  ngOnInit() {
    // Subscribe to config progress
    this.subscriptions.push(
      this.bluetoothService.configProgress$.subscribe((progress) => {
        this.configProgress = progress;
      }),
    );

    // Subscribe to response for status updates
    this.subscriptions.push(
      this.bluetoothService.response$.subscribe((response) => {
        if (response.type === 'status') {
          this.configStatusText = this.getStatusText(response.state || '');
        }
      }),
    );

    // Check if we have a device
    if (!this.device) {
      this.showError('No device selected. Please go back and select a device.');
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private getStatusText(state: string): string {
    switch (state) {
      case 'saving_config':
        return 'Saving configuration...';
      case 'connecting_wifi':
        return 'Connecting to WiFi...';
      case 'wifi_connected':
        return 'WiFi connected!';
      default:
        return 'Configuring device...';
    }
  }

  // WiFi methods
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async testWifiConnection() {
    if (!this.wifiSsid || !this.wifiPassword) return;

    this.isTestingWifi = true;
    this.wifiTestResult = 'none';

    const result = await this.bluetoothService.testWifi(this.wifiSsid, this.wifiPassword);

    this.isTestingWifi = false;
    this.wifiTestResult = result.success ? 'success' : 'error';

    if (!result.success && result.error) {
      this.showError(`WiFi test failed: ${result.error}`);
    }
  }

  // Plant methods
  selectPlant(plantId: number) {
    this.selectedPlantId = plantId;

    const plant = this.plantTypes.find((p) => p.id === plantId);
    if (plant) {
      if (!this.deviceName) {
        this.deviceName = `My ${plant.name}`;
      }
      this.applyPlantPresets(plant);
    }
  }

  private applyPlantPresets(plant: PlantType) {
    const presets = plant.presets;

    this.parameters = this.parameters.map((param) => {
      const presetKey = param.id as keyof PlantPresets;
      if (presets[presetKey]) {
        return { ...param, value: { ...presets[presetKey] } };
      }
      return param;
    });
  }

  getPlantName(plantId: number | null): string {
    if (!plantId) return '';
    const plant = this.plantTypes.find((p) => p.id === plantId);
    return plant ? plant.name : '';
  }

  isPlantSelected(plantId: number): boolean {
    return this.selectedPlantId === plantId;
  }

  // Parameter methods
  toggleParameter(param: Parameter) {
    param.expanded = !param.expanded;
  }

  formatPin(unit: string, value: number): string {
    return `${value}${unit}`;
  }

  // Navigation
  canProceed(): boolean {
    switch (this.currentStep) {
      case 1:
        return !!this.wifiSsid && !!this.wifiPassword;
      case 2:
        return !!this.deviceName && this.selectedPlantId !== null;
      case 3:
        return true;
      default:
        return true;
    }
  }

  nextStep() {
    if (this.currentStep < 4 && this.canProceed()) {
      this.currentStep++;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    if (step >= 1 && step <= 4 && this.configState === 'idle') {
      this.currentStep = step;
    }
  }

  // Configuration
  async confirmSetup() {
    if (!this.device || this.selectedPlantId === null) return;

    this.configState = 'configuring';
    this.configProgress = 0;
    this.configError = '';
    this.configStatusText = 'Sending configuration...';

    try {
      // Get next device ID
      const deviceId = await this.configService.getNextDeviceId();

      // Build params array for ESP32
      // Index: 0=PLANT_TYPE_ID, 1=TEMP_MIN, 2=TEMP_MAX, 3=HUMIDITY_MIN, 4=HUMIDITY_MAX,
      //        5=MOISTURE_MIN, 6=MOISTURE_MAX, 7=LIGHT_HOURS_MIN, 8=DEVICE_ID
      const tempParam = this.parameters.find((p) => p.id === 'temperature');
      const moistureParam = this.parameters.find((p) => p.id === 'soilMoisture');
      const lightParam = this.parameters.find((p) => p.id === 'lightHours');

      const params: number[] = new Array(9).fill(0);
      params[ParamIndex.PLANT_TYPE_ID] = this.selectedPlantId;
      params[ParamIndex.TEMP_MIN] = tempParam?.value.lower ?? 18;
      params[ParamIndex.TEMP_MAX] = tempParam?.value.upper ?? 28;
      params[ParamIndex.HUMIDITY_MIN] = 40; // Default, not in UI
      params[ParamIndex.HUMIDITY_MAX] = 80; // Default, not in UI
      params[ParamIndex.MOISTURE_MIN] = moistureParam?.value.lower ?? 40;
      params[ParamIndex.MOISTURE_MAX] = moistureParam?.value.upper ?? 70;
      params[ParamIndex.LIGHT_HOURS_MIN] = lightParam?.value.lower ?? 6;
      params[ParamIndex.DEVICE_ID] = deviceId;

      const config: DeviceConfig = {
        ssid: this.wifiSsid,
        pass: this.wifiPassword,
        params,
      };

      // Send config to ESP32
      const result = await this.bluetoothService.sendConfig(config);

      if (result.success) {
        // Save plant locally
        const plantParams: PlantParameters = {
          tempMin: params[ParamIndex.TEMP_MIN],
          tempMax: params[ParamIndex.TEMP_MAX],
          humidityMin: params[ParamIndex.HUMIDITY_MIN],
          humidityMax: params[ParamIndex.HUMIDITY_MAX],
          moistureMin: params[ParamIndex.MOISTURE_MIN],
          moistureMax: params[ParamIndex.MOISTURE_MAX],
          lightHoursMin: params[ParamIndex.LIGHT_HOURS_MIN],
        };

        await this.configService.savePlant({
          deviceId: this.device.deviceId,
          name: this.deviceName,
          plantType: this.getPlantName(this.selectedPlantId),
          plantTypeId: this.selectedPlantId,
          wifiSsid: this.wifiSsid,
          parameters: plantParams,
        });

        this.configState = 'success';
        this.configStatusText = 'Configuration complete!';

        // Disconnect and navigate home after delay
        setTimeout(async () => {
          await this.bluetoothService.disconnect();
          this.router.navigate(['/home']);
        }, 2000);
      } else {
        this.configState = 'error';
        this.configError = result.error || 'Configuration failed';
        this.configStatusText = 'Configuration failed';
      }
    } catch (error) {
      console.error('Configuration error:', error);
      this.configState = 'error';
      this.configError = 'An unexpected error occurred';
      this.configStatusText = 'Configuration failed';
    }
  }

  retryConfiguration() {
    this.configState = 'idle';
    this.configError = '';
  }

  async cancelConfiguration() {
    await this.bluetoothService.disconnect();
    this.router.navigate(['/home']);
  }

  private async showError(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
