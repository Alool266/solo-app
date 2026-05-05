import i18n from '../i18n/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nManager, View } from 'react-native';

export const LANG_STORAGE_KEY = 'gym-solo-language';

export type AppLanguage = 'en' | 'ar';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lng: AppLanguage) => Promise<void>;
  isRTL: boolean;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function syncNativeRtl(rtl: boolean) {
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(initialFromDevice());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_STORAGE_KEY);
        const lng: AppLanguage =
          saved === 'ar' || saved === 'en' ? saved : initialFromDevice();
        await i18n.changeLanguage(lng);
        syncNativeRtl(lng === 'ar');
        if (!cancelled) {
          setLanguageState(lng);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (lng: AppLanguage) => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, lng);
    await i18n.changeLanguage(lng);
    syncNativeRtl(lng === 'ar');
    setLanguageState(lng);
  }, []);

  const isRTL = language === 'ar';

  const value = useMemo(
    () => ({ language, setLanguage, isRTL, ready }),
    [language, setLanguage, isRTL, ready]
  );

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#070b12' }} />;
  }

  return (
    <LanguageContext.Provider value={value}>
      <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>{children}</View>
    </LanguageContext.Provider>
  );
}

function initialFromDevice(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === 'ar' ? 'ar' : 'en';
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
