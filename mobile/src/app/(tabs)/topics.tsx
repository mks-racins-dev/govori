import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DiscArt } from '@/components/icons';
import { Badge, Pill, Screen } from '@/components/ui';
import { fmt, t } from '@/i18n/ru';
import { plural } from '@/lib/format';
import { useCategories, useGenres } from '@/lib/use-categories';
import { colors, radius, shadow, spacing, type } from '@/theme';

export default function Topics() {
  const [genre, setGenre] = useState<string | undefined>();
  const genres = useGenres();
  const categories = useCategories(genre);
  const start = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/topic', params: genre ? { category, genre } : { category } });
  };

  return (
    <Screen>
      <View style={{ gap: spacing(0.5), marginTop: spacing(1) }}>
        <Text style={type.display}>{t.topics.title}</Text>
        <Text style={type.small}>{t.topics.subtitle}</Text>
      </View>

      {genres.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.genres}
          contentContainerStyle={styles.genresContent}>
          <Pill label={t.topics.allGenres} active={!genre} onPress={() => setGenre(undefined)} />
          {genres.map((g) => (
            <Pill key={g.name} label={g.name} active={genre === g.name} onPress={() => setGenre(g.name)} />
          ))}
        </ScrollView>
      )}

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
            <Text style={[type.small, styles.center, { color: colors.faint }]}>{fmt(plural(c.topicCount, t.topics.count), { n: c.topicCount })}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so chips scroll under them, while the first chip lines up with the content.
  genres: { marginHorizontal: -spacing(2.5), flexGrow: 0 },
  genresContent: { gap: spacing(1), paddingHorizontal: spacing(2.5) },
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
