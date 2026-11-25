import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { t } from '@/i18n/ru';
import { api } from '@/lib/api';
import { useCategories } from '@/lib/use-categories';
import { colors, fonts, radius, spacing, type } from '@/theme';

/**
 * Bottom sheet to turn categories on and off. Off categories disappear from the home screen and are
 * skipped by random topics. At least one stays on.
 */
export function CategoriesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const categories = useCategories(undefined, { includeHidden: true });
  // Local copy so chips react instantly; null until the user changes something.
  const [hidden, setHidden] = useState<Set<string> | null>(null);
  const current = hidden ?? new Set(categories.filter((c) => c.hidden).map((c) => c.name));

  const save = useMutation({
    mutationFn: (names: string[]) => api.setHiddenCategories(names),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: () => setHidden(null), // fall back to what the server has
  });

  const toggle = (name: string) => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    if (next.size >= categories.length) return; // at least one must stay on
    Haptics.selectionAsync();
    setHidden(next);
    save.mutate([...next]);
  };

  const onCount = categories.length - current.size;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.home.filterDone} />
      <View style={[styles.sheet, { paddingBottom: spacing(2.5) + insets.bottom }]}>
        <View style={styles.grab} />
        <Text style={type.heading}>{t.home.filterTitle}</Text>
        <Text style={[type.small, { marginTop: 4 }]}>{t.home.filterHint}</Text>
        <View style={styles.chips}>
          {categories.map((c) => {
            const on = !current.has(c.name);
            return (
              <Pressable
                key={c.name}
                onPress={() => toggle(c.name)}
                disabled={on && onCount === 1}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
                <Text style={[styles.chipText, on ? { color: colors.card } : styles.chipTextOff]}>
                  {on ? `✓ ${c.name}` : c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {onCount === 1 && <Text style={[type.small, { marginTop: spacing(1) }]}>{t.home.filterLastOne}</Text>}
        <View style={{ marginTop: spacing(2.5) }}>
          <Button label={t.home.filterDone} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing(2.5),
    paddingTop: spacing(1.5),
  },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: spacing(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginTop: spacing(2) },
  chip: { paddingVertical: spacing(1), paddingHorizontal: spacing(1.75), borderRadius: 20, borderWidth: 1 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipOff: { backgroundColor: colors.card, borderColor: colors.line },
  chipText: { ...type.body, fontSize: 14, lineHeight: 18, fontFamily: fonts.medium },
  chipTextOff: { color: colors.muted, textDecorationLine: 'line-through' },
});
