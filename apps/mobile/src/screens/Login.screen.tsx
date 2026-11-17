import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import { authApi, errorMessage } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';
import { cardShadow, colors } from '../theme';

type Mode = 'login' | 'register';

function validate(mode: Mode, email: string, password: string, username: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address';
  if (mode === 'register') {
    if (!/^\w{3,20}$/.test(username)) return 'Username must be 3–20 letters, numbers or underscores';
    if (password.length < 8) return 'Password must be at least 8 characters';
  } else if (!password) {
    return 'Enter your password';
  }
  return null;
}

export default function LoginScreen() {
  const setSession = useAuthStore((s) => s.setSession);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();
    const problem = validate(mode, cleanEmail, password, cleanUsername);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const session =
        mode === 'login'
          ? await authApi.login(cleanEmail, password)
          : await authApi.register(cleanEmail, password, cleanUsername);
      // Setting the session swaps the navigator to the signed-in stack.
      await setSession(session);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  function switchMode() {
    setError(null);
    setMode(mode === 'login' ? 'register' : 'login');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
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
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                textContentType="username"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              maxLength={72}
              textContentType={mode === 'register' ? 'newPassword' : 'password'}
              onSubmitEditing={handleSubmit}
            />

            {mode === 'register' && (
              <Text style={styles.note}>Your posts are always anonymous. Your username only appears on comments and the leaderboard.</Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}

            <Button label={mode === 'login' ? 'Sign in' : 'Create account'} onPress={handleSubmit} loading={loading} />

            <TouchableOpacity accessibilityRole="button" onPress={switchMode} disabled={loading}>
              <Text style={styles.switchText}>
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  wordmark: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  form: { backgroundColor: colors.card, borderRadius: 20, padding: 24, gap: 12, ...cardShadow },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text, backgroundColor: colors.bg },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  error: { fontSize: 13, color: colors.danger },
  switchText: { textAlign: 'center', fontSize: 13, color: colors.primary, marginTop: 4 },
});
