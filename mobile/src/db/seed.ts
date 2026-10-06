import type { Kind } from '@/types';

export interface SeedCategory {
  id: string;
  name: string;
  kind: Kind;
  icon: string;
  color: string;
}

/**
 * Default categories. Ids are stable strings (not random UUIDs) so backups restored on another
 * phone, and a future server sync, refer to the same categories.
 */
export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { id: 'sys:fuel', name: 'fuel', kind: 'expense', icon: 'flame', color: '#EA580C' },
  { id: 'sys:vehicle_maintenance', name: 'vehicle_maintenance', kind: 'expense', icon: 'construct', color: '#475569' },
  { id: 'sys:vehicle_rent', name: 'vehicle_rent', kind: 'expense', icon: 'car', color: '#2563EB' },
  { id: 'sys:insurance', name: 'insurance', kind: 'expense', icon: 'shield-checkmark', color: '#0891B2' },
  { id: 'sys:parking_tolls', name: 'parking_tolls', kind: 'expense', icon: 'pricetag', color: '#7C3AED' },
  { id: 'sys:phone_internet', name: 'phone_internet', kind: 'expense', icon: 'phone-portrait', color: '#DB2777' },
  { id: 'sys:equipment', name: 'equipment', kind: 'expense', icon: 'bag-handle', color: '#CA8A04' },
  { id: 'sys:meals', name: 'meals', kind: 'expense', icon: 'fast-food', color: '#16A34A' },
  { id: 'sys:taxes_fees', name: 'taxes_fees', kind: 'expense', icon: 'document-text', color: '#DC2626' },
  { id: 'sys:accounting', name: 'accounting', kind: 'expense', icon: 'calculator', color: '#0F766E' },
  { id: 'sys:other_expense', name: 'other_expense', kind: 'expense', icon: 'ellipsis-horizontal-circle', color: '#6B7280' },
  { id: 'sys:delivery_earnings', name: 'delivery_earnings', kind: 'income', icon: 'bicycle', color: '#0F766E' },
  { id: 'sys:tips', name: 'tips', kind: 'income', icon: 'heart', color: '#DB2777' },
  { id: 'sys:bonus', name: 'bonus', kind: 'income', icon: 'gift', color: '#CA8A04' },
  { id: 'sys:other_income', name: 'other_income', kind: 'income', icon: 'cash', color: '#16A34A' },
];

/** Ionicons names offered when creating a custom category. */
export const CATEGORY_ICONS = [
  'flame',
  'construct',
  'car',
  'bicycle',
  'shield-checkmark',
  'pricetag',
  'phone-portrait',
  'bag-handle',
  'fast-food',
  'document-text',
  'calculator',
  'cash',
  'card',
  'heart',
  'gift',
  'home',
  'medkit',
  'shirt',
  'cart',
  'wifi',
  'build',
  'water',
  'battery-charging',
  'briefcase',
  'school',
  'airplane',
  'train',
  'bus',
  'cafe',
  'ellipsis-horizontal-circle',
] as const;
