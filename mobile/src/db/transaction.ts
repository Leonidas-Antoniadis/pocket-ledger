import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * Runs `task` inside a database transaction.
 *
 * On phones we use `withExclusiveTransactionAsync`, which opens a dedicated connection so that reads issued by
 * screens while the transaction runs cannot interleave with it. The web build of expo-sqlite serves one connection
 * from a worker, so there we fall back to a plain transaction on the same connection.
 */
export async function runInTransaction(
  db: SQLiteDatabase,
  task: (txn: SQLiteDatabase) => Promise<void>,
): Promise<void> {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => task(db));
    return;
  }
  await db.withExclusiveTransactionAsync((txn) => task(txn));
}
