import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { usersApi } from './api.service';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
// Expo Go on Android no longer supports remote push; a development build is required.
const isExpoGoAndroid =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const pushSupported = isNative && Device.isDevice && !isExpoGoAndroid;

if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function getProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/**
 * Asks for permission, gets this device's Expo push token and stores it on the server.
 * Push is a nice-to-have: every failure here is swallowed so it can never break sign-in.
 */
export async function registerForPush(): Promise<void> {
  if (!pushSupported) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reveals',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = getProjectId();
    if (!projectId) return; // Needs an EAS project id in app.json (extra.eas.projectId).

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await usersApi.setPushToken(pushToken);
  } catch {
    // ignore
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    await usersApi.clearPushToken();
  } catch {
    // ignore — the server also clears tokens Expo reports as dead
  }
}

function postIdFrom(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data as { postId?: unknown } | undefined;
  return typeof data?.postId === 'string' ? data.postId : null;
}

/** Calls `onOpen(postId)` when the user taps a reveal notification. Returns an unsubscribe. */
export function onNotificationOpened(onOpen: (postId: string) => void): () => void {
  if (!isNative) return () => {};

  // The app may have been launched by the tap.
  void (async () => {
    try {
      const postId = postIdFrom(await Notifications.getLastNotificationResponseAsync());
      if (postId) onOpen(postId);
    } catch {
      // ignore
    }
  })();

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const postId = postIdFrom(response);
    if (postId) onOpen(postId);
  });
  return () => subscription.remove();
}
