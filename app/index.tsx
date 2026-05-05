import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { useGame } from '../context/GameContext';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const STEP_BODIES = ['step0', 'step1', 'step2'] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hydrated, onboarded, completeOnboarding } = useGame();
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (onboarded) {
    return <Redirect href="/(tabs)" />;
  }

  const bodyKey = STEP_BODIES[step];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.stepMeta}>
            {t('common.step', { current: step + 1, total: STEP_BODIES.length })}
          </Text>
          <Text style={styles.badge}>{t('onboarding.badge')}</Text>
          <Text style={styles.head}>{t('onboarding.title')}</Text>
          <Text style={styles.body}>{t(`onboarding.${bodyKey}`)}</Text>
          {step === 2 ? (
            <TextInput
              placeholder={t('onboarding.namePlaceholder')}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              style={styles.input}
              accessibilityLabel={t('onboarding.namePlaceholder')}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          ) : null}
          <View style={styles.row}>
            {step > 0 ? (
              <View style={styles.rowBtn}>
                <PrimaryButton
                  label={t('onboarding.back')}
                  variant="ghost"
                  fullWidth
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep((s) => s - 1);
                  }}
                />
              </View>
            ) : (
              <View style={styles.rowSpacer} />
            )}
            <View style={styles.rowBtn}>
              {step < 2 ? (
                <PrimaryButton
                  fullWidth
                  label={t('onboarding.next')}
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep((s) => s + 1);
                  }}
                />
              ) : (
                <PrimaryButton
                  fullWidth
                  label={t('onboarding.start')}
                  onPress={() => {
                    Keyboard.dismiss();
                    completeOnboarding(name);
                    router.replace('/(tabs)');
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 28,
  },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  hint: { color: colors.muted, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 14,
  },
  stepMeta: { color: colors.muted, fontSize: 13 },
  badge: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 13 },
  head: { color: colors.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface2,
    minHeight: 52,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'stretch' },
  rowBtn: { flex: 1 },
  rowSpacer: { flex: 1 },
});
