import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n/ru';
import { AttemptSummary } from '@/lib/api';
import { formatClock, formatDate } from '@/lib/format';
import { colors, spacing, type } from '@/theme';

import { ScoreBadge } from './ui';

export function AttemptRow({ item, last }: { item: AttemptSummary; index?: number; last?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/attempt/${item.id}`)}
      style={({ pressed }) => [styles.row, !last && styles.divider, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={type.overline}>{item.category}</Text>
        <Text style={[type.body, { fontFamily: 'Inter_500Medium' }]} numberOfLines={2}>
          {item.topic}
        </Text>
        <Text style={type.small}>
          {formatDate(item.createdAt)} · {formatClock(item.durationSec)}
        </Text>
      </View>
      {item.status === 'Done' && item.score !== null ? (
        <ScoreBadge score={item.score} />
      ) : item.status === 'Failed' ? (
        <Text style={[type.label, { color: colors.danger }]}>{t.history.failed}</Text>
      ) : (
        <ActivityIndicator color={colors.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingVertical: spacing(1.75) },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
