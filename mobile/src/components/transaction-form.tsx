import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PhotoStrip, type PhotoItem } from '@/components/photo-strip';
import { AppText, Button, Chip, Field, Segmented, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { listCategories } from '@/data/categories';
import { listRecentCounterparties } from '@/data/transactions';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/i18n';
import { createEntry, updateEntry } from '@/services/entries';
import { absoluteUri, discardPendingAttachments, deleteFile, folderLabel, importImage } from '@/services/receipt-files';
import { useStrings } from '@/state/settings';
import {
  PAYMENT_METHODS,
  type Attachment,
  type Kind,
  type PaymentMethod,
  type PendingAttachment,
  type TransactionInput,
  type TransactionListItem,
} from '@/types';
import { formatDate, fromISODate, monthKeyOf, todayISO, toISODate } from '@/utils/dates';
import { centsToInput, parseAmountToCents } from '@/utils/money';

interface Props {
  mode: 'create' | 'edit';
  initialKind?: Kind;
  initial?: TransactionListItem;
  existingAttachments?: Attachment[];
  /** Open the camera as soon as the form appears (the "Snap receipt" flow). */
  autoCapture?: boolean;
}

function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export function TransactionForm({ mode, initialKind = 'expense', initial, existingAttachments = [], autoCapture }: Props) {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { t, locale, currency } = useStrings();

  const [kind, setKind] = useState<Kind>(initial?.kind ?? initialKind);
  const [amountText, setAmountText] = useState(initial ? centsToInput(initial.amountCents) : '');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [date, setDate] = useState(initial?.occurredOn ?? todayISO());
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initial?.paymentMethod ?? null);
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? '');
  const [vatText, setVatText] = useState(centsToInput(initial?.vatCents));
  const [showInvoice, setShowInvoice] = useState(Boolean(initial?.invoiceNumber) || initial?.vatCents != null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showIosPicker, setShowIosPicker] = useState(false);

  const categories = useQuery((d) => listCategories(d, { kind, includeArchived: true }), [kind]);
  const recent = useQuery((d) => listRecentCounterparties(d, kind), [kind]);

  const visibleCategories = (categories.data ?? []).filter((c) => !c.isArchived || c.id === categoryId);

  /** Switching between expense and income clears the category, since categories belong to one kind. */
  function changeKind(value: Kind) {
    if (value === kind) return;
    setKind(value);
    setCategoryId(null);
  }

  const autoCaptured = useRef(false);
  useEffect(() => {
    if (autoCapture && !autoCaptured.current) {
      autoCaptured.current = true;
      void takePhoto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture]);

  async function addAssets(assets: ImagePicker.ImagePickerAsset[]) {
    setPhotoBusy(true);
    try {
      const imported: PendingAttachment[] = [];
      for (const asset of assets) {
        imported.push(await importImage(asset.uri, asset.width, asset.height));
      }
      setPending((prev) => [...prev, ...imported]);
    } catch (error) {
      Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.tx.cameraDenied);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) await addAssets(result.assets);
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.tx.libraryDenied);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });
    if (!result.canceled) await addAssets(result.assets);
  }

  const photos: PhotoItem[] = [
    ...existingAttachments
      .filter((a) => !removedIds.includes(a.id))
      .map((a) => ({ key: `existing:${a.id}`, uri: absoluteUri(a.relativePath) })),
    ...pending.map((p) => ({ key: `pending:${p.id}`, uri: absoluteUri(p.relativePath) })),
  ];

  function removePhoto(key: string) {
    Alert.alert(t.tx.removePhoto, undefined, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () => {
          const [type, id] = key.split(':');
          if (type === 'pending') {
            const item = pending.find((p) => p.id === id);
            if (item) deleteFile(item.relativePath);
            setPending((prev) => prev.filter((p) => p.id !== id));
          } else {
            setRemovedIds((prev) => [...prev, id]);
          }
        },
      },
    ]);
  }

  function openDatePicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromISODate(date),
        mode: 'date',
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === 'set' && selected) setDate(toISODate(selected));
        },
      });
    } else {
      setShowIosPicker((value) => !value);
    }
  }

  const isDirty =
    pending.length > 0 ||
    removedIds.length > 0 ||
    (mode === 'create'
      ? amountText.trim() !== '' || counterparty.trim() !== '' || note.trim() !== ''
      : amountText !== centsToInput(initial?.amountCents) ||
        kind !== initial?.kind ||
        date !== initial?.occurredOn ||
        categoryId !== (initial?.categoryId ?? null) ||
        counterparty !== (initial?.counterparty ?? '') ||
        note !== (initial?.note ?? '') ||
        paymentMethod !== (initial?.paymentMethod ?? null) ||
        invoiceNumber !== (initial?.invoiceNumber ?? '') ||
        vatText !== centsToInput(initial?.vatCents));

  function cancel() {
    if (!isDirty) {
      router.back();
      return;
    }
    Alert.alert(t.tx.discardTitle, t.tx.discardMessage, [
      { text: t.common.keepEditing, style: 'cancel' },
      {
        text: t.common.discard,
        style: 'destructive',
        onPress: () => {
          discardPendingAttachments(pending);
          router.back();
        },
      },
    ]);
  }

  async function save() {
    if (!amountText.trim()) {
      setAmountError(t.tx.amountRequired);
      return;
    }
    const amountCents = parseAmountToCents(amountText);
    if (amountCents == null || amountCents === 0) {
      setAmountError(t.tx.amountInvalid);
      return;
    }
    let vatCents: number | null = null;
    if (vatText.trim()) {
      vatCents = parseAmountToCents(vatText);
      if (vatCents == null) {
        Alert.alert(t.tx.vat, t.tx.amountInvalid);
        return;
      }
    }
    setAmountError(null);

    const input: TransactionInput = {
      kind,
      amountCents,
      currency: initial?.currency ?? currency,
      occurredOn: date,
      categoryId,
      counterparty: counterparty.trim() || null,
      note: note.trim() || null,
      paymentMethod,
      vatCents,
      invoiceNumber: invoiceNumber.trim() || null,
    };

    setSaving(true);
    try {
      if (mode === 'create') {
        await createEntry(db, input, pending);
      } else if (initial) {
        await updateEntry(db, initial.id, input, pending, removedIds);
      }
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
    }
  }

  const title = mode === 'edit' ? t.tx.edit : kind === 'income' ? t.tx.newIncome : t.tx.newExpense;
  const accent = kind === 'income' ? theme.income : theme.expense;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => <Button title={t.common.cancel} variant="ghost" onPress={cancel} />,
          headerRight: () => <Button title={t.common.save} variant="ghost" onPress={save} loading={saving} />,
        }}
      />
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Segmented<Kind>
            value={kind}
            onChange={changeKind}
            options={[
              { value: 'expense', label: t.kind.expense, color: theme.expense },
              { value: 'income', label: t.kind.income, color: theme.income },
            ]}
          />

          <Field label={t.tx.amount} hint={amountError ?? undefined}>
            <View
              style={[
                styles.amountBox,
                { backgroundColor: theme.inputBackground, borderColor: amountError ? theme.danger : theme.border },
              ]}>
              <AppText variant="heading" color={accent}>
                {currencySymbol(initial?.currency ?? currency, locale)}
              </AppText>
              <TextInput
                value={amountText}
                onChangeText={(value) => {
                  setAmountText(value);
                  if (amountError) setAmountError(null);
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                style={[styles.amountInput, { color: theme.text }]}
                autoFocus={mode === 'create' && !autoCapture}
                returnKeyType="done"
              />
            </View>
          </Field>

          <Field label={t.tx.photos}>
            <PhotoStrip
              photos={photos}
              busy={photoBusy}
              onTakePhoto={takePhoto}
              onPickPhoto={pickPhoto}
              onRemove={removePhoto}
            />
          </Field>

          <Field label={t.tx.date}>
            <Pressable
              accessibilityRole="button"
              onPress={openDatePicker}
              style={[styles.dateRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
              <Ionicons name="calendar" size={18} color={theme.primary} />
              <AppText style={styles.flex}>{formatDate(date, locale)}</AppText>
              {date !== todayISO() ? (
                <Pressable onPress={() => setDate(todayISO())} hitSlop={8}>
                  <AppText variant="caption" color={theme.primary}>
                    {t.common.today}
                  </AppText>
                </Pressable>
              ) : null}
            </Pressable>
            {Platform.OS === 'ios' && showIosPicker ? (
              <DateTimePicker
                value={fromISODate(date)}
                mode="date"
                display="inline"
                onChange={(_event, selected) => {
                  if (selected) setDate(toISODate(selected));
                }}
              />
            ) : null}
            <AppText variant="caption">
              {t.tx.folder}: {folderLabel(monthKeyOf(date))}
            </AppText>
          </Field>

          <Field label={t.tx.category}>
            <View style={styles.wrap}>
              {visibleCategories.map((category) => (
                <Chip
                  key={category.id}
                  label={categoryDisplayName(category, t)}
                  icon={category.icon as never}
                  color={category.color}
                  selected={category.id === categoryId}
                  onPress={() => setCategoryId(category.id === categoryId ? null : category.id)}
                />
              ))}
            </View>
          </Field>

          <Field label={kind === 'income' ? t.tx.counterpartyIncome : t.tx.counterpartyExpense}>
            <TextField
              value={counterparty}
              onChangeText={setCounterparty}
              placeholder={kind === 'income' ? t.tx.counterpartyPlaceholderIncome : t.tx.counterpartyPlaceholderExpense}
              autoCapitalize="words"
            />
            {recent.data && recent.data.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
                {recent.data
                  .filter((name) => name !== counterparty)
                  .map((name) => (
                    <Chip key={name} label={name} onPress={() => setCounterparty(name)} />
                  ))}
              </ScrollView>
            ) : null}
          </Field>

          <Field label={t.tx.paymentMethod}>
            <View style={styles.wrap}>
              {PAYMENT_METHODS.map((method) => (
                <Chip
                  key={method}
                  label={t.tx.payment[method]}
                  selected={paymentMethod === method}
                  onPress={() => setPaymentMethod(paymentMethod === method ? null : method)}
                />
              ))}
            </View>
          </Field>

          <Field label={t.tx.note}>
            <TextField
              value={note}
              onChangeText={setNote}
              placeholder={t.tx.notePlaceholder}
              multiline
              style={styles.noteInput}
            />
          </Field>

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowInvoice((value) => !value)}
            style={styles.disclosure}>
            <AppText variant="label">{t.tx.invoiceDetails}</AppText>
            <Ionicons name={showInvoice ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
          </Pressable>
          {showInvoice ? (
            <View style={styles.invoiceFields}>
              <Field label={t.tx.invoiceNumber}>
                <TextField value={invoiceNumber} onChangeText={setInvoiceNumber} autoCapitalize="characters" />
              </Field>
              <Field label={t.tx.vat}>
                <TextField value={vatText} onChangeText={setVatText} keyboardType="decimal-pad" placeholder="0.00" />
              </Field>
            </View>
          ) : null}

          <Button title={t.common.save} size="lg" onPress={save} loading={saving} style={styles.saveButton} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
  },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '700', paddingVertical: 12 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  suggestions: { gap: Spacing.sm, paddingVertical: 2 },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  disclosure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  invoiceFields: { gap: Spacing.lg, marginTop: -Spacing.sm },
  saveButton: { marginTop: Spacing.sm },
});
