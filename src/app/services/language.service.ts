import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Preferences } from '@capacitor/preferences';

export type SupportedLanguage = 'en' | 'it';

const LANGUAGE_KEY = 'app_language';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private currentLang: SupportedLanguage = 'en';

  readonly supportedLanguages: { code: SupportedLanguage; name: string; nativeName: string }[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  ];

  constructor(private translate: TranslateService) {}

  async initialize(): Promise<void> {
    // Set available languages
    this.translate.addLangs(['en', 'it']);
    this.translate.setDefaultLang('en');

    // Try to load saved language preference
    const savedLang = await this.getSavedLanguage();

    if (savedLang) {
      this.currentLang = savedLang;
    } else {
      // Try to detect device language
      const browserLang = this.translate.getBrowserLang();
      if (browserLang && this.isSupported(browserLang)) {
        this.currentLang = browserLang as SupportedLanguage;
      }
    }

    this.translate.use(this.currentLang);
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLang;
  }

  async setLanguage(lang: SupportedLanguage): Promise<void> {
    if (!this.isSupported(lang)) {
      console.warn(`Language ${lang} is not supported`);
      return;
    }

    this.currentLang = lang;
    this.translate.use(lang);
    await this.saveLanguage(lang);
  }

  isSupported(lang: string): boolean {
    return this.supportedLanguages.some((l) => l.code === lang);
  }

  private async getSavedLanguage(): Promise<SupportedLanguage | null> {
    try {
      const { value } = await Preferences.get({ key: LANGUAGE_KEY });
      if (value && this.isSupported(value)) {
        return value as SupportedLanguage;
      }
    } catch (error) {
      console.error('Failed to get saved language:', error);
    }
    return null;
  }

  private async saveLanguage(lang: SupportedLanguage): Promise<void> {
    try {
      await Preferences.set({ key: LANGUAGE_KEY, value: lang });
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  }

  // Helper method to get instant translation (for TS files)
  instant(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
