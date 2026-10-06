import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

interface ScreenProps extends ViewProps {
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Screen({ scroll = false, edges = ['top'], contentStyle, style, children, ...rest }: ScreenProps) {
  const theme = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: theme.background }, style]} {...rest}>
      {content}
    </SafeAreaView>
  );
}

export function Card({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]} {...rest}>
      {children}
    </View>
  );
}

export function Row({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.row, style]} {...rest}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }, style]} />;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={styles.sectionHeader}>
      <AppText variant="label">{title}</AppText>
      {action}
    </Row>
  );
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

type TextVariant = 'title' | 'heading' | 'subheading' | 'body' | 'secondary' | 'caption' | 'label' | 'mono';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color, weight, align, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const base: TextStyle = (() => {
    switch (variant) {
      case 'title':
        return { fontSize: 28, lineHeight: 34, fontWeight: '700', color: theme.text };
      case 'heading':
        return { fontSize: 20, lineHeight: 26, fontWeight: '700', color: theme.text };
      case 'subheading':
        return { fontSize: 17, lineHeight: 22, fontWeight: '600', color: theme.text };
      case 'secondary':
        return { fontSize: 15, lineHeight: 20, color: theme.textSecondary };
      case 'caption':
        return { fontSize: 13, lineHeight: 18, color: theme.textMuted };
      case 'label':
        return {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        };
      case 'mono':
        return { fontSize: 14, lineHeight: 20, fontFamily: 'monospace', color: theme.textSecondary };
      default:
        return { fontSize: 16, lineHeight: 22, color: theme.text };
    }
  })();
  return (
    <Text
      style={[base, color ? { color } : null, weight ? { fontWeight: weight } : null, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Buttons & chips                                                     */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'income' | 'expense';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  icon?: IconName;
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, icon, variant = 'primary', loading, size = 'md', style, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const palette = (() => {
    switch (variant) {
      case 'secondary':
        return { bg: theme.chip, fg: theme.text, border: theme.border };
      case 'danger':
        return { bg: theme.expenseSoft, fg: theme.expense, border: theme.expenseSoft };
      case 'ghost':
        return { bg: 'transparent', fg: theme.primary, border: 'transparent' };
      case 'income':
        return { bg: theme.incomeSoft, fg: theme.income, border: theme.incomeSoft };
      case 'expense':
        return { bg: theme.expenseSoft, fg: theme.expense, border: theme.expenseSoft };
      default:
        return { bg: theme.primary, fg: theme.onPrimary, border: theme.primary };
    }
  })();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLarge,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: isDisabled ? 0.55 : pressed ? 0.8 : 1 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 22 : 18} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, size === 'lg' && styles.buttonTextLarge, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, size = 22, color, style, ...rest }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}
      {...rest}>
      <Ionicons name={icon} size={size} color={color ?? theme.text} />
    </Pressable>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected, onPress, icon, color, style }: ChipProps) {
  const theme = useTheme();
  const accent = color ?? theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? accent : theme.chip,
          borderColor: selected ? accent : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={16} color={selected ? '#fff' : accent} /> : null}
      <Text style={[styles.chipText, { color: selected ? '#fff' : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.chip, borderColor: theme.border }, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        const accent = option.color ?? theme.primary;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: accent }]}>
            <Text style={[styles.segmentText, { color: selected ? '#fff' : theme.textSecondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.fieldLabel}>
        {label}
      </AppText>
      {children}
      {hint ? (
        <AppText variant="caption" style={styles.fieldHint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function TextField({ style, ...rest }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      style={[
        styles.input,
        { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text },
        style,
      ]}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Lists & misc                                                        */
/* ------------------------------------------------------------------ */

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  right?: ReactNode;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
}

export function ListRow({ title, subtitle, icon, iconColor, right, value, onPress, chevron, destructive }: ListRowProps) {
  const theme = useTheme();
  const titleColor = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.6 : 1 }]}>
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: theme.chip }]}>
          <Ionicons name={icon} size={20} color={iconColor ?? (destructive ? theme.danger : theme.primary)} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <AppText color={titleColor}>{title}</AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {value ? <AppText variant="secondary">{value}</AppText> : null}
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.chip }]}>
        <Ionicons name={icon} size={36} color={theme.textMuted} />
      </View>
      <AppText variant="subheading" align="center">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="secondary" align="center" style={styles.emptyHint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

export function CategoryIcon({ icon, color, size = 40 }: { icon?: string | null; color?: string | null; size?: number }) {
  const theme = useTheme();
  const accent = color ?? theme.textMuted;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${accent}22`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={(icon as IconName) ?? 'ellipsis-horizontal-circle'} size={size * 0.5} color={accent} />
    </View>
  );
}

export function BusyOverlay({ visible, label }: { visible: boolean; label?: string }) {
  const theme = useTheme();
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: theme.overlay }]}>
      <View style={[styles.overlayBox, { backgroundColor: theme.card }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        {label ? (
          <AppText variant="secondary" style={styles.overlayLabel}>
            {label}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2, gap: Spacing.lg },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  sectionHeader: { justifyContent: 'space-between', marginBottom: Spacing.sm, marginTop: Spacing.xs },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 46,
  },
  buttonLarge: { paddingVertical: 16, minHeight: 56, borderRadius: Radius.lg },
  buttonText: { fontSize: 15, fontWeight: '600' },
  buttonTextLarge: { fontSize: 17 },
  iconButton: { padding: 6, borderRadius: Radius.pill },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  segmented: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: Radius.sm, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { marginLeft: 2 },
  fieldHint: { marginLeft: 2 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12 },
  listIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyHint: { maxWidth: 300 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  overlay: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  overlayBox: { padding: Spacing.xl, borderRadius: Radius.lg, alignItems: 'center', gap: Spacing.md, minWidth: 160 },
  overlayLabel: { textAlign: 'center' },
});
