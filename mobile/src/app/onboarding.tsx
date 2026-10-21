import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { MicArt } from '@/components/icons';
import { Button, Card, Screen } from '@/components/ui';
import { t } from '@/i18n/ru';
import { useSession } from '@/lib/session';
import { colors, fonts, radius, shadow, spacing, type } from '@/theme';

export default function Onboarding() {
  const session = useSession();
  const [agreed, setAgreed] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') Alert.alert(t.common.error, String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <MicArt size={96} />
      </View>

      <View style={{ gap: spacing(1), marginTop: spacing(1) }}>
        <Text style={type.display}>{t.onboarding.title}</Text>
        <Text style={[type.body, { color: colors.muted, fontSize: 17, lineHeight: 24 }]}>{t.onboarding.subtitle}</Text>
      </View>

      <Card style={{ gap: spacing(2) }}>
        {t.onboarding.steps.map((step, i) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNum}>0{i + 1}</Text>
            <Text style={[type.body, { flex: 1 }]}>{step}</Text>
          </View>
        ))}
      </Card>

      <Pressable style={styles.consent} onPress={() => setAgreed(!agreed)}>
        <View style={[styles.check, agreed && styles.checkOn]}>{agreed && <Text style={styles.tick}>✓</Text>}</View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.body, { fontFamily: fonts.medium }]}>{t.onboarding.agree}</Text>
          <Text style={type.small}>{t.onboarding.consent}</Text>
        </View>
      </Pressable>

      {appleAvailable && (
        <View style={{ opacity: agreed ? 1 : 0.35 }} pointerEvents={agreed && !busy ? 'auto' : 'none'}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.pill}
            style={{ height: 54 }}
            onPress={() => run(session.signInWithApple)}
          />
        </View>
      )}
      {__DEV__ && (
        <Button
          label={t.onboarding.devLogin}
          variant={appleAvailable ? 'outline' : 'primary'}
          disabled={!agreed}
          loading={busy}
          onPress={() => run(session.signInDev)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 220,
    borderRadius: radius.card,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing(1),
    ...shadow,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  stepNum: { fontFamily: fonts.semibold, fontSize: 13, color: colors.faint, width: 22 },
  consent: { flexDirection: 'row', gap: spacing(1.5), alignItems: 'flex-start', paddingHorizontal: spacing(0.5) },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tick: { color: colors.white, fontSize: 12, fontFamily: fonts.bold },
});
