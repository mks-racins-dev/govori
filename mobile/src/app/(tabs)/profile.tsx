import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ArrowIcon } from '@/components/icons';
import { Card, Screen } from '@/components/ui';
import { t } from '@/i18n/ru';
import { api, PRIVACY_URL, RubricKey, SUPPORT_URL } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts, spacing, type } from '@/theme';

export default function Profile() {
  const session = useSession();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });

  const signOut = async () => {
    await session.signOut();
    queryClient.clear();
  };

  const deleteAccount = () =>
    Alert.alert(t.profile.deleteAccount, t.profile.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAccount();
            await signOut();
          } catch {
            Alert.alert(t.common.error);
          }
        },
      },
    ]);

  const d = me.data;
  return (
    <Screen>
      <Text style={[type.display, { marginTop: spacing(1) }]}>{t.profile.title}</Text>

      <Card style={styles.statsCard}>
        <Stat label={t.profile.attempts} value={d?.attempts} />
        <View style={styles.vline} />
        <Stat label={t.profile.average} value={d?.averageScore} />
        <View style={styles.vline} />
        <Stat label={t.profile.best} value={d?.bestScore} />
      </Card>

      <Card style={styles.streak}>
        <Text style={[type.display, { color: colors.white }]}>{d?.streakDays ?? 0}</Text>
        <Text style={[type.body, { color: 'rgba(255,255,255,0.7)' }]}>{t.profile.streak}</Text>
      </Card>

      {d?.criteria && <CriteriaCard criteria={d.criteria} />}

      <Card style={{ paddingVertical: spacing(0.5) }}>
        <Row label={t.profile.interests} onPress={() => router.push('/interests')} />
        <Row label={t.profile.support} onPress={() => WebBrowser.openBrowserAsync(SUPPORT_URL)} />
        <Row label={t.profile.privacy} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
        <Row label={t.profile.signOut} onPress={signOut} />
        <Row label={t.profile.deleteAccount} onPress={deleteAccount} danger last />
      </Card>
    </Screen>
  );
}

const CRITERIA: RubricKey[] = ['thought', 'support', 'conclusion', 'coherence', 'delivery'];

/** Average points per criterion; the weakest one is highlighted so it's clear what to train. */
function CriteriaCard({ criteria }: { criteria: Partial<Record<RubricKey, number>> }) {
  const keys = CRITERIA.filter((k) => criteria[k] != null);
  const weakest = keys.reduce<RubricKey | null>((w, k) => (w === null || criteria[k]! < criteria[w]! ? k : w), null);
  return (
    <Card style={{ gap: spacing(1.5) }}>
      <View style={{ gap: 2 }}>
        <Text style={type.overline}>{t.profile.criteria}</Text>
        <Text style={type.small}>{t.profile.criteriaHint}</Text>
      </View>
      {keys.map((k) => {
        const value = criteria[k]!;
        const weak = k === weakest && value < 2;
        return (
          <View key={k} style={styles.critRow}>
            <Text style={[type.small, styles.critLabel]}>{t.result.criteria[k]}</Text>
            <View style={styles.critTrack}>
              <View style={[styles.critFill, { width: `${(value / 2) * 100}%` }, weak && { backgroundColor: colors.danger }]} />
            </View>
            <Text style={styles.critValue}>{value.toLocaleString('ru-RU')}</Text>
          </View>
        );
      })}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value?: number | null }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={type.title}>{value ?? '–'}</Text>
      <Text style={[type.small, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function Row({ label, onPress, danger, last }: { label: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.divider, pressed && { opacity: 0.6 }]}>
      <Text style={[type.body, danger && { color: colors.danger }]}>{label}</Text>
      <ArrowIcon color={danger ? colors.danger : colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statsCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(3) },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.line },
  streak: { backgroundColor: colors.ink, gap: 2 },
  critRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  critLabel: { width: 112, color: colors.ink },
  critTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.fill, overflow: 'hidden' },
  critFill: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
  critValue: { width: 28, textAlign: 'right', fontFamily: fonts.semibold, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing(2) },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
