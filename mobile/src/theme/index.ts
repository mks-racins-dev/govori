import { TextStyle } from 'react-native';

// Monochrome, editorial palette: light grey canvas, white cards, black ink, one soft accent.
export const colors = {
  bg: '#F2F2F4',
  card: '#FFFFFF',
  ink: '#111111',
  text: '#111111',
  muted: '#8E8E93',
  faint: '#C7C7CC',
  line: '#E5E5EA',
  fill: '#F2F2F4',
  accent: '#7D9CD3', // soft blue for "new" badges and highlights
  accentTint: '#E8EEF9',
  chart: '#2F5BEA', // progress chart line and latest point
  success: '#3A9E6F',
  danger: '#E5484D',
  white: '#FFFFFF',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 34, letterSpacing: -1, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 24, letterSpacing: -0.6, color: colors.ink },
  heading: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.3, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
} satisfies Record<string, TextStyle>;

export const radius = { card: 28, tile: 22, pill: 999, input: 18 };
export const spacing = (n: number) => n * 8;

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};
