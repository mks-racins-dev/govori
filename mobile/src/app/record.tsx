import { useQueryClient } from '@tanstack/react-query';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { CountdownRing } from '@/components/countdown-ring';
import { Button, Centered, Muted, Screen } from '@/components/ui';
import { dbToLevel, Waveform } from '@/components/waveform';
import { t } from '@/i18n/ru';
import { api, ApiError } from '@/lib/api';
import { formatClock } from '@/lib/format';
import { colors, fonts, spacing, type } from '@/theme';

const LIMIT_SEC = 60;
const MIN_SEC = 15;
const BARS = 32;
// Speech louder than this counts as voice; quiet rooms sit around -50 dBFS.
const VOICE_DB = -38;
// Less voiced time than this means the user stayed silent: don't upload.
const MIN_VOICED_SEC = 3;

type Phase = 'starting' | 'recording' | 'stopping' | 'uploading' | 'uploadFailed' | 'silent';

export default function RecordScreen() {
  const { topicId, topicText } = useLocalSearchParams<{ topicId: string; topicText: string }>();
  const queryClient = useQueryClient();

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [phase, setPhase] = useState<Phase>('starting');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.05));
  const result = useRef<{ uri: string; durationSec: number } | null>(null);
  const stopping = useRef(false);
  const voicedMs = useRef(0);
  const lastMs = useRef(0);

  const elapsedSec = state.durationMillis / 1000;

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(t.record.permission);
        router.back();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    })();
    // Stop recording if the user leaves the screen some other way.
    return () => {
      if (!stopping.current) recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'recording' && state.isRecording) {
      setLevels((prev) => [...prev.slice(1), dbToLevel(state.metering)]);
      const delta = state.durationMillis - lastMs.current;
      lastMs.current = state.durationMillis;
      if (delta > 0 && state.metering !== undefined && state.metering > VOICE_DB) voicedMs.current += delta;
    }
  }, [state.durationMillis, state.metering, state.isRecording, phase]);

  useEffect(() => {
    if (phase === 'recording' && elapsedSec >= LIMIT_SEC) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, phase]);

  async function finish() {
    if (stopping.current) return;
    stopping.current = true;
    setPhase('stopping');
    const durationSec = Math.min(LIMIT_SEC, Math.round(elapsedSec));
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!recorder.uri) {
      Alert.alert(t.common.error);
      router.back();
      return;
    }
    result.current = { uri: recorder.uri, durationSec };
    if (voicedMs.current < MIN_VOICED_SEC * 1000) {
      setPhase('silent');
      return;
    }
    upload();
  }

  // Discard the recording without uploading: nothing reaches the server or the AI.
  async function cancel() {
    if (stopping.current) return;
    stopping.current = true;
    result.current = null;
    await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    router.replace('/');
  }

  async function upload() {
    if (!result.current) return;
    setPhase('uploading');
    try {
      const { id } = await api.uploadAttempt(Number(topicId), result.current.durationSec, result.current.uri);
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
      router.replace(`/attempt/${id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        Alert.alert(t.record.limit);
        router.replace('/');
        return;
      }
      setUploadError(e instanceof Error ? e.message : String(e));
      setPhase('uploadFailed');
    }
  }

  if (phase === 'silent') {
    return (
      <Screen scroll={false}>
        <Centered>
          <Text style={[type.heading, { textAlign: 'center' }]}>{t.record.silentTitle}</Text>
          <Muted style={{ textAlign: 'center' }}>{t.record.silentText}</Muted>
          <View style={{ alignSelf: 'stretch', gap: spacing(1) }}>
            <Button label={t.record.tryAgain} onPress={() => router.replace('/topic')} />
            <Button label={t.common.cancel} variant="outline" onPress={() => router.replace('/')} />
          </View>
        </Centered>
      </Screen>
    );
  }

  if (phase === 'uploading' || phase === 'uploadFailed') {
    return (
      <Screen scroll={false}>
        <Centered>
          {phase === 'uploading' ? (
            <>
              <ActivityIndicator color={colors.ink} />
              <Muted>{t.record.uploading}</Muted>
            </>
          ) : (
            <>
              <Text style={type.heading}>{t.record.uploadFailed}</Text>
              {uploadError && <Muted style={{ textAlign: 'center' }}>{uploadError}</Muted>}
              <View style={{ alignSelf: 'stretch', gap: spacing(1) }}>
                <Button label={t.common.retry} onPress={upload} />
                <Button label={t.common.cancel} variant="outline" onPress={() => router.replace('/')} />
              </View>
            </>
          )}
        </Centered>
      </Screen>
    );
  }

  const canStop = elapsedSec >= MIN_SEC;

  return (
    <Screen
      scroll={false}
      footer={
        <View style={styles.footer}>
          <Button label={t.record.stop} onPress={finish} disabled={!canStop || phase !== 'recording'} />
          <Muted style={{ textAlign: 'center', opacity: canStop ? 0 : 1 }}>{t.record.minDuration}</Muted>
          <Button label={t.record.discard} variant="outline" onPress={cancel} disabled={phase !== 'recording'} />
        </View>
      }>
      <View style={styles.top}>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={[type.overline, { color: colors.ink }]}>{t.record.title}</Text>
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>{topicText}</Text>
      </View>
      <Centered>
        <CountdownRing progress={Math.min(1, elapsedSec / LIMIT_SEC)}>
          <Text style={styles.clock}>{formatClock(LIMIT_SEC - elapsedSec)}</Text>
        </CountdownRing>
        <Waveform levels={levels} progress={1} height={72} />
      </Centered>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing(1.5), marginTop: spacing(3) },
  live: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  clock: { fontFamily: fonts.medium, fontSize: 56, letterSpacing: -2, color: colors.ink, fontVariant: ['tabular-nums'] },
  footer: { padding: spacing(2.5), paddingBottom: spacing(5), gap: spacing(1) },
});
