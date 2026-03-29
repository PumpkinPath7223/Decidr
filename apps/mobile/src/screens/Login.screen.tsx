import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';
import { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await authApi.login(email.trim(), password)
          : await authApi.register(email.trim(), password, username.trim());

      await setAuth(result.token, result.user);
      navigation.replace('Feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>decidr</Text>
          <Text style={styles.tagline}>What's the verdict?</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{mode === 'login' ? 'Sign in' : 'Register'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setError(null); setMode(mode === 'login' ? 'register' : 'login'); }}>
            <Text style={styles.switchText}>
              {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  wordmark: { fontSize: 36, fontWeight: '800', color: '#111827', letterSpacing: -1 },
  tagline: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  form: { backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  error: { fontSize: 13, color: '#EF4444' },
  button: { backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  switchText: { textAlign: 'center', fontSize: 13, color: '#6366F1', marginTop: 4 },
});
