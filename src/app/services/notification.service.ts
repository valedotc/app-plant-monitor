import { Injectable, OnDestroy } from '@angular/core';
import { Platform } from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import {
  LocalNotifications,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ConfigurationService } from './configuration.service';
import { LanguageService } from './language.service';
import {
  NotificationType,
  NotificationPriority,
  AppNotification,
} from '../models/notification.model';

const DAILY_REMINDER_ID = 1000;
const APP_INSTANCE_KEY = 'app_instance_id';

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private fcmToken: string | null = null;
  private appInstanceId: string | null = null;
  private initialized = false;

  // Observable for in-app notification display
  private notificationReceivedSubject = new Subject<AppNotification>();
  public notificationReceived$ = this.notificationReceivedSubject.asObservable();

  // Unread count
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private platform: Platform,
    private http: HttpClient,
    private prefsService: NotificationPreferencesService,
    private configService: ConfigurationService,
    private lang: LanguageService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize notification systems
   * Call this from AppComponent.ngOnInit()
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing notification service...');

    // Get or create app instance ID
    await this.getOrCreateAppInstanceId();

    // Check if we're on a native platform
    if (!this.platform.is('capacitor')) {
      console.log('Not on native platform - notifications limited');
      this.initialized = true;
      return;
    }

    // Request permissions
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
    }

    // Setup local notifications
    await this.setupLocalNotifications();

    // Setup push notifications
    await this.setupPushNotifications();

    // Subscribe to preference changes
    this.prefsService.preferences$
      .pipe(takeUntil(this.destroy$))
      .subscribe((prefs) => {
        this.updateDailyReminder(
          prefs.dailyReminderEnabled,
          prefs.dailyReminderTime
        );
      });

    // Subscribe to plant changes
    this.configService.plants$
      .pipe(takeUntil(this.destroy$))
      .subscribe((plants) => {
        const deviceIds = plants.map((p) => p.deviceId);
        this.syncDeviceTokens(deviceIds);

        // Update daily reminder based on plant count
        const prefs = this.prefsService.getPreferences();
        if (prefs.dailyReminderEnabled && plants.length > 0) {
          this.scheduleDailyReminder(prefs.dailyReminderTime);
        } else if (plants.length === 0) {
          this.cancelDailyReminder();
        }
      });

    this.initialized = true;
    console.log('Notification service initialized');
  }

  // ============================================================================
  // APP INSTANCE ID
  // ============================================================================

  private async getOrCreateAppInstanceId(): Promise<string> {
    if (this.appInstanceId) return this.appInstanceId;

    const { value } = await Preferences.get({ key: APP_INSTANCE_KEY });

    if (value) {
      this.appInstanceId = value;
    } else {
      // Generate new UUID
      this.appInstanceId = this.generateUUID();
      await Preferences.set({
        key: APP_INSTANCE_KEY,
        value: this.appInstanceId,
      });
    }

    return this.appInstanceId;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ============================================================================
  // PERMISSIONS
  // ============================================================================

  private async requestPermissions(): Promise<boolean> {
    try {
      // Local notifications permission
      const localResult = await LocalNotifications.requestPermissions();

      // Push notifications permission
      const pushResult = await PushNotifications.requestPermissions();

      return (
        localResult.display === 'granted' && pushResult.receive === 'granted'
      );
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  // ============================================================================
  // LOCAL NOTIFICATIONS (Daily Reminders)
  // ============================================================================

  private async setupLocalNotifications(): Promise<void> {
    // Listen for notification actions
    await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        console.log('Local notification action:', action);
        this.handleLocalNotificationAction(action.notification);
      }
    );
  }

  async scheduleDailyReminder(time: string): Promise<void> {
    const prefs = this.prefsService.getPreferences();
    if (!prefs.dailyReminderEnabled) return;

    const plants = this.configService.getPlants();
    if (plants.length === 0) return; // No plants, no reminder needed

    // Cancel existing reminder
    await this.cancelDailyReminder();

    const [hours, minutes] = time.split(':').map(Number);

    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const notification: LocalNotificationSchema = {
      id: DAILY_REMINDER_ID,
      title: this.lang.instant('notifications.dailyReminder.title'),
      body: this.lang.instant('notifications.dailyReminder.body', {
        count: plants.length,
      }),
      schedule: {
        at: scheduledTime,
        repeats: true,
        every: 'day',
      },
      sound: prefs.soundEnabled ? 'default' : undefined,
      extra: {
        type: NotificationType.DAILY_REMINDER,
      },
    };

    await LocalNotifications.schedule({ notifications: [notification] });
    console.log('Daily reminder scheduled for:', scheduledTime);
  }

  async cancelDailyReminder(): Promise<void> {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: DAILY_REMINDER_ID }],
      });
    } catch (error) {
      // Ignore errors if notification doesn't exist
    }
  }

  private async updateDailyReminder(
    enabled: boolean,
    time: string
  ): Promise<void> {
    if (enabled) {
      await this.scheduleDailyReminder(time);
    } else {
      await this.cancelDailyReminder();
    }
  }

  private handleLocalNotificationAction(
    notification: LocalNotificationSchema
  ): void {
    const type = notification.extra?.type as NotificationType;

    if (type === NotificationType.DAILY_REMINDER) {
      // Navigation handled by the app - just emit notification
      this.notificationReceivedSubject.next({
        id: notification.id?.toString() || Date.now().toString(),
        type: NotificationType.DAILY_REMINDER,
        priority: NotificationPriority.NORMAL,
        title: notification.title || '',
        body: notification.body || '',
        timestamp: new Date(),
        read: true,
      });
    }
  }

  // ============================================================================
  // PUSH NOTIFICATIONS (Critical Alerts via FCM)
  // ============================================================================

  private async setupPushNotifications(): Promise<void> {
    // Register for push notifications
    await PushNotifications.register();

    // Handle token registration
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM Token received:', token.value.substring(0, 20) + '...');
      this.fcmToken = token.value;
      await this.registerTokenWithBackend(token.value);
    });

    // Handle registration errors
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('FCM Registration error:', error);
    });

    // Handle foreground push notifications
    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received in foreground:', notification);
        this.handlePushNotification(notification, false);
      }
    );

    // Handle notification tap (from background/killed state)
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Push notification tapped:', action);
        this.handlePushNotification(action.notification, true);
      }
    );
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const plants = this.configService.getPlants();
      const deviceIds = plants.map((p) => p.deviceId);

      await this.http
        .post(`${environment.apiUrl}/notifications/tokens`, {
          appInstanceId: this.appInstanceId,
          fcmToken: token,
          platform: this.platform.is('ios') ? 'ios' : 'android',
          deviceIds: deviceIds,
        })
        .toPromise();

      console.log('FCM token registered with backend');
    } catch (error) {
      console.error('Failed to register FCM token:', error);
    }
  }

  private async syncDeviceTokens(deviceIds: string[]): Promise<void> {
    if (!this.fcmToken) return;

    try {
      await this.http
        .post(`${environment.apiUrl}/notifications/tokens/sync`, {
          fcmToken: this.fcmToken,
          deviceIds: deviceIds,
        })
        .toPromise();
    } catch (error) {
      console.error('Failed to sync device tokens:', error);
    }
  }

  private handlePushNotification(
    notification: PushNotificationSchema,
    tapped: boolean
  ): void {
    const prefs = this.prefsService.getPreferences();

    // Check if critical alerts are enabled
    if (!prefs.criticalAlertsEnabled) return;

    // Check per-plant settings
    const deviceId = notification.data?.deviceId as string;
    if (deviceId && !this.prefsService.isAlertEnabledForDevice(deviceId)) {
      return;
    }

    // Create app notification for in-app display
    const appNotification: AppNotification = {
      id: notification.id || Date.now().toString(),
      type: NotificationType.CRITICAL_ALERT,
      priority: NotificationPriority.CRITICAL,
      title: notification.title || 'Alert',
      body: notification.body || '',
      data: notification.data as Record<string, string>,
      timestamp: new Date(),
      read: tapped,
    };

    // Emit for in-app handling
    this.notificationReceivedSubject.next(appNotification);

    if (!tapped) {
      // Increment unread count if notification wasn't tapped
      this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Send a test notification (for settings page)
   */
  async sendTestNotification(): Promise<void> {
    if (!this.platform.is('capacitor')) {
      console.log('Test notification: Not on native platform');
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now(),
          title: this.lang.instant('notifications.test.title'),
          body: this.lang.instant('notifications.test.body'),
          schedule: { at: new Date(Date.now() + 1000) },
        },
      ],
    });
  }

  /**
   * Get FCM token (for debugging)
   */
  getFcmToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Get app instance ID
   */
  getAppInstanceId(): string | null {
    return this.appInstanceId;
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.unreadCountSubject.next(0);
  }

  /**
   * Acknowledge alert on backend
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await this.http
        .patch(`${environment.apiUrl}/notifications/alerts/${alertId}/ack`, {})
        .toPromise();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }
}
