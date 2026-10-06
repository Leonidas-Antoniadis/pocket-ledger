import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/components/transaction-form';
import { EmptyState, Loading } from '@/components/ui';
import { listAttachments } from '@/data/attachments';
import { getTransaction } from '@/data/transactions';
import { useQuery } from '@/hooks/use-query';
import { useStrings } from '@/state/settings';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useStrings();
  const tx = useQuery((db) => getTransaction(db, id), [id]);
  const attachments = useQuery((db) => listAttachments(db, id), [id]);

  if (tx.loading || attachments.loading) return <Loading />;
  if (!tx.data) return <EmptyState icon="alert-circle-outline" title={t.tx.deleted} />;

  return <TransactionForm mode="edit" initial={tx.data} existingAttachments={attachments.data ?? []} />;
}
