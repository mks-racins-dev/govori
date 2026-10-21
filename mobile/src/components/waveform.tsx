import { View } from 'react-native';

import { colors } from '@/theme';

/**
 * Minimal bar waveform: ink for the played/active part, light grey for the rest.
 * `levels` are 0..1. `progress` is 0..1 and decides where the colour switches.
 */
export function Waveform({
  levels,
  progress = 1,
  height = 80,
  barWidth = 3,
  gap = 3,
  active = colors.ink,
  rest = colors.faint,
}: {
  levels: number[];
  progress?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  active?: string;
  rest?: string;
}) {
  const split = Math.round(levels.length * progress);
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap }}>
      {levels.map((level, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            height: Math.max(3, level * height),
            borderRadius: barWidth,
            backgroundColor: i < split ? active : rest,
          }}
        />
      ))}
    </View>
  );
}

/** Converts recorder metering in dBFS (-160..0) to 0..1. */
export function dbToLevel(db: number | undefined) {
  if (db === undefined) return 0.05;
  const min = -50;
  return Math.min(1, Math.max(0.05, (db - min) / -min));
}

/** Deterministic pseudo-waveform for recordings we don't have level data for. */
export function placeholderLevels(seed: string, count = 40) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1103515245 + 12345) | 0;
    const noise = ((h >>> 16) & 0xff) / 255;
    const envelope = 0.4 + 0.6 * Math.sin((i / count) * Math.PI);
    return Math.max(0.12, noise * envelope);
  });
}
