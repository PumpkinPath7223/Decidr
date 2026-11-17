import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useClearBlocks } from '../hooks/useSafety';
import { errorMessage, usersApi } from '../services/api.service';
import { unregisterPush } from '../services/notifications.service';
import { useAuthStore } from '../store/auth.store';
import { colors } from '../theme';
import Button from './Button';
import ConfirmModal from './ConfirmModal';

type Pending = 'unblock' | 'delete' | null;

/** Sign out, unblock everyone, delete account. */
export default function AccountActions() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearBlocks = useClearBlocks();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [message, setMessage] = useState<string | null>(null);

  const signOut = useMutation({
    mutationFn: async () => {
      // Stop reveal notifications for this device before the token is thrown away.
      await unregisterPush();
      await clearAuth();
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      await usersApi.deleteAccount();
      await clearAuth();
    },
  });

  function confirmUnblock() {
    clearBlocks.mutate(undefined, {
      onSuccess: () => {
        setConfirming(null);
        setMessage('Everyone you blocked has been unblocked.');
      },
    });
  }

  function close() {
    clearBlocks.reset();
    deleteAccount.reset();
    setConfirming(null);
  }

  return (
    <View style={styles.container}>
      {message && <Text style={styles.message}>{message}</Text>}
      <Button label="Sign out" variant="secondary" onPress={() => signOut.mutate()} loading={signOut.isPending} />
      <Button label="Unblock everyone" variant="ghost" onPress={() => setConfirming('unblock')} />
      <Button label="Delete my account" variant="ghost" onPress={() => setConfirming('delete')} />

      <ConfirmModal
        visible={confirming === 'unblock'}
        title="Unblock everyone?"
        message="Posts and comments from people you blocked will show up again. Because posts are anonymous, blocks can only be cleared all at once."
        confirmLabel="Unblock"
        loading={clearBlocks.isPending}
        error={clearBlocks.isError ? errorMessage(clearBlocks.error) : null}
        onConfirm={confirmUnblock}
        onCancel={close}
      />
      <ConfirmModal
        visible={confirming === 'delete'}
        title="Delete your account?"
        message="This permanently deletes your account, your posts, your votes and your comments. It can't be undone."
        confirmLabel="Delete account"
        destructive
        loading={deleteAccount.isPending}
        error={deleteAccount.isError ? errorMessage(deleteAccount.error) : null}
        onConfirm={() => deleteAccount.mutate()}
        onCancel={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginTop: 20, gap: 6 },
  message: { fontSize: 13, color: colors.success, textAlign: 'center', marginBottom: 4 },
});
