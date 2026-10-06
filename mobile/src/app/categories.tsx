import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, CategoryIcon, Divider, Field, Loading, Screen, SectionHeader, TextField, type IconName } from '@/components/ui';
import { CategoryPalette, Radius, Spacing } from '@/constants/theme';
import {
  categoryUsageCount,
  createCategory,
  deleteCategory,
  listCategories,
  setCategoryArchived,
  updateCategory,
} from '@/data/categories';
import { CATEGORY_ICONS } from '@/db/seed';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { categoryDisplayName } from '@/i18n';
import { useStrings } from '@/state/settings';
import type { Category, Kind } from '@/types';

interface EditorState {
  kind: Kind;
  category: Category | null;
  name: string;
  icon: string;
  color: string;
  usage: number;
}

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t } = useStrings();
  const categories = useQuery((d) => listCategories(d, { includeArchived: true }), []);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew(kind: Kind) {
    setEditor({ kind, category: null, name: '', icon: CATEGORY_ICONS[0], color: CategoryPalette[0], usage: 0 });
  }

  async function openEdit(category: Category) {
    const usage = await categoryUsageCount(db, category.id);
    setEditor({
      kind: category.kind,
      category,
      name: categoryDisplayName(category, t),
      icon: category.icon,
      color: category.color,
      usage,
    });
  }

  async function saveEditor() {
    if (!editor) return;
    if (!editor.name.trim()) {
      Alert.alert(t.categories.nameRequired);
      return;
    }
    setSaving(true);
    try {
      if (editor.category) {
        await updateCategory(db, editor.category.id, { name: editor.name, icon: editor.icon, color: editor.color });
      } else {
        await createCategory(db, { name: editor.name, kind: editor.kind, icon: editor.icon, color: editor.color });
      }
      setEditor(null);
    } catch (error) {
      Alert.alert(t.common.error, error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchived() {
    if (!editor?.category) return;
    await setCategoryArchived(db, editor.category.id, !editor.category.isArchived);
    setEditor(null);
  }

  function confirmDelete() {
    if (!editor?.category) return;
    if (editor.usage > 0) {
      Alert.alert(t.categories.cannotDelete);
      return;
    }
    const id = editor.category.id;
    Alert.alert(t.common.delete, t.categories.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteCategory(db, id);
          if (!ok) Alert.alert(t.categories.cannotDelete);
          setEditor(null);
        },
      },
    ]);
  }

  function renderSection(kind: Kind, title: string) {
    const items = (categories.data ?? []).filter((c) => c.kind === kind);
    return (
      <View>
        <SectionHeader
          title={title}
          action={
            <Pressable onPress={() => openNew(kind)} hitSlop={8} accessibilityRole="button">
              <AppText color={theme.primary} weight="600">
                + {t.categories.add}
              </AppText>
            </Pressable>
          }
        />
        <Card style={styles.card}>
          {items.map((category, index) => (
            <View key={category.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => void openEdit(category)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }, category.isArchived && styles.dim]}>
                <CategoryIcon icon={category.icon} color={category.color} size={36} />
                <AppText style={styles.flex}>{categoryDisplayName(category, t)}</AppText>
                {category.isArchived ? <AppText variant="caption">{t.categories.hidden}</AppText> : null}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </Pressable>
            </View>
          ))}
        </Card>
      </View>
    );
  }

  return (
    <Screen edges={[]} scroll>
      {categories.loading ? <Loading /> : null}
      {renderSection('expense', t.categories.expense)}
      {renderSection('income', t.categories.income)}

      <Modal
        visible={editor !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditor(null)}>
        {editor ? (
          <View style={[styles.modal, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setEditor(null)} hitSlop={8} accessibilityRole="button">
                <AppText color={theme.primary}>{t.common.cancel}</AppText>
              </Pressable>
              <AppText variant="subheading">{editor.category ? t.categories.edit : t.categories.add}</AppText>
              <Pressable onPress={() => void saveEditor()} hitSlop={8} accessibilityRole="button" disabled={saving}>
                <AppText color={theme.primary} weight="700">
                  {t.common.save}
                </AppText>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.preview}>
                <CategoryIcon icon={editor.icon} color={editor.color} size={64} />
              </View>
              <Field label={t.categories.name}>
                <TextField
                  value={editor.name}
                  onChangeText={(name) => setEditor({ ...editor, name })}
                  autoFocus={!editor.category}
                  autoCapitalize="sentences"
                />
              </Field>
              <Field label={t.categories.color}>
                <View style={styles.wrap}>
                  {CategoryPalette.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => setEditor({ ...editor, color })}
                      accessibilityRole="button"
                      style={[styles.swatch, { backgroundColor: color }, editor.color === color && styles.swatchSelected]}>
                      {editor.color === color ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label={t.categories.icon}>
                <View style={styles.wrap}>
                  {CATEGORY_ICONS.map((icon) => (
                    <Pressable
                      key={icon}
                      onPress={() => setEditor({ ...editor, icon })}
                      accessibilityRole="button"
                      style={[
                        styles.iconCell,
                        { backgroundColor: editor.icon === icon ? editor.color : theme.chip },
                      ]}>
                      <Ionicons name={icon as IconName} size={22} color={editor.icon === icon ? '#fff' : theme.text} />
                    </Pressable>
                  ))}
                </View>
              </Field>
              {editor.category ? (
                <View style={styles.actions}>
                  <AppText variant="caption" align="center">
                    {t.categories.inUse(editor.usage)}
                  </AppText>
                  <Button
                    title={editor.category.isArchived ? t.categories.show : t.categories.hide}
                    icon={editor.category.isArchived ? 'eye-outline' : 'eye-off-outline'}
                    variant="secondary"
                    onPress={() => void toggleArchived()}
                  />
                  <Button title={t.common.delete} icon="trash-outline" variant="danger" onPress={confirmDelete} />
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  dim: { opacity: 0.5 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  modalContent: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxl * 2 },
  preview: { alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 3, borderColor: '#ffffff88' },
  iconCell: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
});
