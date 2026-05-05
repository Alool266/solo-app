import { colors } from '../constants/theme';
import { Pressable, StyleSheet, Text } from 'react-native';

export function PrimaryButton({
  label,
  onPress,
  variant = 'accent',
  disabled,
  fullWidth,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'accent' | 'danger' | 'ghost';
  disabled?: boolean;
  fullWidth?: boolean;
  /** Overrides visible label for screen readers when needed. */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'accent' && styles.accent,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'ghost' && styles.labelGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  accent: {
    backgroundColor: colors.accent,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.45 },
  label: {
    color: '#051018',
    fontWeight: '800',
    letterSpacing: 0.4,
    fontSize: 15,
  },
  labelGhost: { color: colors.text },
});
