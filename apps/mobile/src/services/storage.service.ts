import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Session tokens live in the device keychain / keystore. SecureStore has no web
// implementation, so the web build falls back to AsyncStorage (localStorage).
const useSecureStore = Platform.OS === 'ios' || Platform.OS === 'android';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    return useSecureStore ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (useSecureStore) await SecureStore.setItemAsync(key, value);
    else await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (useSecureStore) await SecureStore.deleteItemAsync(key);
    else await AsyncStorage.removeItem(key);
  },
};
