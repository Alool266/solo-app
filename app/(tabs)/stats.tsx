import { colors } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import type { WorkoutEntry } from '../../context/GameContext';
import { useGame } from '../../context/GameContext';
import {
  buildPrTimeline,
  trainingDayStreak,
  weeklyVolumeSeries,
  workoutVolumeKg,
} from '../../utils/workoutAnalytics';
import { formatSessionDuration } from '../../utils/workoutPr';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const WEEK_CHART_WEEKS = 8;
const PR_LIMIT = 24;
const HISTORY_LIMIT = 14;

function formatVol(n: number, locale: string): string {
  return `${Math.round(n).toLocaleString(locale)}`;
}

function VolumeChart({
  series,
  locale,
  isRTL,
}: {
  series: { label: string; volumeKg: number }[];
  locale: string;
  isRTL: boolean;
}) {
  const maxV = Math.max(...series.map((s) => s.volumeKg), 1);
  return (
    <View style={[styles.chartRow, isRTL && styles.chartRowRtl]}>
      {series.map((p) => {
        const ratio = maxV > 0 ? p.volumeKg / maxV : 0;
        const fillH = Math.max(ratio * 100, p.volumeKg > 0 ? 10 : 4);
        return (
          <View key={p.label + p.volumeKg} style={styles.barColumn}>
            <Text style={styles.barVol} numberOfLines={1}>
              {p.volumeKg > 0 ? formatVol(p.volumeKg, locale) : '—'}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: `${fillH}%` }]} />
            </View>
            <Text style={styles.barWeek}>{p.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function HistoryRow({
  title,
  subtitle,
  volumeLabel,
}: {
  title: string;
  subtitle: string;
  volumeLabel: string;
}) {
  return (
    <View style={styles.historyRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.historyMeta}>{subtitle}</Text>
      </View>
      <Text style={styles.historyVol}>{volumeLabel}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const { workouts, hydrated } = useGame();
  const localeTag = language === 'ar' ? 'ar' : 'en-US';

  const streak = useMemo(() => trainingDayStreak(workouts), [workouts]);
  const weekSeries = useMemo(
    () => weeklyVolumeSeries(workouts, WEEK_CHART_WEEKS),
    [workouts]
  );
  const prEvents = useMemo(() => buildPrTimeline(workouts, PR_LIMIT), [workouts]);
  const historyPreview = useMemo(() => workouts.slice(0, HISTORY_LIMIT), [workouts]);

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>{t('stats.kicker')}</Text>
        <Text style={styles.title}>{t('stats.title')}</Text>
        <Text style={styles.intro}>{t('stats.intro')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('stats.streakTitle')}</Text>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.cardHint}>{t('stats.streakHint')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('stats.volumeTitle')}</Text>
          <Text style={styles.cardHint}>{t('stats.volumeHint')}</Text>
          <VolumeChart series={weekSeries} locale={localeTag} isRTL={isRTL} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('stats.prTitle')}</Text>
          <Text style={styles.cardHint}>{t('stats.prHint')}</Text>
          {prEvents.length === 0 ? (
            <Text style={styles.empty}>{t('stats.prEmpty')}</Text>
          ) : (
            prEvents.map((e, i) => (
              <View
                key={`${e.at}-${e.exerciseLabel}-${e.weight}-${e.reps}-${i}`}
                style={styles.prRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.prExercise} numberOfLines={1}>
                    {e.exerciseLabel || t('stats.unnamedExercise')}
                  </Text>
                  <Text style={styles.prMeta}>
                    {new Date(e.at).toLocaleDateString(localeTag, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.prSets}>
                  {t('stats.prSetFormat', { weight: e.weight, reps: e.reps })}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('stats.historyTitle')}</Text>
          <Text style={styles.cardHint}>{t('stats.historyHint')}</Text>
          {historyPreview.length === 0 ? (
            <Text style={styles.empty}>{t('stats.historyEmpty')}</Text>
          ) : (
            historyPreview.map((w) => {
              const vol = workoutVolumeKg(w.exercises);
              const sets = w.exercises.reduce((a, ex) => a + ex.sets.length, 0);
              const dateStr = new Date(w.at).toLocaleDateString(localeTag, {
                month: 'short',
                day: 'numeric',
              });
              const dur =
                typeof w.durationSec === 'number' && w.durationSec > 0
                  ? formatSessionDuration(w.durationSec)
                  : undefined;
              const subtitle = [
                dateStr,
                t('log.historySummary', { exercises: w.exercises.length, sets }),
                dur,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <HistoryRow
                  key={w.id}
                  title={w.title.trim().length > 0 ? w.title : t('log.defaultTitle')}
                  subtitle={subtitle}
                  volumeLabel={`${formatVol(vol, localeTag)} ${t('stats.volumeUnitShort')}`}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 120,
    gap: 14,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  intro: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  muted: {
    color: colors.muted,
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  streakNumber: {
    color: colors.accent,
    fontSize: 44,
    fontWeight: '800',
    marginVertical: 4,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 8,
    minHeight: 132,
  },
  chartRowRtl: {
    flexDirection: 'row-reverse',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 48,
  },
  barVol: {
    color: colors.muted,
    fontSize: 9,
    marginBottom: 4,
  },
  barTrack: {
    width: '85%',
    height: 96,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 6,
    minHeight: 4,
  },
  barWeek: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 6,
    fontWeight: '600',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  prExercise: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  prMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  prSets: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  historyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  historyMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  historyVol: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    paddingVertical: 8,
  },
});
