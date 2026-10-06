import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, CategoryIcon } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/i18n';
import { absoluteUri } from '@/services/receipt-files';
import { useStrings } from '@/state/settings';
import type { TransactionListItem } from '@/types';
import { formatSignedMoney } from '@/utils/money';

interface Props {
  item: TransactionListItem;
  onPress: () => void;
  showDate?: boolean;
}

export function TransactionRow({ item, onPress, showDate }: Props) {
  const theme = useTheme();
  const { t, locale } = useStrings();
  const categoryName = categoryDisplayName(
    item.categoryName ? { name: item.categoryName, isSystem: item.categoryIsSystem } : null,
    t,
  );
  const title = item.counterparty || categoryName;
  const subtitleParts = [item.counterparty ? categoryName : null, item.note, showDate ? item.occurredOn : null].filter(
    Boolean,
  );
  const amountColor = item.kind === 'income' ? theme.income : theme.expense;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {item.firstAttachmentPath ? (
        <View style={styles.thumbWrap}>
          <Image
            source={{ uri: absoluteUri(item.firstAttachmentPath) }}
            style={[styles.thumb, { backgroundColor: theme.chip }]}
            contentFit="cover"
            transition={150}
          />
          {item.attachmentCount > 1 ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <AppText variant="caption" color={theme.onPrimary} weight="700" style={styles.badgeText}>
                {item.attachmentCount}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : (
        <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} size={44} />
      )}
      <View style={styles.text}>
        <AppText numberOfLines={1} weight="600">
          {title}
        </AppText>
        {subtitleParts.length > 0 ? (
          <AppText variant="caption" numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </AppText>
        ) : null}
      </View>
      <View style={styles.amountWrap}>
        <AppText weight="700" color={amountColor}>
          {formatSignedMoney(item.amountCents, item.kind, item.currency, locale)}
        </AppText>
        {item.firstAttachmentPath && item.categoryIcon ? (
          <Ionicons name="receipt-outline" size={13} color={theme.textMuted} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  thumbWrap: { width: 44, height: 44 },
  thumb: { width: 44, height: 44, borderRadius: Radius.sm },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, lineHeight: 13 },
  text: { flex: 1, gap: 2 },
  amountWrap: { alignItems: 'flex-end', gap: 2 },
});
