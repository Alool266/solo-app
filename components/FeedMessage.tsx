import { colors } from '../constants/theme';
import { SystemMessage } from '../context/GameContext';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

export function FeedMessage({
  item,
  style,
}: {
  item: SystemMessage;
  style?: object;
}) {
  const { t } = useTranslation();

  if ('legacy' in item) {
    return <Text style={[styles.line, style]}>{item.legacy}</Text>;
  }

  const params = { ...(item.params ?? {}) } as Record<string, string | number>;

  if (item.key === 'feed.gateCleared' && typeof params.gateId === 'string') {
    params.gate = t(`gates.${params.gateId}`);
    delete params.gateId;
  }

  if (item.key === 'feed.enteredDungeon' && typeof params.dungeonId === 'string') {
    params.program = t(`dungeons.${params.dungeonId}.name`);
    delete params.dungeonId;
  }

  return (
    <Text style={[styles.line, style]} accessibilityRole="text">
      {t(item.key, params)}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.muted },
});
