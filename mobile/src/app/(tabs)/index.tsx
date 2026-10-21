import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscArt, MicArt } from '@/components/icons';
import { Badge, Button, Muted, SectionTitle } from '@/components/ui';
import { fmt, t } from '@/i18n/ru';
import { api } from '@/lib/api';
import { useCategories } from '@/lib/use-categories';
import { colors, radius, shadow, spacing, type } from '@/theme';

export default function Home() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const categories = useCategories();

  const start = (category?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(category ? { pathname: '/topic', params: { category } } : '/topic');
  };

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={me.isRefetching}
            onRefresh={() => me.refetch()}
          />
        }>
        <View style={styles.top}>
          <Text style={type.overline}>{today}</Text>
          <Text style={type.display}>{t.home.hello}</Text>
          {!!me.data?.streakDays && <Muted>🔥 {fmt(t.home.streak, { n: me.data.streakDays })}</Muted>}
        </View>

        <SectionTitle>{t.home.featured}</SectionTitle>
        <Pressable onPress={() => start()} style={({ pressed }) => [styles.featured, pressed && { opacity: 0.9 }]}>
          <View style={styles.featuredArt}>
            <MicArt size={84} />
          </View>
          <View style={styles.featuredBody}>
            <Text style={type.small}>{t.home.featuredLabel}</Text>
            <Text style={[type.heading, { marginTop: 2 }]}>{t.home.heroTitle}</Text>
            <Text style={[type.body, { color: colors.muted, marginTop: spacing(1) }]}>{t.home.heroText}</Text>
            <View style={{ flex: 1 }} />
            <View style={{ alignSelf: 'flex-start' }}>
              <Button small variant="outline" label={t.home.heroButton} onPress={() => start()} />
            </View>
          </View>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          style={styles.carouselWrap}>
          {categories.map((c) => (
            <Pressable key={c.name} onPress={() => start(c.name)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
              <View style={styles.tileArt}>
                <DiscArt size={60} />
                <View style={styles.tileBadge}>
                  <Badge label={c.badge ?? t.home.categoryLabel.toUpperCase()} tone={c.badge ? 'accent' : 'neutral'} />
                </View>
              </View>
              <Text style={[type.label, { marginTop: spacing(2.5) }]}>{t.home.categoryLabel}</Text>
              <Text style={[type.heading, styles.center]}>{c.name}</Text>
              <Text style={[type.small, styles.center, { color: colors.faint }]} numberOfLines={2}>
                {c.description}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(2.5), paddingBottom: spacing(4), gap: spacing(1.5) },
  top: { gap: spacing(0.5), marginTop: spacing(1), marginBottom: spacing(1) },
  featured: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: 'hidden',
    minHeight: 180,
    ...shadow,
  },
  featuredArt: { width: '36%', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  featuredBody: { flex: 1, padding: spacing(2) },
  carouselWrap: { marginHorizontal: -spacing(2.5) },
  carousel: { paddingHorizontal: spacing(2.5), gap: spacing(1.5), paddingVertical: spacing(0.5) },
  tile: {
    width: 156,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing(2),
    paddingTop: spacing(3),
    alignItems: 'center',
    ...shadow,
  },
  tileArt: { alignItems: 'center' },
  tileBadge: { position: 'absolute', bottom: -10 },
  center: { textAlign: 'center', marginTop: 4 },
});
