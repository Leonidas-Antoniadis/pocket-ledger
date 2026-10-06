import { Platform } from 'react-native';

export interface ThemeColors {
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  card: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  chip: string;
  danger: string;
  overlay: string;
  inputBackground: string;
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    text: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    background: '#F4F6F8',
    card: '#FFFFFF',
    border: '#E5E7EB',
    primary: '#0F766E',
    primarySoft: '#CCFBF1',
    onPrimary: '#FFFFFF',
    income: '#15803D',
    incomeSoft: '#DCFCE7',
    expense: '#B91C1C',
    expenseSoft: '#FEE2E2',
    chip: '#EEF2F6',
    danger: '#DC2626',
    overlay: 'rgba(0,0,0,0.55)',
    inputBackground: '#FFFFFF',
  },
  dark: {
    text: '#F3F4F6',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    background: '#0B0F14',
    card: '#161B22',
    border: '#262D36',
    primary: '#2DD4BF',
    primarySoft: '#134E4A',
    onPrimary: '#042F2E',
    income: '#4ADE80',
    incomeSoft: '#14532D',
    expense: '#F87171',
    expenseSoft: '#7F1D1D',
    chip: '#1F2630',
    danger: '#F87171',
    overlay: 'rgba(0,0,0,0.7)',
    inputBackground: '#0F141A',
  },
};

export type ThemeColor = keyof ThemeColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
});

/** Palette offered when creating custom categories. */
export const CategoryPalette = [
  '#0F766E',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#DC2626',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#0891B2',
  '#475569',
] as const;
