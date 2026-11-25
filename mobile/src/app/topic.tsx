import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MicArt, ShuffleIcon } from '@/components/icons';
import { Badge, Button, Centered, Header, Muted, Screen } from '@/components/ui';
import { fmt, t } from '@/i18n/ru';
import { api } from '@/lib/api';
import { colors, radius, shadow, spacing, type } from '@/theme';

const MAX_REROLLS = 2;

/** Harder topics get more time to think: 10 s easy, 15 s medium, 20 s hard. */
function prepSeconds(difficulty: number) {
  return 5 + 5 * Math.min(Math.max(difficulty, 1), 3);
}

export default function TopicScreen() {
  const { category, genre } = useLocalSearchParams<{ category?: string; genre?: string }>();
  const [rerolls, setRerolls] = useState(0);
  const [exclude, setExclude] = useState<number | undefined>();
  const [secondsLeft, setSecondsLeft] = useState(prepSeconds(1));

  const topic = useQuery({
    queryKey: ['topic', category, genre, rerolls],
    queryFn: () => api.randomTopic(exclude, category, genre),
    staleTime: Infinity,
    gcTime: 0,
  });

  const start = () => {
    if (!topic.data) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({
      pathname: '/record',
      params: { topicId: String(topic.data.id), topicText: topic.data.text },
    });
  };

  // Prep countdown restarts whenever a new topic arrives, then auto-starts recording.
  useEffect(() => {
    if (!topic.data) return;
    setSecondsLeft(prepSeconds(topic.data.difficulty));
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [topic.data]);

  useEffect(() => {
    if (secondsLeft <= 0 && topic.data) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const reroll = () => {
    setExclude(topic.data?.id);
    setRerolls((r) => r + 1);
  };

  const prepTotal = prepSeconds(topic.data?.difficulty ?? 1);
  const prepProgress = 1 - Math.max(secondsLeft, 0) / prepTotal;

  return (
    <Screen
      scroll={false}
      footer={
        <View style={styles.footer}>
          <Button label={t.topic.start} onPress={start} disabled={!topic.data} />
        </View>
      }>
      <Header />
      {topic.isPending ? (
        <Centered>
          <ActivityIndicator color={colors.muted} />
        </Centered>
      ) : topic.isError ? (
        <Centered>
          <Muted>{t.common.error}</Muted>
          <Button label={t.common.retry} variant="outline" onPress={() => topic.refetch()} />
        </Centered>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing(3) }}>
          <View style={styles.card}>
            <View style={styles.art}>
              <MicArt size={64} />
            </View>
            <View style={styles.body}>
              <View style={styles.meta}>
                <View style={styles.badges}>
                  {!!topic.data.genre && <Badge label={topic.data.genre.toUpperCase()} />}
                  <Badge label={topic.data.category.toUpperCase()} tone="neutral" />
                </View>
                <Difficulty level={topic.data.difficulty} />
              </View>
              <Text style={[type.title, styles.topic]}>{topic.data.text}</Text>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${prepProgress * 100}%` }]} />
              </View>
              <Text style={[type.small, { textAlign: 'center' }]}>{fmt(t.topic.autoStart, { s: Math.max(secondsLeft, 0) })}</Text>
            </View>
          </View>

          {rerolls < MAX_REROLLS && (
            <Pressable style={styles.reroll} onPress={reroll} hitSlop={8}>
              <ShuffleIcon size={18} color={colors.muted} />
              <Text style={[type.label, { fontSize: 14 }]}>
                {t.topic.reroll} · {MAX_REROLLS - rerolls}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Screen>
  );
}

function Difficulty({ level }: { level: number }) {
  const label = t.topic.difficulty[Math.min(Math.max(level, 1), 3) - 1];
  return (
    <View style={styles.dots} accessibilityLabel={label}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.dot, i <= level && { backgroundColor: colors.ink }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(1) },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(0.75), flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', ...shadow },
  art: { height: 112, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing(3), gap: spacing(2), alignItems: 'stretch' },
  topic: { textAlign: 'center', fontSize: 26, lineHeight: 32 },
  track: { height: 2, backgroundColor: colors.line, borderRadius: 1, overflow: 'hidden', marginTop: spacing(1) },
  trackFill: { height: 2, backgroundColor: colors.ink },
  reroll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(1) },
  footer: { padding: spacing(2.5), paddingBottom: spacing(5) },
});
