import { router } from 'expo-router';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius, shadow, spacing, type } from '@/theme';

import { BackIcon } from './icons';

export function Screen({
  children,
  scroll = true,
  footer,
  bottomInset = spacing(6),
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  bottomInset?: number;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

export function Header({ title, back = true, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          hitSlop={12}
          style={styles.circleButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <BackIcon size={20} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
      {title ? <Text style={type.heading}>{title}</Text> : <View />}
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function T({ children, style, lines }: { children: ReactNode; style?: TextStyle | TextStyle[]; lines?: number }) {
  return (
    <Text style={[type.body, style]} numberOfLines={lines}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={type.heading}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const primary = variant === 'primary';
  const fg = primary ? colors.white : variant === 'danger' ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        primary ? { backgroundColor: colors.ink } : styles.outline,
        { opacity: disabled ? 0.35 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Small uppercase pill, like "NEW" / "FEATURED" in the reference. */
export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'neutral' | 'ink' }) {
  const bg = tone === 'accent' ? colors.accent : tone === 'ink' ? colors.ink : colors.fill;
  const fg = tone === 'neutral' ? colors.ink : colors.white;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      <Text style={[styles.pillText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function ScoreBadge({ score, size = 44 }: { score: number; size?: number }) {
  return (
    <View style={[styles.score, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.4, color: colors.ink }}>{score}</Text>
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[type.small, style]}>{children}</Text>;
}

export function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(2.5), gap: spacing(2) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing(2.5), ...shadow },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing(1) },
  button: { height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  buttonSmall: { height: 40, paddingHorizontal: 18 },
  outline: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.8 },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  score: { borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(2), padding: spacing(3) },
});
