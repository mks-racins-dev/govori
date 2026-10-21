import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GridIcon, HomeIcon, JourneyIcon, PlusIcon, UserIcon } from '@/components/icons';
import { t } from '@/i18n/ru';
import { colors, fonts, spacing } from '@/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS = {
  index: { label: t.tabs.today, Icon: HomeIcon },
  topics: { label: t.tabs.topics, Icon: GridIcon },
  history: { label: t.tabs.history, Icon: JourneyIcon },
  profile: { label: t.tabs.profile, Icon: UserIcon },
} as const;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="topics" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const item = (index: number) => {
    const route = state.routes[index];
    const { label, Icon } = TABS[route.name as keyof typeof TABS];
    const focused = state.index === index;
    const color = focused ? colors.ink : colors.muted;
    return (
      <Pressable key={route.key} style={styles.item} onPress={() => navigation.navigate(route.name)}>
        <Icon color={color} />
        <Text style={[styles.label, { color, fontFamily: focused ? fonts.semibold : fonts.regular }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing(1.5)) }]}>
      {item(0)}
      {item(1)}
      <View style={styles.center}>
        <Pressable
          style={({ pressed }) => [styles.plus, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/topic');
          }}>
          <PlusIcon size={26} />
        </Pressable>
      </View>
      {item(2)}
      {item(3)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingTop: spacing(1),
    paddingHorizontal: spacing(1),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  center: { width: 72, alignItems: 'center' },
  label: { fontSize: 11 },
  plus: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
