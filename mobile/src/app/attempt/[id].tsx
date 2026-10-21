import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AttemptPlayer } from '@/components/audio-player';
import { TrashIcon } from '@/components/icons';
import { Badge, Button, Card, Centered, Header, Muted, Screen } from '@/components/ui';
import { t } from '@/i18n/ru';
import { api, AttemptDetail, SubScores } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { colors, fonts, radius, spacing, type } from '@/theme';

export default function AttemptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const attempt = useQuery({
    queryKey: ['attempt', id],
    queryFn: () => api.attempt(id),
    refetchInterval: (q) => (q.state.data?.status === 'Processing' ? 2000 : false),
  });

  const retry = useMutation({
    mutationFn: () => api.retryAttempt(id),
    onSuccess: () => attempt.refetch(),
  });

  const remove = () =>
    Alert.alert(t.result.deleteConfirm, undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          await api.deleteAttempt(id);
          queryClient.invalidateQueries({ queryKey: ['attempts'] });
          queryClient.invalidateQueries({ queryKey: ['me'] });
          router.back();
        },
      },
    ]);

  const data = attempt.data;
  const header = (
    <Header
      title={t.result.title}
      right={
        data && (
          <Pressable hitSlop={12} onPress={remove}>
            <TrashIcon size={20} color={colors.muted} />
          </Pressable>
        )
      }
    />
  );

  if (!data || data.status === 'Processing') {
    return (
      <Screen scroll={false}>
        {header}
        <Centered>
          {attempt.isError ? (
            <Muted>{t.common.error}</Muted>
          ) : (
            <>
              <ActivityIndicator color={colors.ink} />
              {data && (
                <>
                  <Text style={type.heading}>{t.analysis.loading}</Text>
                  <Muted>{t.analysis.hint}</Muted>
                </>
              )}
            </>
          )}
        </Centered>
      </Screen>
    );
  }

  const ev = data.evaluation;
  const fillerTotal = data.metrics ? Object.values(data.metrics.fillerWords).reduce((a, b) => a + b, 0) : 0;

  return (
    <Screen>
      {header}

      <Card style={styles.hero}>
        <Badge label={data.topic.category.toUpperCase()} tone="neutral" />
        <Text style={[type.title, { textAlign: 'center' }]}>{data.topic.text}</Text>
        <Muted>{formatDate(data.createdAt)}</Muted>
        {ev && (
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{ev.score}</Text>
            <Text style={styles.scoreOf}>/10</Text>
          </View>
        )}
        {ev && <Text style={[type.body, styles.summary]}>{ev.summary}</Text>}
      </Card>

      <Card>
        <AttemptPlayer attemptId={data.id} fallbackDuration={data.durationSec} />
      </Card>

      {data.status === 'Failed' && (
        <Card style={{ gap: spacing(2) }}>
          <Text style={type.body}>{data.failureReason ?? t.common.error}</Text>
          {data.transcript !== '' && (
            <Button label={t.common.retry} onPress={() => retry.mutate()} loading={retry.isPending} />
          )}
        </Card>
      )}

      {ev && (
        <Card style={{ gap: spacing(1.75) }}>
          <SubScoreBars scores={ev.subScores} />
        </Card>
      )}

      {data.metrics && (
        <View style={styles.stats}>
          <Stat value={data.metrics.wordsPerMinute} label={t.result.wpm} />
          <Stat value={data.metrics.wordCount} label={t.result.words} />
          <Stat value={fillerTotal} label={t.result.fillers.toLowerCase()} />
        </View>
      )}

      {ev && (
        <>
          <ListCard title={t.result.strengths} items={ev.strengths} mark="+" />
          <ListCard title={t.result.improvements} items={ev.improvements} mark="–" />
          <ListCard title={t.result.suggestions} items={ev.suggestions} mark="→" />
        </>
      )}

      {!!data.transcript && (
        <Card style={{ gap: spacing(1.5) }}>
          <Text style={type.overline}>{t.result.transcript}</Text>
          <Transcript text={data.transcript} fillers={Object.keys(data.metrics?.fillerWords ?? {})} />
          {data.metrics && <FillerChips fillers={data.metrics.fillerWords} />}
        </Card>
      )}

      <Button label={t.result.again} onPress={() => router.replace('/topic')} />
    </Screen>
  );
}

function SubScoreBars({ scores }: { scores: SubScores }) {
  return (
    <>
      {(Object.keys(t.result.subScores) as (keyof SubScores)[]).map((key) => (
        <View key={key} style={styles.barRow}>
          <Text style={[type.small, styles.barLabel]}>{t.result.subScores[key]}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${scores[key] * 10}%` }]} />
          </View>
          <Text style={styles.barValue}>{scores[key]}</Text>
        </View>
      ))}
    </>
  );
}

function ListCard({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  if (items.length === 0) return null;
  return (
    <Card style={{ gap: spacing(1.75) }}>
      <Text style={type.overline}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.item}>
          <View style={styles.mark}>
            <Text style={styles.markText}>{mark}</Text>
          </View>
          <Text style={[type.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={type.title}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </Card>
  );
}

function FillerChips({ fillers }: { fillers: Record<string, number> }) {
  const entries = Object.entries(fillers).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <Muted>{t.result.noFillers}</Muted>;
  return (
    <View style={styles.chips}>
      {entries.map(([word, count]) => (
        <View key={word} style={styles.chip}>
          <Text style={styles.chipText}>
            {word} · {count}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Renders the transcript with filler words highlighted. */
function Transcript({ text, fillers }: { text: string; fillers: string[] }) {
  if (fillers.length === 0) return <Text style={type.body}>{text}</Text>;
  const escaped = fillers
    .map((f) => (f === 'э-э' ? 'э+-?э*м*' : f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'giu');
  const parts = text.split(re);
  return (
    <Text style={[type.body, { color: '#3A3A3C' }]}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.filler}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing(1.25), paddingVertical: spacing(3.5) },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing(1) },
  score: { fontFamily: fonts.semibold, fontSize: 72, letterSpacing: -3, lineHeight: 78, color: colors.ink },
  scoreOf: { fontFamily: fonts.medium, fontSize: 20, color: colors.faint, marginBottom: 12, marginLeft: 4 },
  summary: { textAlign: 'center', color: colors.muted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  barLabel: { width: 84, color: colors.ink },
  barTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.fill, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
  barValue: { width: 20, textAlign: 'right', fontFamily: fonts.semibold, color: colors.ink },
  stats: { flexDirection: 'row', gap: spacing(1.5) },
  stat: { flex: 1, alignItems: 'center', gap: 2, padding: spacing(2) },
  item: { flexDirection: 'row', gap: spacing(1.5), alignItems: 'flex-start' },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -1,
  },
  markText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  chip: { backgroundColor: colors.accentTint, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
  filler: { color: colors.accent, fontFamily: fonts.semibold },
});
