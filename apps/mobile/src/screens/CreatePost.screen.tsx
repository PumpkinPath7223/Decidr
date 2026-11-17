import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Chip from '../components/Chip';
import Field from '../components/Field';
import SwitchRow from '../components/SwitchRow';
import { useCreatePost } from '../hooks/usePosts';
import { type RootStackParamList } from '../navigation/types';
import { ApiError, errorMessage } from '../services/api.service';
import { colors } from '../theme';
import { CATEGORIES, REVEAL_TIMERS, type Category, type RevealTimer } from '../types';

const MAX_TAGS = 3;

type Notice = { text: string; supportive: boolean };

export default function CreatePostScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mutate: createPost, isPending } = useCreatePost();

  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [tags, setTags] = useState<Category[]>([]);
  const [timer, setTimer] = useState<RevealTimer>('72h');
  const [liveCrisis, setLiveCrisis] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  function toggleTag(tag: Category) {
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  }

  function problem(): string | null {
    if (title.trim().length < 5) return 'Describe the decision in at least 5 characters';
    if (!optionA.trim() || !optionB.trim()) return 'Fill in both options';
    if (optionA.trim().toLowerCase() === optionB.trim().toLowerCase()) return 'The two options must be different';
    if (tags.length === 0) return 'Pick at least one category';
    return null;
  }

  function reset() {
    setTitle('');
    setContext('');
    setOptionA('');
    setOptionB('');
    setTags([]);
    setTimer('72h');
    setLiveCrisis(false);
    setCommentsEnabled(true);
  }

  function submit() {
    const issue = problem();
    if (issue) {
      setNotice({ text: issue, supportive: false });
      return;
    }
    setNotice(null);
    createPost(
      {
        title: title.trim(),
        context: context.trim() || undefined,
        option_a: optionA.trim(),
        option_b: optionB.trim(),
        category_tags: tags,
        reveal_in: liveCrisis ? undefined : timer,
        is_live_crisis: liveCrisis,
        comments_enabled: commentsEnabled,
      },
      {
        onSuccess: (post) => {
          reset();
          navigation.navigate('PostDetail', { postId: post.id });
        },
        onError: (err) =>
          setNotice({
            text: errorMessage(err),
            supportive: err instanceof ApiError && err.code === 'CRISIS_RESOURCES',
          }),
      }
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Ask the crowd</Text>
          <Text style={styles.sub}>Posted anonymously. Nobody sees who asked.</Text>

          <Field label="The decision" value={title} onChangeText={setTitle} maxLength={140} placeholder="Should I take the job in another city?" />
          <Field label="Context (optional)" value={context} onChangeText={setContext} maxLength={1000} tall placeholder="What should voters know?" />
          <Field label="Option A" value={optionA} onChangeText={setOptionA} maxLength={80} placeholder="Take it" />
          <Field label="Option B" value={optionB} onChangeText={setOptionB} maxLength={80} placeholder="Stay where I am" />

          <Text style={styles.label}>Category (up to {MAX_TAGS})</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((tag) => (
              <Chip
                key={tag}
                label={`#${tag}`}
                selected={tags.includes(tag)}
                disabled={!tags.includes(tag) && tags.length >= MAX_TAGS}
                onPress={() => toggleTag(tag)}
              />
            ))}
          </View>

          <SwitchRow
            title="⚡ Live Crisis"
            hint="Need an answer now: 2 hours of voting, and everyone sees the count live."
            value={liveCrisis}
            onChange={setLiveCrisis}
            activeColor={colors.danger}
          />

          {!liveCrisis && (
            <>
              <Text style={styles.label}>Voting closes in</Text>
              <View style={styles.chips}>
                {REVEAL_TIMERS.map((option) => (
                  <Chip key={option.value} label={option.label} selected={timer === option.value} onPress={() => setTimer(option.value)} />
                ))}
              </View>
              <Text style={styles.hint}>When it closes, you come back and tell everyone what you chose and how it went.</Text>
            </>
          )}

          <SwitchRow title="Allow comments" hint="Voters can explain their pick." value={commentsEnabled} onChange={setCommentsEnabled} />

          {notice && (
            <View style={[styles.notice, notice.supportive ? styles.supportive : styles.problem]}>
              <Text style={[styles.noticeText, !notice.supportive && { color: colors.danger }]}>{notice.text}</Text>
            </View>
          )}

          <Button label="Post anonymously" onPress={submit} loading={isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  heading: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: -8 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  notice: { borderRadius: 12, padding: 12 },
  problem: { backgroundColor: colors.dangerLight },
  supportive: { backgroundColor: colors.primaryLight },
  noticeText: { fontSize: 14, lineHeight: 20, color: colors.text },
});
