import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Header, Muted, Screen } from '@/components/ui';
import { fmt, t } from '@/i18n/ru';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { useCategories } from '@/lib/use-categories';
import { colors, spacing, type } from '@/theme';

/** Turn categories on and off. Off categories are skipped in random topics and hidden from lists. */
export default function Interests() {
  const queryClient = useQueryClient();
  const categories = useCategories(undefined, { includeHidden: true });
  // Local copy so switches move instantly; null until the user changes something.
  const [hidden, setHidden] = useState<Set<string> | null>(null);
  const current = hidden ?? new Set(categories.filter((c) => c.hidden).map((c) => c.name));

  const save = useMutation({
    mutationFn: (names: string[]) => api.setHiddenCategories(names),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: () => setHidden(null), // fall back to what the server has
  });

  const toggle = (name: string, on: boolean) => {
    const next = new Set(current);
    if (on) next.delete(name);
    else next.add(name);
    if (next.size >= categories.length) return; // at least one must stay on
    Haptics.selectionAsync();
    setHidden(next);
    save.mutate([...next]);
  };

  const onCount = categories.length - current.size;

  return (
    <Screen>
      <Header title={t.interests.title} />
      <Muted>{t.interests.subtitle}</Muted>

      <Card style={{ paddingVertical: spacing(0.5) }}>
        {categories.map((c, i) => {
          const on = !current.has(c.name);
          const locked = on && onCount === 1;
          return (
            <View key={c.name} style={[styles.row, i < categories.length - 1 && styles.divider]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.body, !on && { color: colors.muted }]}>{c.name}</Text>
                <Text style={type.small}>{fmt(plural(c.topicCount, t.topics.count), { n: c.topicCount })}</Text>
              </View>
              <Switch
                value={on}
                disabled={locked}
                onValueChange={(v) => toggle(c.name, v)}
                trackColor={{ true: colors.ink, false: colors.line }}
                accessibilityLabel={c.name}
              />
            </View>
          );
        })}
      </Card>

      {onCount === 1 && <Muted>{t.interests.lastOne}</Muted>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingVertical: spacing(1.5) },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
