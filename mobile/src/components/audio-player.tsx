import { AudioSource, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { formatClock } from '@/lib/format';
import { colors, spacing, type } from '@/theme';

import { PauseIcon, PlayIcon } from './icons';
import { placeholderLevels, Waveform } from './waveform';

export function AttemptPlayer({ attemptId, fallbackDuration }: { attemptId: string; fallbackDuration: number }) {
  const [source, setSource] = useState<AudioSource | null>(null);

  useEffect(() => {
    api.audioSource(attemptId).then(setSource);
  }, [attemptId]);

  return source ? <Player source={source} seed={attemptId} fallbackDuration={fallbackDuration} /> : null;
}

/**
 * Plays the AI coach's spoken review of an attempt. The server voices the review on the first request,
 * so nothing is loaded until the user presses play.
 */
export function ReviewPlayer({ attemptId }: { attemptId: string }) {
  const [source, setSource] = useState<AudioSource | null>(null);
  const [requested, setRequested] = useState(false);
  const seed = `review-${attemptId}`;

  const request = () => {
    setRequested(true);
    api.reviewAudioSource(attemptId).then(setSource);
  };

  return source ? (
    <Player source={source} seed={seed} fallbackDuration={0} autoPlay />
  ) : (
    <IdlePlayer seed={seed} onPlay={request} loading={requested} />
  );
}

/** Looks like the player before any audio is loaded. */
function IdlePlayer({ seed, onPlay, loading }: { seed: string; onPlay: () => void; loading: boolean }) {
  const levels = useMemo(() => placeholderLevels(seed, 34), [seed]);
  return (
    <View style={styles.row}>
      <Pressable onPress={onPlay} style={styles.play} disabled={loading}>
        <PlayIcon size={18} color="#fff" />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Waveform levels={levels} progress={0} height={36} barWidth={2.5} gap={2.5} />
        <View style={styles.times}>
          <Text style={type.label}>{formatClock(0)}</Text>
          <Text style={type.label}>{formatClock(0)}</Text>
        </View>
      </View>
    </View>
  );
}

function Player({
  source,
  seed,
  fallbackDuration,
  autoPlay = false,
}: {
  source: AudioSource;
  seed: string;
  fallbackDuration: number;
  autoPlay?: boolean;
}) {
  const player = useAudioPlayer(source, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const levels = useMemo(() => placeholderLevels(seed, 34), [seed]);
  const autoPlayed = useRef(false);

  // The user already pressed play once; start as soon as the audio is ready.
  useEffect(() => {
    if (autoPlay && status.isLoaded && !autoPlayed.current) {
      autoPlayed.current = true;
      player.play();
    }
  }, [autoPlay, status.isLoaded, player]);

  const duration = status.duration || fallbackDuration;
  const progress = duration ? Math.min(1, status.currentTime / duration) : 0;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  }, []);

  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0);
  }, [status.didJustFinish, player]);

  const toggle = () => (status.playing ? player.pause() : player.play());

  return (
    <View style={styles.row}>
      <Pressable onPress={toggle} style={styles.play} disabled={!status.isLoaded}>
        {status.playing ? <PauseIcon size={18} color="#fff" /> : <PlayIcon size={18} color="#fff" />}
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Waveform levels={levels} progress={progress} height={36} barWidth={2.5} gap={2.5} />
        <View style={styles.times}>
          <Text style={type.label}>{formatClock(status.currentTime)}</Text>
          <Text style={type.label}>{formatClock(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
