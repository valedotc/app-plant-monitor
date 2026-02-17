import { Component, OnInit, OnDestroy, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  IonNav,
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  wifi,
  lockClosed,
  lockOpen,
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
  refresh,
  add,
  addCircleOutline,
  chevronForward,
  close,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import {
  BluetoothService,
  DeviceConfig,
  ParamIndex,
  ESP32Response,
  WiFiNetwork,
} from '../../services/bluetooth.service';
import {
  ConfigurationService,
  PlantParameters,
} from '../../services/configuration.service';
import { Device } from '../../components/device-card/device-card.component';
import { LanguageService } from '../../services/language.service';

interface PlantType {
  id: number;
  nameKey: string; // Translation key
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
  nameKey: string; // Translation key
  descKey: string; // Translation key
  icon: string;
  unit: string;
  min: number;
  max: number;
  value: { lower: number; upper: number };
  expanded: boolean;
}

interface Step {
  number: number;
  labelKey: string; // Translation key
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
    TranslateModule,
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
    { number: 1, labelKey: 'setup.steps.wifi' },
    { number: 2, labelKey: 'setup.steps.device' },
    { number: 3, labelKey: 'setup.steps.settings' },
    { number: 4, labelKey: 'setup.steps.review' },
  ];

  // Device info from previous page (passed via ion-nav)
  @Input() device: Device | null = null;
  @Input() deviceInfo: ESP32Response | null = null;

  // ViewChild references for auto-focus
  @ViewChild('passwordInput') passwordInput?: IonInput;
  @ViewChild('manualPasswordInput') manualPasswordInput?: IonInput;

  // Step 1: WiFi
  wifiSsid = '';
  wifiPassword = '';
  showPassword = false;
  isTestingWifi = false;
  wifiTestResult: 'none' | 'success' | 'error' = 'none';

  // WiFi Scan
  wifiNetworks: WiFiNetwork[] = [];
  isScanning = false;
  showManualEntry = false;
  selectedNetwork: WiFiNetwork | null = null;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private lastScanTime = 0;
  private readonly SCAN_COOLDOWN = 3000; // Min time between scans
  private readonly AUTO_REFRESH_INTERVAL = 15000; // Auto refresh every 15s

  // Step 2: Device Info
  deviceName = '';
  plantTypes: PlantType[] = [
    {
      id: 1,
      nameKey: 'plants.succulent',
      icon: 'leaf',
      presets: {
        temperature: { lower: 18, upper: 26 },
        soilMoisture: { lower: 10, upper: 30 },
        lightHours: { lower: 4, upper: 6 },
      },
    },
    {
      id: 2,
      nameKey: 'plants.tropical',
      icon: 'flower',
      presets: {
        temperature: { lower: 20, upper: 30 },
        soilMoisture: { lower: 60, upper: 80 },
        lightHours: { lower: 10, upper: 14 },
      },
    },
    {
      id: 3,
      nameKey: 'plants.fern',
      icon: 'leaf',
      presets: {
        temperature: { lower: 16, upper: 24 },
        soilMoisture: { lower: 50, upper: 70 },
        lightHours: { lower: 4, upper: 8 },
      },
    },
    {
      id: 4,
      nameKey: 'plants.flowering',
      icon: 'rose',
      presets: {
        temperature: { lower: 18, upper: 25 },
        soilMoisture: { lower: 40, upper: 60 },
        lightHours: { lower: 6, upper: 10 },
      },
    },
    {
      id: 5,
      nameKey: 'plants.herb',
      icon: 'leaf',
      presets: {
        temperature: { lower: 18, upper: 28 },
        soilMoisture: { lower: 40, upper: 60 },
        lightHours: { lower: 6, upper: 10 },
      },
    },
    {
      id: 6,
      nameKey: 'plants.custom',
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
      nameKey: 'parameters.temperature',
      descKey: 'parameters.temperatureDesc',
      icon: 'thermometer',
      unit: '°C',
      min: 0,
      max: 50,
      value: { lower: 18, upper: 28 },
      expanded: false,
    },
    {
      id: 'soilMoisture',
      nameKey: 'parameters.soilMoisture',
      descKey: 'parameters.soilMoistureDesc',
      icon: 'water',
      unit: '%',
      min: 0,
      max: 100,
      value: { lower: 40, upper: 70 },
      expanded: false,
    },
    {
      id: 'lightHours',
      nameKey: 'parameters.lightHours',
      descKey: 'parameters.lightHoursDesc',
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
    private nav: IonNav,
    private modalCtrl: ModalController,
    private bluetoothService: BluetoothService,
    private configService: ConfigurationService,
    private alertController: AlertController,
    public lang: LanguageService
  ) {
    addIcons({
      wifi,
      'lock-closed': lockClosed,
      'lock-open': lockOpen,
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
      'chevron-forward': chevronForward,
      thermometer,
      water,
      sunny,
      rose,
      'cloud-upload': cloudUpload,
      'alert-circle': alertCircle,
      refresh,
      add,
      'add-circle-outline': addCircleOutline,
      close,
    });
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
      this.showError(this.lang.instant('setup.errors.noDevice'));
    } else {
      // Start WiFi scan
      this.startWifiScan();
      this.startAutoRefresh();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.stopAutoRefresh();
  }

  private getStatusText(state: string): string {
    switch (state) {
      case 'saving_config':
        return this.lang.instant('setup.status.savingConfig');
      case 'connecting_wifi':
        return this.lang.instant('setup.status.connectingWifi');
      case 'wifi_connected':
        return this.lang.instant('setup.status.wifiConnected');
      default:
        return this.lang.instant('setup.status.configuring');
    }
  }

  // WiFi methods
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async testWifiConnection() {
    // For open networks, password can be empty
    const needsPassword = !this.selectedNetwork || this.selectedNetwork.secure;
    if (!this.wifiSsid || (needsPassword && !this.wifiPassword)) return;

    this.isTestingWifi = true;
    this.wifiTestResult = 'none';

    const result = await this.bluetoothService.testWifi(this.wifiSsid, this.wifiPassword || '');

    this.isTestingWifi = false;
    this.wifiTestResult = result.success ? 'success' : 'error';

    if (!result.success && result.error) {
      this.showError(this.lang.instant('setup.wifi.testFailed', { error: result.error }));
    }
  }

  // WiFi Scan methods
  async startWifiScan() {
    // Prevent overlapping scans
    const now = Date.now();
    if (this.isScanning || now - this.lastScanTime < this.SCAN_COOLDOWN) {
      return;
    }

    this.isScanning = true;
    this.lastScanTime = now;

    try {
      const networks = await this.bluetoothService.scanWiFiNetworks();
      // Limit to 5 networks (best signal)
      this.wifiNetworks = networks.slice(0, 5);
    } catch (error) {
      console.error('WiFi scan failed:', error);
    } finally {
      this.isScanning = false;
    }
  }

  refreshWifiList() {
    this.startWifiScan();
  }

  private startAutoRefresh() {
    // Only auto-refresh when on step 1
    this.scanInterval = setInterval(() => {
      if (this.currentStep === 1 && !this.showManualEntry && !this.isScanning) {
        this.startWifiScan();
      }
    }, this.AUTO_REFRESH_INTERVAL);
  }

  private stopAutoRefresh() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  selectWifiNetwork(network: WiFiNetwork) {
    this.selectedNetwork = network;
    this.wifiSsid = network.ssid;
    this.wifiPassword = '';
    this.wifiTestResult = 'none';
    this.showManualEntry = false;

    // Auto-focus password input if network is secured
    if (network.secure) {
      setTimeout(() => {
        this.passwordInput?.setFocus();
      }, 300);
    }
  }

  clearNetworkSelection() {
    this.selectedNetwork = null;
    this.wifiSsid = '';
    this.wifiPassword = '';
    this.wifiTestResult = 'none';
  }

  onPasswordEnter() {
    if (this.canProceed()) {
      this.nextStep();
    }
  }

  onPasswordChange() {
    // Reset error state when user types
    if (this.wifiTestResult === 'error') {
      this.wifiTestResult = 'none';
    }
  }

  onVisibilityMouseDown(event: Event) {
    // Prevent the button from stealing focus (which closes the keyboard)
    event.preventDefault();
    this.showPassword = !this.showPassword;
  }

  private dismissKeyboard() {
    // Blur any focused input to dismiss the keyboard
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }
  }

  toggleManualEntry() {
    this.showManualEntry = !this.showManualEntry;
    if (this.showManualEntry) {
      this.selectedNetwork = null;
      this.wifiSsid = '';
      this.wifiPassword = '';
      this.wifiTestResult = 'none';
    }
  }

  getSignalStrength(rssi: number): 'excellent' | 'good' | 'fair' | 'weak' {
    if (rssi >= -50) return 'excellent';
    if (rssi >= -60) return 'good';
    if (rssi >= -70) return 'fair';
    return 'weak';
  }

  getSignalBars(rssi: number): number {
    if (rssi >= -50) return 4;
    if (rssi >= -60) return 3;
    if (rssi >= -70) return 2;
    return 1;
  }

  // Plant methods
  selectPlant(plantId: number) {
    this.selectedPlantId = plantId;

    const plant = this.plantTypes.find((p) => p.id === plantId);
    if (plant) {
      if (!this.deviceName) {
        const plantName = this.lang.instant(plant.nameKey);
        this.deviceName = this.lang.instant('plants.myPlant', { type: plantName });
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
    return plant ? this.lang.instant(plant.nameKey) : '';
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
        // Password required only for secure networks
        if (this.selectedNetwork && !this.selectedNetwork.secure) {
          return !!this.wifiSsid;
        }
        return !!this.wifiSsid && !!this.wifiPassword;
      case 2:
        return !!this.deviceName && this.selectedPlantId !== null;
      case 3:
        return true;
      default:
        return true;
    }
  }

  async nextStep() {
    if (this.currentStep >= 4 || !this.canProceed()) return;

    // When leaving step 1, test WiFi credentials first
    if (this.currentStep === 1) {
      this.dismissKeyboard();

      // Skip test for open networks
      const needsPassword = !this.selectedNetwork || this.selectedNetwork.secure;
      if (needsPassword && this.wifiPassword) {
        this.isTestingWifi = true;
        this.wifiTestResult = 'none';

        const result = await this.bluetoothService.testWifi(this.wifiSsid, this.wifiPassword);

        this.isTestingWifi = false;

        if (!result.success) {
          this.wifiTestResult = 'error';
          // Re-focus password input to let user fix it
          setTimeout(() => {
            this.passwordInput?.setFocus();
          }, 100);
          return; // Don't proceed
        }

        this.wifiTestResult = 'success';
      }
    }

    this.currentStep++;
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
    this.configStatusText = this.lang.instant('setup.status.savingConfig');

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
          deviceId: deviceId, // ESP32 device ID for MongoDB queries
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
        this.configStatusText = this.lang.instant('setup.status.complete');

        // Disconnect and close modal after delay
        setTimeout(async () => {
          await this.bluetoothService.disconnect();
          this.modalCtrl.dismiss({ added: true }, 'confirm');
        }, 2000);
      } else {
        this.configState = 'error';
        this.configError = result.error || this.lang.instant('setup.configFailed');
        this.configStatusText = this.lang.instant('setup.configFailed');
      }
    } catch (error) {
      console.error('Configuration error:', error);
      this.configState = 'error';
      this.configError = this.lang.instant('common.error');
      this.configStatusText = this.lang.instant('setup.configFailed');
    }
  }

  retryConfiguration() {
    this.configState = 'idle';
    this.configError = '';
  }

  async cancelConfiguration() {
    await this.bluetoothService.disconnect();
    this.modalCtrl.dismiss(null, 'cancel');
  }

  private async showError(message: string) {
    const alert = await this.alertController.create({
      header: this.lang.instant('common.error'),
      message,
      buttons: [this.lang.instant('common.ok')],
    });
    await alert.present();
  }
}
