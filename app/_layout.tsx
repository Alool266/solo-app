import '../i18n/config';

import 'react-native-reanimated';

import { GameProvider } from '../context/GameContext';
import { LanguageProvider } from '../context/LanguageContext';
import i18n from '../i18n/config';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { I18nextProvider } from 'react-i18next';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <I18nextProvider i18n={i18n}>
        <GameProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </GameProvider>
      </I18nextProvider>
    </LanguageProvider>
  );
}
