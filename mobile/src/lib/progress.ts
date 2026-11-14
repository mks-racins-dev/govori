import type { AttemptSummary } from './api';

export type ProgressPoint = { value: number; label: string };
/** `span` is how many weeks (or attempts) the chart covers, for the "+2 за 4 нед." caption. */
export type Progress = { points: ProgressPoint[]; delta: number; unit: 'week' | 'attempt'; span: number };

const DAY = 86_400_000;
const MAX_POINTS = 6;

/** Monday 00:00 (local time) of the week containing `d`. */
function weekStart(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Score trend for the progress chart: weekly averages when the scored attempts span 2+ weeks,
 * otherwise the individual scores. Returns null when there are fewer than 2 points to compare.
 */
export function buildProgress(attempts: AttemptSummary[]): Progress | null {
  const scored = attempts
    .filter((a) => a.status === 'Done' && a.score !== null)
    .map((a) => ({ score: a.score as number, at: new Date(a.createdAt) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (scored.length < 2) return null;

  const weeks = new Map<number, number[]>();
  for (const s of scored) {
    const key = weekStart(s.at).getTime();
    weeks.set(key, [...(weeks.get(key) ?? []), s.score]);
  }

  let points: ProgressPoint[];
  let unit: Progress['unit'];
  let span: number;
  if (weeks.size >= 2) {
    unit = 'week';
    const keys = [...weeks.keys()].sort((a, b) => a - b).slice(-MAX_POINTS);
    const first = keys[0];
    span = Math.round((keys[keys.length - 1] - first) / (7 * DAY)) + 1;
    points = keys.map((k) => {
      const v = weeks.get(k)!;
      return { value: round1(v.reduce((a, b) => a + b, 0) / v.length), label: `${Math.round((k - first) / (7 * DAY)) + 1} нед` };
    });
  } else {
    unit = 'attempt';
    span = Math.min(scored.length, MAX_POINTS);
    points = scored.slice(-MAX_POINTS).map((s, i) => ({ value: s.score, label: `#${i + 1}` }));
  }
  return { points, delta: round1(points[points.length - 1].value - points[0].value), unit, span };
}
