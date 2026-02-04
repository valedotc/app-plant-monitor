import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { IonNav } from '@ionic/angular/standalone';
import { AddDevicePage } from './add-device.page';

@Component({
  selector: 'app-add-device-modal',
  template: `<ion-nav #nav></ion-nav>`,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      ion-nav {
        height: 100%;
      }
    `,
  ],
  standalone: true,
  imports: [IonNav],
})
export class AddDeviceModalComponent implements AfterViewInit {
  @ViewChild('nav') nav!: IonNav;

  ngAfterViewInit() {
    this.nav.setRoot(AddDevicePage);
  }
}
