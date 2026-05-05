import ar from '../locales/ar.json';
import en from '../locales/en.json';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const deviceCode = Localization.getLocales()[0]?.languageCode;
const initialLng = deviceCode === 'ar' ? 'ar' : 'en';

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
