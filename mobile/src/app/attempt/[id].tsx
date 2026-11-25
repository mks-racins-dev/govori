import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AttemptPlayer, ReviewPlayer } from '@/components/audio-player';
import { ChevronIcon, TrashIcon } from '@/components/icons';
import { Badge, Button, Card, Centered, Header, Muted, Screen } from '@/components/ui';
import { fmt, t } from '@/i18n/ru';
import { api, Criterion, Evaluation, Metrics, RubricKey, SubScores, TechniqueAdvice } from '@/lib/api';
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
  // No delete while the report is being made: the worker is still writing it.
  const header = (
    <Header
      title={t.result.title}
      right={
        data &&
        data.status !== 'Processing' && (
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

      {ev && <ReviewCard attemptId={data.id} evaluation={ev} reviewText={data.reviewText} hasAudio={data.hasReviewAudio} />}

      {data.status === 'Failed' && (
        <Card style={{ gap: spacing(2) }}>
          <Text style={type.body}>{data.failureReason ?? t.common.error}</Text>
          {data.transcript !== '' && (
            <Button label={t.common.retry} onPress={() => retry.mutate()} loading={retry.isPending} />
          )}
        </Card>
      )}

      {ev?.rubric ? (
        <Card>
          <Text style={type.overline}>{t.result.criteriaTitle}</Text>
          {RUBRIC_KEYS.map((key, i) => (
            <CriterionRow
              key={key}
              first={i === 0}
              label={t.result.criteria[key]}
              criterion={ev.rubric![key]}
              delivery={key === 'delivery' ? data.metrics : null}
            />
          ))}
        </Card>
      ) : (
        ev?.subScores && (
          <Card style={{ gap: spacing(1.75) }}>
            <SubScoreBars scores={ev.subScores} />
          </Card>
        )
      )}

      {ev && <PracticeCard evaluation={ev} repeats={data.metrics?.vocabulary?.repeats ?? []} />}

      {(!!data.transcript || data.status !== 'Failed') && (
        <Card style={{ gap: spacing(1.5) }}>
          <Text style={type.overline}>{t.result.transcriptAndRecording}</Text>
          <View style={styles.recording}>
            <AttemptPlayer attemptId={data.id} fallbackDuration={data.durationSec} />
          </View>
          {!!data.transcript && (
            <Transcript text={data.transcript} fillers={Object.keys(data.metrics?.fillerWords ?? {})} />
          )}
          {data.metrics && <FillerChips fillers={data.metrics.fillerWords} />}
          {!!data.metrics?.unclearWords?.length && (
            <Muted>{fmt(t.result.unclear, { words: data.metrics.unclearWords.join(', ') })}</Muted>
          )}
        </Card>
      )}

      <Button label={t.result.again} onPress={() => router.replace('/topic')} />
    </Screen>
  );
}

const RUBRIC_KEYS: RubricKey[] = ['thought', 'support', 'conclusion', 'coherence', 'delivery'];

// Mirror of Delivery in the backend (Govori.Core/Abstractions.cs); used only to show which norm was missed.
const NORMS = { minWpm: 110, maxWpm: 160, maxFillersPerMinute: 2, minSeconds: 45 };

function CriterionRow({
  label,
  criterion,
  delivery,
  first,
}: {
  label: string;
  criterion: Criterion;
  delivery: Metrics | null;
  first: boolean;
}) {
  const ok = criterion.points === 2;
  return (
    <View style={[styles.criterion, !first && styles.divider]}>
      <View style={styles.criterionHead}>
        <Text style={type.heading}>{label}</Text>
        <Points value={criterion.points} />
      </View>
      {delivery ? (
        <DeliveryRows metrics={delivery} />
      ) : (
        <>
          {!!criterion.good && (
            <View style={styles.status}>
              <StatusIcon ok />
              <Text style={[type.body, { flex: 1, fontSize: 14, lineHeight: 20 }]}>
                <Text style={[styles.statusLabel, { color: colors.success }]}>{t.result.worked}:</Text>{' '}
                {criterion.good}
              </Text>
            </View>
          )}
          {ok && criterion.good ? (
            <Text style={[type.body, styles.analysis]}>{criterion.evidence}</Text>
          ) : (
            <View style={styles.status}>
              <StatusIcon ok={ok} />
              <Text style={[type.body, { flex: 1, fontSize: 14, lineHeight: 20 }]}>
                <Text style={[styles.statusLabel, { color: ok ? colors.success : colors.danger }]}>
                  {ok ? t.result.allGood : t.result.weakness}
                </Text>{' '}
                {criterion.evidence}
              </Text>
            </View>
          )}
        </>
      )}
      {!ok && !delivery && criterion.advice ? (
        <AdviceTip advice={criterion.advice} />
      ) : !ok && !!criterion.toMax && (
        <View style={styles.tip}>
          <Text style={styles.tipTitle}>{t.result.howToImprove}</Text>
          <Text style={[type.body, { fontSize: 14, lineHeight: 20 }]}>{criterion.toMax}</Text>
        </View>
      )}
    </View>
  );
}

/** Delivery split into the three measured norms, so it is clear which one cost the point. */
function DeliveryRows({ metrics: m }: { metrics: Metrics }) {
  const fillers = Object.values(m.fillerWords).reduce((a, b) => a + b, 0);
  const perMinute = fillers / (Math.max(m.durationSec, 1) / 60);
  const rows = [
    {
      label: t.result.delivery.pace,
      ok: m.wordsPerMinute >= NORMS.minWpm && m.wordsPerMinute <= NORMS.maxWpm,
      value: fmt(t.result.delivery.paceValue, { wpm: m.wordsPerMinute, min: NORMS.minWpm, max: NORMS.maxWpm }),
    },
    {
      label: t.result.delivery.fillers,
      ok: perMinute <= NORMS.maxFillersPerMinute,
      value: fmt(t.result.delivery.fillersValue, { n: fillers, max: NORMS.maxFillersPerMinute }),
    },
    {
      label: t.result.delivery.duration,
      ok: m.durationSec >= NORMS.minSeconds,
      value: fmt(t.result.delivery.durationValue, { sec: m.durationSec, min: NORMS.minSeconds }),
    },
  ];
  return (
    <View style={{ gap: spacing(1), marginTop: spacing(1) }}>
      {rows.map((r) => (
        <View key={r.label} style={styles.metric}>
          <StatusIcon ok={r.ok} />
          <Text style={[styles.metricLabel, !r.ok && { color: colors.danger }]}>{r.label}</Text>
          <Text style={[type.small, { flex: 1 }]}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

function StatusIcon({ ok }: { ok: boolean }) {
  return (
    <View style={[styles.statusIcon, { backgroundColor: ok ? colors.success : colors.danger }]}>
      <Text style={styles.statusIconText}>{ok ? '✓' : '!'}</Text>
    </View>
  );
}

function Points({ value }: { value: number }) {
  return (
    <View style={styles.points} accessibilityLabel={`${value} из 2`}>
      {[1, 2].map((i) => (
        <View key={i} style={[styles.point, i <= value && { backgroundColor: colors.ink }]} />
      ))}
      <Text style={styles.pointsText}>{value}/2</Text>
    </View>
  );
}

/** Vocabulary with replacements for repeated words, plus one short exercise for the next attempt. */
/** How to improve: the technique, its formula, the speaker's own words before and after, and one next step. */
function AdviceTip({ advice }: { advice: TechniqueAdvice }) {
  return (
    <View style={[styles.tip, { gap: spacing(1) }]}>
      <View style={{ gap: 2 }}>
        <Text style={styles.tipTitle}>{advice.name ? `${t.result.technique} · ${advice.name}` : t.result.howToImprove}</Text>
        {!!advice.formula && <Text style={styles.formula}>{advice.formula}</Text>}
      </View>
      {!!advice.after && (
        <View style={{ gap: 4 }}>
          <Text style={styles.tipLabel}>{t.result.tryThis}</Text>
          {!!advice.before && (
            <Text style={[styles.tipText, { color: colors.muted }]}>
              <Text style={styles.tipLabelInline}>{t.result.was}: </Text>
              {advice.before}
            </Text>
          )}
          <Text style={styles.tipText}>
            <Text style={styles.tipLabelInline}>{t.result.became}: </Text>
            {advice.after}
            {advice.hypothetical && <Text style={{ color: colors.muted }}> ({t.result.hypothetical})</Text>}
          </Text>
        </View>
      )}
      {!!advice.nextStep && (
        <View style={{ gap: 4 }}>
          <Text style={styles.tipLabel}>{t.result.nextTime}</Text>
          <Text style={styles.tipText}>{advice.nextStep}</Text>
        </View>
      )}
    </View>
  );
}

function PracticeCard({
  evaluation,
  repeats,
}: {
  evaluation: Evaluation;
  repeats: { word: string; count: number }[];
}) {
  const synonyms = evaluation.synonyms ?? [];
  const counts = new Map(repeats.map((r) => [r.word, r.count]));
  const exercise = evaluation.practice?.text ?? evaluation.suggestions[0];
  const exerciseTechnique = evaluation.practice?.name;
  // Older evaluations have no synonyms; their vocabulary drill is shown instead.
  const drill = synonyms.length === 0 ? evaluation.drill : null;
  if (synonyms.length === 0 && !drill && !exercise) return null;

  return (
    <Card style={{ gap: spacing(1.25) }}>
      <Text style={type.overline}>{t.result.practice}</Text>
      {(synonyms.length > 0 || !!drill) && (
        <View style={{ gap: spacing(1.25) }}>
          <Text style={type.heading}>{t.result.vocabulary}</Text>
          {synonyms.length > 0 && <Text style={type.small}>{t.result.vocabularyHint}</Text>}
          {synonyms.map((s) => (
            <View key={s.word} style={styles.synonym}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {s.word}
                  {counts.has(s.word) ? ` · ${counts.get(s.word)}` : ''}
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
              <Text style={[type.body, { flex: 1, fontSize: 14, lineHeight: 19 }]}>{s.options.join(', ')}</Text>
            </View>
          ))}
          {!!drill && (
            <Text style={type.body}>
              {!!evaluation.drillTechnique && <Text style={styles.tipLabelInline}>{evaluation.drillTechnique}. </Text>}
              {drill}
            </Text>
          )}
        </View>
      )}
      {!!exercise && (
        <View style={{ gap: 4, marginTop: spacing(1) }}>
          <Text style={type.heading}>{t.result.exercise30}</Text>
          {!!exerciseTechnique && <Text style={styles.tipTitle}>{`${t.result.technique} · ${exerciseTechnique}`}</Text>}
          <Text style={type.body}>{exercise}</Text>
        </View>
      )}
    </Card>
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

/** About how long the voice-over runs, shown before it is loaded: ~2.5 words a second. */
function estimateSeconds(text: string | null) {
  return text ? Math.round(text.split(/\s+/).filter(Boolean).length / 2.5) : 0;
}

/** The AI coach's spoken review, with the written version behind a toggle. */
function ReviewCard({
  attemptId,
  evaluation,
  reviewText,
  hasAudio,
}: {
  attemptId: string;
  evaluation: Evaluation;
  reviewText: string | null;
  hasAudio: boolean;
}) {
  // Without a voice-over (older attempts, TTS unavailable) the text is the only review, so show it right away.
  const [open, setOpen] = useState(!hasAudio);
  return (
    <Card style={{ gap: spacing(2) }}>
      <Text style={type.overline}>{t.result.review}</Text>
      {hasAudio && <ReviewPlayer attemptId={attemptId} estimatedDuration={estimateSeconds(reviewText)} />}
      {hasAudio && (
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.toggleText}>{open ? t.result.hideReview : t.result.showReview}</Text>
          <ChevronIcon up={open} color={colors.ink} />
        </Pressable>
      )}
      {open &&
        (reviewText !== null ? (
          <Text style={type.body}>{reviewText}</Text>
        ) : (
          <View style={{ gap: spacing(2.5) }}>
            <ReviewList title={t.result.strengths} items={evaluation.strengths} mark="+" />
            <ReviewList title={t.result.improvements} items={evaluation.improvements} mark="–" />
            <ReviewList title={t.result.suggestions} items={evaluation.suggestions} mark="→" />
          </View>
        ))}
    </Card>
  );
}

function ReviewList({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: spacing(1.5) }}>
      <Text style={type.heading}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.item}>
          <View style={styles.mark}>
            <Text style={styles.markText}>{mark}</Text>
          </View>
          <Text style={[type.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
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
    .map((f) => (f === 'э-э' ? 'э+-?э*м*|м{2,}' : f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}-])`, 'giu');
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
  criterion: { gap: 6, paddingVertical: spacing(1.75) },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  criterionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  points: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line },
  pointsText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginLeft: 6 },
  status: { flexDirection: 'row', gap: spacing(1), alignItems: 'flex-start' },
  statusLabel: { fontFamily: fonts.semibold },
  statusIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusIconText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  metric: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  metricLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, width: 104 },
  tip: {
    backgroundColor: colors.accentTint,
    borderRadius: 16,
    padding: spacing(1.5),
    gap: 4,
    marginTop: spacing(0.75),
    marginLeft: 28,
  },
  tipTitle: { ...type.overline, color: colors.accent },
  formula: { ...type.body, fontSize: 15, lineHeight: 20, fontFamily: fonts.semibold },
  tipLabel: { ...type.small, color: colors.muted },
  tipLabelInline: { fontFamily: fonts.semibold },
  tipText: { ...type.body, fontSize: 14, lineHeight: 20 },
  analysis: { fontSize: 14, lineHeight: 20, color: colors.muted, marginLeft: 28 },
  synonym: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  arrow: { color: colors.faint, fontSize: 14 },
  recording: { backgroundColor: colors.fill, borderRadius: 20, padding: spacing(1.5) },
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
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
    paddingVertical: spacing(1.75),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toggleText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  chip: { backgroundColor: colors.accentTint, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
  filler: { color: colors.accent, fontFamily: fonts.semibold },
});
