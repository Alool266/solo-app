import { colors } from '../constants/theme';
import { PrimaryButton } from './PrimaryButton';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PRESETS = [60, 90, 120, 180];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function RestTimerModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(90);
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (!visible) {
      clearTimer();
      setRemaining(null);
    }
  }, [visible]);

  useEffect(() => {
    if (remaining === null || remaining > 0) return;
    clearTimer();
    setRemaining(null);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [remaining]);

  const start = () => {
    clearTimer();
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return null;
        return r <= 1 ? 0 : r - 1;
      });
    }, 1000);
  };

  const stop = () => {
    clearTimer();
    setRemaining(null);
  };

  const display = remaining !== null ? remaining : seconds;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('rest.title')}</Text>
          <Text style={styles.big}>{display}s</Text>

          <Text style={styles.label}>{t('rest.presets')}</Text>
          <View style={styles.row}>
            {PRESETS.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  setSeconds(s);
                  if (remaining === null) setRemaining(null);
                }}
                style={[styles.pill, seconds === s && styles.pillOn]}
              >
                <Text style={[styles.pillText, seconds === s && styles.pillTextOn]}>{s}s</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            {remaining === null ? (
              <PrimaryButton fullWidth label={t('rest.start')} onPress={start} />
            ) : (
              <PrimaryButton fullWidth label={t('rest.stop')} variant="ghost" onPress={stop} />
            )}
            <PrimaryButton fullWidth label={t('rest.close')} variant="ghost" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  big: {
    color: colors.accent,
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 8,
  },
  label: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.surface2 },
  pillText: { color: colors.muted, fontWeight: '700' },
  pillTextOn: { color: colors.accent },
  actions: { gap: 10, marginTop: 8 },
});
