import { colors } from '../../constants/theme';
import { useGame } from '../../context/GameContext';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GatesScreen() {
  const { t } = useTranslation();
  const { gates, toggleGate } = useGame();
  const cleared = gates.filter((g) => g.done).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>{t('gates.kicker')}</Text>
        <Text style={styles.title}>{t('gates.title')}</Text>
        <Text style={styles.sub}>
          {t('gates.intro')} {t('common.progress', { done: cleared, total: gates.length })}
        </Text>

        {gates.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => toggleGate(g.id)}
            style={[styles.row, g.done && styles.rowDone]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: g.done }}
          >
            <View style={[styles.box, g.done && styles.boxOn]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t(`gates.${g.id}`)}</Text>
              <Text style={styles.rowXp}>
                +{g.xp} {t('common.xp')}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  kicker: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6, lineHeight: 28 },
  sub: { color: colors.muted, marginTop: 10, lineHeight: 22, marginBottom: 16, fontSize: 15 },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
    minHeight: 56,
  },
  rowDone: { borderColor: colors.accent },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  rowXp: { color: colors.muted, marginTop: 4, fontSize: 14 },
});
