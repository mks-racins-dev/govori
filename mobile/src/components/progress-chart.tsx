import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';

import { fmt as tpl, t } from '@/i18n/ru';
import type { Progress } from '@/lib/progress';
import { colors, fonts, radius, shadow, spacing, type } from '@/theme';

const H = 150;
const R = 16;
const PAD = R + 4;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export function ProgressChart({ progress }: { progress: Progress }) {
  const [w, setW] = useState(0);
  const { points, delta, unit, span } = progress;
  const values = points.map((p) => p.value);
  const lo = Math.max(1, Math.floor(Math.min(...values)) - 1);
  const hi = Math.min(10, Math.ceil(Math.max(...values)) + 1);
  const x = (i: number) => PAD + (i * (w - PAD * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD + ((hi - v) * (H - PAD * 2)) / Math.max(1, hi - lo);
  const last = points.length - 1;
  const deltaText = `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${fmt(Math.abs(delta))} ${
    tpl(unit === 'week' ? t.history.perWeeks : t.history.perAttempts, { n: span })
  }`;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={type.overline}>{t.history.progress}</Text>
        <Text style={[type.label, { color: delta > 0 ? colors.success : delta < 0 ? colors.danger : colors.muted }]}>{deltaText}</Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
        {w > 0 && (
          <Svg width={w} height={H}>
            <Polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={colors.chart}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <Circle key={`c${i}`} cx={x(i)} cy={y(p.value)} r={R} fill={i === last ? colors.chart : colors.white} stroke={colors.chart} strokeWidth={2.5} />
            ))}
            {points.map((p, i) => (
              <SvgText
                key={`t${i}`}
                x={x(i)}
                y={y(p.value) + 4.5}
                fontSize={Number.isInteger(p.value) ? 14 : 11}
                fontFamily={fonts.bold}
                fontWeight="700"
                fill={i === last ? colors.white : colors.ink}
                textAnchor="middle">
                {fmt(p.value)}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>
      <View style={styles.labels}>
        {points.map((p, i) => (
          <Text key={i} style={[type.label, styles.label, { left: w ? x(i) - 30 : 0 }]}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing(2.5), gap: spacing(1), ...shadow },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labels: { height: 16 },
  label: { position: 'absolute', width: 60, textAlign: 'center' },
});
