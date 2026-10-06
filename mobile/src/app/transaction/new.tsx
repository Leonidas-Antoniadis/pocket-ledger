import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/components/transaction-form';

export default function NewTransactionScreen() {
  const { kind, capture } = useLocalSearchParams<{ kind?: string; capture?: string }>();
  return (
    <TransactionForm
      mode="create"
      initialKind={kind === 'income' ? 'income' : 'expense'}
      autoCapture={capture === '1'}
    />
  );
}
