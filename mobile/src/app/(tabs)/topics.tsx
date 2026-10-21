import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DiscArt } from '@/components/icons';
import { Badge, Screen } from '@/components/ui';
import { t } from '@/i18n/ru';
import { useCategories } from '@/lib/use-categories';
import { colors, radius, shadow, spacing, type } from '@/theme';

export default function Topics() {
  const categories = useCategories();
  const start = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/topic', params: { category } });
  };

  return (
    <Screen>
      <View style={{ gap: spacing(0.5), marginTop: spacing(1) }}>
        <Text style={type.display}>{t.topics.title}</Text>
        <Text style={type.small}>{t.topics.subtitle}</Text>
      </View>

      <View style={styles.grid}>
        {categories.map((c) => (
          <Pressable
            key={c.name}
            onPress={() => start(c.name)}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
            <View style={{ alignItems: 'center' }}>
              <DiscArt size={56} />
              {c.badge && (
                <View style={styles.badge}>
                  <Badge label={c.badge} />
                </View>
              )}
            </View>
            <Text style={[type.heading, styles.center, { marginTop: spacing(2.5) }]}>{c.name}</Text>
            <Text style={[type.small, styles.center, { color: colors.faint }]} numberOfLines={3}>
              {c.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing(1.5) },
  tile: {
    width: '48.5%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing(2),
    paddingTop: spacing(3),
    alignItems: 'center',
    ...shadow,
  },
  badge: { position: 'absolute', bottom: -10 },
  center: { textAlign: 'center', marginTop: 4 },
});
