import { PrimaryButton } from '../../components/PrimaryButton';
import { DUNGEONS } from '../../constants/dungeons';
import { colors } from '../../constants/theme';
import { useGame } from '../../context/GameContext';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DungeonScreen() {
  const { t } = useTranslation();
  const { activeDungeonId, dungeonWeek, enterDungeon, advanceFloor } = useGame();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>{t('dungeon.kicker')}</Text>
        <Text style={styles.title}>{t('dungeon.title')}</Text>
        <Text style={styles.sub}>{t('dungeon.intro')}</Text>

        {DUNGEONS.map((d) => {
          const active = d.id === activeDungeonId;
          const status = active ? t('common.active') : t('common.available');
          return (
            <View key={d.id} style={[styles.card, active && styles.cardActive]}>
              <Text style={styles.cardTitle}>{t(`dungeons.${d.id}.name`)}</Text>
              <Text style={styles.tag}>{t(`dungeons.${d.id}.tagline`)}</Text>
              <Text style={styles.focus}>{t(`dungeons.${d.id}.focus`)}</Text>
              <Text style={styles.meta}>
                {t('dungeon.floorsMeta', { count: d.floors, status })}
              </Text>
              <PrimaryButton
                fullWidth
                label={active ? t('common.selected') : t('dungeon.enter')}
                onPress={() => enterDungeon(d.id)}
                disabled={active}
              />
            </View>
          );
        })}

        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.cardTitle}>{t('dungeon.nextWeekTitle')}</Text>
          <Text style={styles.focus}>{t('dungeon.nextWeekHint', { week: dungeonWeek })}</Text>
          <PrimaryButton fullWidth label={t('dungeon.nextWeekCta')} onPress={advanceFloor} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  kicker: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 6, lineHeight: 30 },
  sub: { color: colors.muted, marginTop: 10, lineHeight: 22, marginBottom: 14, fontSize: 15 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 12,
    gap: 8,
  },
  cardActive: { borderColor: colors.accent },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  tag: { color: colors.accentDim, fontSize: 14 },
  focus: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 13 },
});
