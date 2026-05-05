import { FeedMessage } from '../../components/FeedMessage';
import { Panel } from '../../components/Panel';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors } from '../../constants/theme';
import { useGame } from '../../context/GameContext';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CommandScreen() {
  const { t } = useTranslation();
  const {
    playerName,
    rank,
    level,
    xp,
    xpToNext,
    fatigue,
    activeDungeonId,
    dungeonWeek,
    weeklyBoss,
    weeklyGoal,
    systemMessages,
    restRecovery,
  } = useGame();

  const dungeonName = t(`dungeons.${activeDungeonId}.name`);
  const fatigueWarm =
    fatigue > 70 ? colors.danger : fatigue > 45 ? colors.warning : colors.accent;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>{t('command.kicker')}</Text>
        <Text style={styles.title}>{t('command.welcome', { name: playerName })}</Text>
        <Text style={styles.sub}>{t('command.rankLevel', { rank, level })}</Text>

        <View style={styles.rankRow}>
          <View style={styles.rankOrb}>
            <Text style={styles.rankLetter}>{rank}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.muted}>{t('command.experience')}</Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.min(100, (xp / xpToNext) * 100)}%` }]} />
            </View>
            <Text style={styles.xpLabel}>
              {xp} / {xpToNext} {t('common.xp')}
            </Text>
          </View>
        </View>

        <Panel title={t('command.fatigueTitle')} subtitle={t('command.fatigueHint')}>
          <View style={styles.fatigueTrack}>
            <View style={[styles.fatigueFill, { width: `${fatigue}%`, backgroundColor: fatigueWarm }]} />
          </View>
          <Text style={styles.mutedSmall}>{t('command.fatigueScale', { value: fatigue })}</Text>
        </Panel>

        <Panel
          title={
            weeklyGoal.label.trim()
              ? weeklyGoal.label
              : t('command.weeklyGoalPanel')
          }
          subtitle={
            weeklyGoal.label.trim()
              ? t('command.weeklyGoalProgress', {
                  current: weeklyGoal.progress,
                  target: weeklyGoal.target,
                })
              : t('command.weeklyGoalUnset')
          }
        >
          {weeklyGoal.target > 0 ? (
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  {
                    width: `${Math.min(100, (weeklyGoal.progress / weeklyGoal.target) * 100)}%`,
                  },
                ]}
              />
            </View>
          ) : null}
          <Link href="./profile">
            <Text style={styles.link}>{t('command.weeklyGoalEdit')}</Text>
          </Link>
        </Panel>

        <Panel
          title={t('command.programTitle')}
          subtitle={t('command.programHint', { name: dungeonName, week: dungeonWeek })}
        >
          <Link href="./dungeon">
            <Text style={styles.link}>{t('command.openPrograms')}</Text>
          </Link>
        </Panel>

        <Panel title={t('command.weeklyTitle')} subtitle={t(weeklyBoss.detailKey)}>
          <Text style={styles.bossState}>
            {t('common.status')}:{' '}
            {weeklyBoss.cleared ? t('common.cleared') : t('common.ready')}
          </Text>
          <Link href="./profile">
            <Text style={styles.link}>{t('command.promotionsLink')}</Text>
          </Link>
        </Panel>

        <PrimaryButton
          label={t('command.rest')}
          variant="ghost"
          fullWidth
          onPress={restRecovery}
        />

        <Panel title={t('command.feedTitle')} subtitle={t('command.feedHint')}>
          {systemMessages.slice(0, 8).map((item, i) => (
            <FeedMessage key={`feed-${i}`} item={item} />
          ))}
        </Panel>

        <Link href="./gates">
          <Text style={styles.link}>{t('command.gotoToday')}</Text>
        </Link>
        <View style={{ marginBottom: 28 }}>
          <Link href="./log">
            <Text style={styles.link}>{t('command.gotoWorkouts')}</Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  kicker: { color: colors.accent, fontWeight: '800', letterSpacing: 2, marginBottom: 6, fontSize: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 32 },
  sub: { color: colors.muted, marginBottom: 16, fontSize: 15 },
  rankRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 14 },
  rankOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.rankGlow,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  rankLetter: { color: colors.text, fontSize: 32, fontWeight: '900' },
  muted: { color: colors.muted, marginBottom: 6, fontSize: 14 },
  mutedSmall: { color: colors.muted, marginTop: 8, fontSize: 13 },
  xpTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  xpLabel: { color: colors.text, marginTop: 6, fontSize: 14 },
  fatigueTrack: {
    height: 14,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
    marginTop: 8,
  },
  fatigueFill: { height: '100%' },
  goalTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
    marginTop: 8,
  },
  goalFill: { height: '100%', backgroundColor: colors.accent },
  link: {
    color: colors.accent,
    fontWeight: '700',
    marginTop: 10,
    fontSize: 16,
    paddingVertical: 4,
  },
  bossState: { color: colors.text, fontWeight: '700', marginTop: 8, fontSize: 15 },
});
