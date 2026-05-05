import { PrimaryButton } from '../../components/PrimaryButton';
import { colors } from '../../constants/theme';
import type { WeeklyGoalMode } from '../../context/GameContext';
import { useLanguage } from '../../context/LanguageContext';
import { useGame } from '../../context/GameContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const {
    rank,
    stats,
    weeklyBoss,
    weeklyGoal,
    clearBoss,
    resetDemo,
    configureWeeklyGoal,
    bumpWeeklyGoalManual,
    exportBackupJson,
    importBackupJson,
  } = useGame();

  const [goalLabel, setGoalLabel] = useState(weeklyGoal.label);
  const [goalTarget, setGoalTarget] = useState(String(weeklyGoal.target));
  const [goalMode, setGoalMode] = useState<WeeklyGoalMode>(weeklyGoal.mode);

  useEffect(() => {
    setGoalLabel(weeklyGoal.label);
    setGoalTarget(String(weeklyGoal.target));
    setGoalMode(weeklyGoal.mode);
  }, [weeklyGoal.label, weeklyGoal.target, weeklyGoal.mode]);

  const applyGoal = () => {
    const n = parseInt(goalTarget, 10);
    configureWeeklyGoal(goalLabel, Number.isNaN(n) ? 3 : n, goalMode);
  };

  const exportBackup = async () => {
    try {
      const json = exportBackupJson();
      if (Platform.OS === 'web') {
        if (typeof document === 'undefined') return;
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solo-rep-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      const dir = FileSystem.cacheDirectory;
      if (!dir) {
        Alert.alert('', t('profile.backupFail'));
        return;
      }
      const path = `${dir}solo-rep-backup.json`;
      await FileSystem.writeAsStringAsync(path, json);
      const can = await Sharing.isAvailableAsync();
      if (!can) {
        Alert.alert('', t('profile.backupShareUnavailable'));
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: t('profile.backupShareTitle'),
        UTI: 'public.json',
      });
    } catch {
      Alert.alert('', t('profile.backupFail'));
    }
  };

  const importBackup = async () => {
    try {
      if (Platform.OS === 'web') {
        const res = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          multiple: false,
          base64: false,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        let content: string;
        if (asset.file && typeof asset.file.text === 'function') {
          content = await asset.file.text();
        } else {
          const uri = asset.uri;
          try {
            const r = await fetch(uri);
            content = await r.text();
          } finally {
            if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
          }
        }
        const out = importBackupJson(content);
        if (out.ok) Alert.alert('', t('profile.backupOk'));
        else Alert.alert('', t('profile.backupFail'));
        return;
      }
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const uri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri);
      const out = importBackupJson(content);
      if (out.ok) Alert.alert('', t('profile.backupOk'));
      else Alert.alert('', t('profile.backupFail'));
    } catch {
      Alert.alert('', t('profile.backupFail'));
    }
  };

  const manualProgress = weeklyGoal.mode === 'manual';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>{t('profile.kicker')}</Text>
        <Text style={styles.title}>{t('profile.title', { rank })}</Text>
        <Text style={styles.sub}>{t('profile.intro')}</Text>

        <Text style={styles.sectionLabel}>{t('profile.languageTitle')}</Text>
        <Text style={styles.sectionHint}>{t('profile.languageHint')}</Text>
        <View style={styles.langRow}>
          <LangChip
            label={t('profile.langEn')}
            selected={language === 'en'}
            onPress={() => setLanguage('en')}
          />
          <LangChip
            label={t('profile.langAr')}
            selected={language === 'ar'}
            onPress={() => setLanguage('ar')}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.weeklyGoalTitle')}</Text>
          <Text style={styles.cardMuted}>{t('profile.weeklyGoalHint')}</Text>
          <TextInput
            value={goalLabel}
            onChangeText={setGoalLabel}
            placeholder={t('profile.weeklyGoalLabelPh')}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.miniLabel}>{t('profile.weeklyGoalTarget')}</Text>
          <TextInput
            keyboardType="number-pad"
            value={goalTarget}
            onChangeText={setGoalTarget}
            style={styles.input}
          />
          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeChip, goalMode === 'sessions' && styles.modeChipOn]}
              onPress={() => setGoalMode('sessions')}
            >
              <Text style={[styles.modeText, goalMode === 'sessions' && styles.modeTextOn]}>
                {t('profile.weeklyGoalModeSessions')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, goalMode === 'manual' && styles.modeChipOn]}
              onPress={() => setGoalMode('manual')}
            >
              <Text style={[styles.modeText, goalMode === 'manual' && styles.modeTextOn]}>
                {t('profile.weeklyGoalModeManual')}
              </Text>
            </Pressable>
          </View>
          <PrimaryButton fullWidth label={t('profile.weeklyGoalApply')} onPress={applyGoal} />
          <View style={styles.goalTrack}>
            <View
              style={[
                styles.goalFill,
                {
                  width: `${weeklyGoal.target > 0 ? Math.min(100, (weeklyGoal.progress / weeklyGoal.target) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {weeklyGoal.label.trim() || t('command.weeklyGoalPanel')}:{' '}
            {weeklyGoal.progress} / {weeklyGoal.target}
          </Text>
          {manualProgress ? (
            <View style={styles.manualRow}>
              <View style={styles.manualBtn}>
                <PrimaryButton
                  fullWidth
                  label={t('profile.weeklyGoalMinus')}
                  variant="ghost"
                  onPress={() => bumpWeeklyGoalManual(-1)}
                />
              </View>
              <View style={styles.manualBtn}>
                <PrimaryButton
                  fullWidth
                  label={t('profile.weeklyGoalPlus')}
                  variant="ghost"
                  onPress={() => bumpWeeklyGoalManual(1)}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.grid}>
          <Stat label="STR" value={stats.str} hint={t('profile.statStr')} />
          <Stat label="END" value={stats.end} hint={t('profile.statEnd')} />
          <Stat label="DISC" value={stats.disc} hint={t('profile.statDisc')} />
          <Stat label="REC" value={stats.rec} hint={t('profile.statRec')} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.bossTitle')}</Text>
          <Text style={styles.cardBody}>{t(weeklyBoss.titleKey)}</Text>
          <Text style={styles.cardMuted}>{t(weeklyBoss.detailKey)}</Text>
          <PrimaryButton
            label={
              weeklyBoss.cleared ? t('profile.bossDone') : t('profile.bossCta')
            }
            onPress={clearBoss}
            disabled={weeklyBoss.cleared}
            fullWidth
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.backupTitle')}</Text>
          <Text style={styles.cardMuted}>{t('profile.backupHint')}</Text>
          <Text style={styles.cardMuted}>{t('profile.backupEmailHint')}</Text>
          <PrimaryButton fullWidth label={t('profile.backupExport')} onPress={exportBackup} />
          <PrimaryButton
            fullWidth
            label={t('profile.backupImport')}
            variant="ghost"
            onPress={importBackup}
          />
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('profile.pwaTitle')}</Text>
            <Text style={styles.cardMuted}>{t('profile.pwaBody')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('profile.homeScreenTitle')}</Text>
            <Text style={styles.cardMuted}>{t('profile.homeScreenBody')}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.storyTitle')}</Text>
          <Text style={styles.scenario}>{t('scenario.full')}</Text>
        </View>

        <PrimaryButton
          label={t('profile.resetTitle')}
          variant="danger"
          fullWidth
          onPress={() => {
            resetDemo();
            router.replace('/');
          }}
        />
        <Text style={styles.warn}>{t('profile.resetHint')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function LangChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 48 },
  kicker: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 6, lineHeight: 32 },
  sub: { color: colors.muted, marginTop: 10, lineHeight: 22, fontSize: 15 },
  sectionLabel: { color: colors.text, fontWeight: '800', marginTop: 20, fontSize: 16 },
  sectionHint: { color: colors.muted, marginTop: 6, fontSize: 14, lineHeight: 20 },
  langRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  chip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.surface2 },
  chipLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  chipLabelOn: { color: colors.accent },
  card: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 17 },
  cardBody: { color: colors.text, fontWeight: '700', fontSize: 15 },
  cardMuted: { color: colors.muted, lineHeight: 22, fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface2,
    marginTop: 8,
  },
  miniLabel: { color: colors.muted, fontSize: 13, marginTop: 10 },
  modeRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  modeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  modeChipOn: { borderColor: colors.accent },
  modeText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  modeTextOn: { color: colors.accent },
  goalTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
    marginTop: 8,
  },
  goalFill: { height: '100%', backgroundColor: colors.accent },
  progressLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 12 },
  manualBtn: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  stat: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statLabel: { color: colors.accent, fontWeight: '800' },
  statValue: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 6 },
  statHint: { color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  scenario: { color: colors.muted, lineHeight: 24, fontSize: 15 },
  warn: { color: colors.muted, marginTop: 12, marginBottom: 24, lineHeight: 20, fontSize: 14 },
});
