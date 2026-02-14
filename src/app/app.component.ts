import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { LanguageService } from './services/language.service';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(
    private languageService: LanguageService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    await this.languageService.initialize();
    await this.notificationService.initialize();
  }
}
