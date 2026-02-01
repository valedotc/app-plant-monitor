import { Component, OnInit } from '@angular/core';
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
  chevronForward,
  thermometer,
  water,
  sunny,
  rose,
} from 'ionicons/icons';

interface WifiNetwork {
  ssid: string;
  strength: number;
  secured: boolean;
}

interface PlantType {
  id: string;
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
  ],
})
export class SelectedPage implements OnInit {
  currentStep = 1;

  steps: Step[] = [
    { number: 1, label: 'WiFi' },
    { number: 2, label: 'Device' },
    { number: 3, label: 'Settings' },
    { number: 4, label: 'Review' },
  ];

  // Step 1: WiFi
  availableNetworks: WifiNetwork[] = [
    { ssid: 'Home Network', strength: 85, secured: true },
    { ssid: 'Guest WiFi', strength: 70, secured: true },
    { ssid: 'Neighbor_5G', strength: 45, secured: true },
    { ssid: 'OpenNetwork', strength: 60, secured: false },
  ];
  selectedNetwork = '';
  wifiPassword = '';
  showPassword = false;

  // Step 2: Device Info
  deviceName = '';
  plantTypes: PlantType[] = [
    {
      id: 'succulent',
      name: 'Succulent',
      icon: 'leaf',
      presets: {
        temperature: { lower: 18, upper: 26 },
        soilMoisture: { lower: 10, upper: 30 },
        lightHours: { lower: 4, upper: 6 },
      },
    },
    {
      id: 'tropical',
      name: 'Tropical',
      icon: 'flower',
      presets: {
        temperature: { lower: 20, upper: 30 },
        soilMoisture: { lower: 60, upper: 80 },
        lightHours: { lower: 10, upper: 14 },
      },
    },
    {
      id: 'fern',
      name: 'Fern',
      icon: 'leaf',
      presets: {
        temperature: { lower: 16, upper: 24 },
        soilMoisture: { lower: 50, upper: 70 },
        lightHours: { lower: 4, upper: 8 },
      },
    },
    {
      id: 'flowering',
      name: 'Flowering',
      icon: 'rose',
      presets: {
        temperature: { lower: 18, upper: 25 },
        soilMoisture: { lower: 40, upper: 60 },
        lightHours: { lower: 6, upper: 10 },
      },
    },
    {
      id: 'herb',
      name: 'Herb',
      icon: 'leaf',
      presets: {
        temperature: { lower: 18, upper: 28 },
        soilMoisture: { lower: 40, upper: 60 },
        lightHours: { lower: 6, upper: 10 },
      },
    },
    {
      id: 'custom',
      name: 'Custom',
      icon: 'options',
      presets: {
        temperature: { lower: 18, upper: 28 },
        soilMoisture: { lower: 40, upper: 70 },
        lightHours: { lower: 6, upper: 12 },
      },
    },
  ];
  selectedPlant = '';

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
      description: 'Daily light exposure for your plant',
      icon: 'sunny',
      unit: 'h',
      min: 0,
      max: 24,
      value: { lower: 6, upper: 12 },
      expanded: false,
    },
  ];

  constructor() {
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
      'chevron-forward': chevronForward,
      thermometer,
      water,
      sunny,
      rose,
    });
  }

  ngOnInit() {}

  // WiFi methods
  selectNetwork(ssid: string) {
    this.selectedNetwork = ssid;
    // Reset password when switching networks
    this.wifiPassword = '';
  }

  isSelectedNetworkSecured(): boolean {
    const network = this.availableNetworks.find((n) => n.ssid === this.selectedNetwork);
    return network?.secured ?? false;
  }

  getSignalLabel(strength: number): string {
    if (strength > 70) return 'Excellent signal';
    if (strength > 40) return 'Good signal';
    return 'Weak signal';
  }

  getSignalColor(strength: number): string {
    if (strength > 70) return 'primary';
    if (strength > 40) return 'warning';
    return 'danger';
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Plant methods
  selectPlant(plantId: string) {
    this.selectedPlant = plantId;

    if (!this.deviceName) {
      const plant = this.plantTypes.find((p) => p.id === plantId);
      if (plant) {
        this.deviceName = `My ${plant.name}`;
      }
    }

    this.applyPlantPresets(plantId);
  }

  applyPlantPresets(plantId: string) {
    const plant = this.plantTypes.find((p) => p.id === plantId);
    if (!plant) return;

    const presets = plant.presets;

    this.parameters = this.parameters.map((param) => {
      const presetKey = param.id as keyof PlantPresets;
      if (presets[presetKey]) {
        return { ...param, value: { ...presets[presetKey] } };
      }
      return param;
    });
  }

  getPlantName(plantId: string): string {
    const plant = this.plantTypes.find((p) => p.id === plantId);
    return plant ? plant.name : '';
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
        if (!this.selectedNetwork) return false;
        if (this.isSelectedNetworkSecured() && !this.wifiPassword) return false;
        return true;
      case 2:
        return !!this.deviceName && !!this.selectedPlant;
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
    if (step >= 1 && step <= 4) {
      this.currentStep = step;
    }
  }

  confirmSetup() {
    const config = {
      wifi: {
        ssid: this.selectedNetwork,
        password: this.wifiPassword,
      },
      device: {
        name: this.deviceName,
        plantType: this.selectedPlant,
      },
      parameters: this.parameters.map((p) => ({
        id: p.id,
        min: p.value.lower,
        max: p.value.upper,
        unit: p.unit,
      })),
    };

    console.log('Device configuration:', config);
  }
}
