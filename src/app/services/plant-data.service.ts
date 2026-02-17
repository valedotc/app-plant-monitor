import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, interval, of } from 'rxjs';
import {
  takeUntil,
  switchMap,
  catchError,
  tap,
  shareReplay,
} from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Timeout in seconds: if lastSeen is older than this, device is offline
const OFFLINE_THRESHOLD_SECONDS = 30;
// Polling interval in milliseconds
const POLLING_INTERVAL_MS = 5000; // 10 seconds

// API Response Types
export interface LatestReading {
  timestamp: Date;
  temperature: number;
  humidity: number;
  moisture: number;
  light: boolean;
  status: string;
}

export interface StatRange {
  avg: number;
  min: number;
  max: number;
}

export interface Stats24h {
  temperature: StatRange;
  humidity: StatRange;
  moisture: StatRange;
  readingsCount: number;
}

export interface DeviceSummary {
  deviceId: string;
  latest: LatestReading;
  stats24h: Stats24h | null;
}

export interface Reading {
  _id: string;
  deviceId: string;
  ts: Date;
  temperature: number;
  humidity: number;
  chlorophyll: number | null;
  raw: {
    status: string;
    temperature: number;
    humidity: number;
    moisture: number;
    light: boolean;
    device_id: number;
  };
}

export interface PaginatedReadings {
  data: Reading[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ChartDataPoint {
  timestamp: string;
  temperature: StatRange;
  humidity: StatRange;
  moisture: StatRange;
  lightHours: number;
  sampleCount: number;
}

export interface StatsResponse {
  deviceId: string;
  period: string;
  startDate: Date;
  endDate: Date;
  data: ChartDataPoint[];
}

export interface DeviceOverview {
  deviceId: string;
  numericDeviceId?: number;
  lastSeen: Date;
  temperature: number;
  humidity: number;
  moisture: number;
  light: boolean;
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class PlantDataService implements OnDestroy {
  private apiUrl = environment.apiUrl;

  // Polling state
  private destroy$ = new Subject<void>();
  private pollingActive = false;

  // Devices data with real-time updates
  private devicesSubject = new BehaviorSubject<DeviceOverview[]>([]);
  public devices$ = this.devicesSubject.asObservable();

  constructor(private http: HttpClient) {}

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Start polling for device updates
   */
  startPolling(): void {
    if (this.pollingActive) return;

    this.pollingActive = true;
    console.log('[PlantDataService] Starting polling...');

    // Initial fetch
    this.fetchDevices();

    // Then poll every POLLING_INTERVAL_MS
    interval(POLLING_INTERVAL_MS)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.fetchDevicesObservable()),
      )
      .subscribe();
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (!this.pollingActive) return;

    this.pollingActive = false;
    console.log('[PlantDataService] Stopping polling...');
  }

  /**
   * Check if a device is online based on lastSeen timestamp
   */
  isDeviceOnline(lastSeen: Date | string): boolean {
    const lastSeenDate =
      typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeenDate.getTime()) / 1000;
    return diffSeconds <= OFFLINE_THRESHOLD_SECONDS;
  }

  /**
   * Get current devices snapshot
   */
  getDevicesSnapshot(): DeviceOverview[] {
    return this.devicesSubject.value;
  }

  /**
   * Force refresh devices data
   */
  async refreshDevices(): Promise<DeviceOverview[]> {
    return this.fetchDevices();
  }

  private fetchDevicesObservable(): Observable<DeviceOverview[]> {
    return this.http.get<DeviceOverview[]>(`${this.apiUrl}/devices`).pipe(
      tap((devices) => {
        this.devicesSubject.next(devices);
      }),
      catchError((error) => {
        console.error('[PlantDataService] Error fetching devices:', error);
        return of(this.devicesSubject.value);
      }),
    );
  }

  private async fetchDevices(): Promise<DeviceOverview[]> {
    try {
      const devices = await this.http
        .get<DeviceOverview[]>(`${this.apiUrl}/devices`)
        .toPromise();
      if (devices) {
        this.devicesSubject.next(devices);
        return devices;
      }
      return [];
    } catch (error) {
      console.error('[PlantDataService] Error fetching devices:', error);
      return this.devicesSubject.value;
    }
  }

  /**
   * Get all devices with their latest reading
   */
  getAllDevices(): Observable<DeviceOverview[]> {
    return this.http.get<DeviceOverview[]>(`${this.apiUrl}/devices`);
  }

  /**
   * Get summary for a device (latest reading + 24h stats)
   */
  getDeviceSummary(deviceId: string): Observable<DeviceSummary> {
    return this.http.get<DeviceSummary>(
      `${this.apiUrl}/devices/${deviceId}/summary`,
    );
  }

  /**
   * Get latest reading for a device
   */
  getLatestReading(deviceId: string): Observable<Reading> {
    return this.http.get<Reading>(`${this.apiUrl}/devices/${deviceId}/latest`);
  }

  /**
   * Get readings history with pagination
   */
  getReadings(
    deviceId: string,
    options?: {
      limit?: number;
      offset?: number;
      from?: Date;
      to?: Date;
    },
  ): Observable<PaginatedReadings> {
    let params = new HttpParams();

    if (options?.limit) params = params.set('limit', options.limit.toString());
    if (options?.offset)
      params = params.set('offset', options.offset.toString());
    if (options?.from) params = params.set('from', options.from.toISOString());
    if (options?.to) params = params.set('to', options.to.toISOString());

    return this.http.get<PaginatedReadings>(
      `${this.apiUrl}/devices/${deviceId}/readings`,
      { params },
    );
  }

  /**
   * Get aggregated stats for charts
   * @param period - '24h', '7d', or '30d'
   */
  getStats(
    deviceId: string,
    period: '24h' | '7d' | '30d' = '24h',
  ): Observable<StatsResponse> {
    const params = new HttpParams().set('period', period);
    return this.http.get<StatsResponse>(
      `${this.apiUrl}/devices/${deviceId}/stats`,
      { params },
    );
  }
}
