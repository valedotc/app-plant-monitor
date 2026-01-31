import { Component } from '@angular/core';
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

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonFab,
    IonFabButton,
    RouterLink,
  ],
})
export class HomePage {
  constructor() {
    addIcons({ leafOutline });
    addIcons({ add });
  }
}
