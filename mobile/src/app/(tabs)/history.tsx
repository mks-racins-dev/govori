import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttemptRow } from '@/components/attempt-row';
import { ProgressChart } from '@/components/progress-chart';
import { Muted, Pill } from '@/components/ui';
import { t } from '@/i18n/ru';
import { api } from '@/lib/api';
import { buildProgress } from '@/lib/progress';
import { useCategories } from '@/lib/use-categories';
import { colors, radius, shadow, spacing, type } from '@/theme';

export default function History() {
  const attempts = useQuery({ queryKey: ['attempts'], queryFn: api.attempts });
  const [filter, setFilter] = useState<string | null>(null);
  const categories = useCategories();
  const data = (attempts.data ?? []).filter((a) => !filter || a.category === filter);
  const progress = buildProgress(data);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: spacing(2), marginBottom: spacing(2) }}>
            <Text style={[type.display, { marginTop: spacing(1) }]}>{t.history.title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(1) }}>
              <Pill label={t.history.all} active={!filter} onPress={() => setFilter(null)} />
              {categories.map((c) => (
                <Pill key={c.name} label={c.name} active={filter === c.name} onPress={() => setFilter(c.name)} />
              ))}
            </ScrollView>
            {progress && <ProgressChart progress={progress} />}
          </View>
        }
        ListEmptyComponent={
          attempts.isPending ? <ActivityIndicator color={colors.muted} /> : <Muted style={{ textAlign: 'center' }}>{t.home.empty}</Muted>
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.cell,
              index === 0 && styles.first,
              index === data.length - 1 && styles.lastCell,
            ]}>
            <AttemptRow item={item} last={index === data.length - 1} />
          </View>
        )}
        refreshing={attempts.isRefetching}
        onRefresh={() => attempts.refetch()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(2.5), paddingBottom: spacing(4) },
  cell: { backgroundColor: colors.card, paddingHorizontal: spacing(2.5) },
  first: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingTop: spacing(0.5), ...shadow },
  lastCell: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, paddingBottom: spacing(0.5) },
});
