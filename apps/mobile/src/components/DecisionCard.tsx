import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useVote } from '../hooks/useVote';
import { type Post } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';
import { useVotesStore } from '../store/votes.store';
import CountdownBadge from './CountdownBadge';
import HashtagRow from './HashtagRow';
import OptionRow from './OptionRow';
import RevealForm from './RevealForm';
import VoteConfirmation from './VoteConfirmation';
import WeightedResultBar from './WeightedResultBar';

type Props = { post: Post; index: number };

export default function DecisionCard({ post, index }: Props) {
  const myChoice = useVotesStore((s) => s.votes[post.id] ?? null);
  const setVote = useVotesStore((s) => s.setVote);
  const clearVote = useVotesStore((s) => s.clearVote);

  const rank = useAuthStore((s) => s.user?.rank ?? 'Rookie');
  const isLoggedIn = useAuthStore((s) => !!s.token);

  const { mutate: castVote, isPending } = useVote(post.id);
  const [showRevealForm, setShowRevealForm] = useState(false);

  const locked = !!myChoice || isPending || post.revealed;

  function handleVote(choice: 'A' | 'B') {
    console.log('[handleVote]', { choice, locked, isLoggedIn, postId: post.id });
    if (locked) return;
    if (!isLoggedIn) {
      console.warn('[handleVote] no auth token — user must be logged in to vote');
      return;
    }
    setVote(post.id, choice); // optimistic — survives re-renders
    castVote(choice, {
      onError: (err) => {
        console.error('[handleVote] castVote failed:', err);
        clearVote(post.id); // revert on failure
      },
    });
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()} style={styles.card} pointerEvents="box-none">
      {/* Header */}
      <View style={styles.header}>
        <CountdownBadge isLiveCrisis={post.is_live_crisis} revealed={post.revealed} />
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={4}>{post.title}</Text>

      {/* Hashtags */}
      <HashtagRow tags={post.category_tags} />

      {/* Options */}
      <View style={styles.options}>
        {(['A', 'B'] as const).map((label) => (
          <OptionRow
            key={label}
            label={label}
            text={label === 'A' ? post.option_a : post.option_b}
            selected={myChoice === label}
            dimmed={!!myChoice && myChoice !== label}
            locked={locked}
            onPress={() => handleVote(label)}
          />
        ))}
      </View>

      {/* Live vote spread — always visible */}
      <WeightedResultBar
        votesA={post.votes_a}
        votesB={post.votes_b}
        total={post.total_votes}
        myChoice={myChoice}
      />

      {/* Post-vote confirmation */}
      {myChoice && <VoteConfirmation rank={rank} revealed={post.revealed} />}

      {/* Owner reveal CTA */}
      {post.is_owner && !post.revealed && (
        showRevealForm
          ? <RevealForm postId={post.id} onSuccess={() => setShowRevealForm(false)} />
          : (
            <TouchableOpacity style={styles.revealCta} onPress={() => setShowRevealForm(true)} activeOpacity={0.8}>
              <Text style={styles.revealCtaText}>Submit Outcome</Text>
            </TouchableOpacity>
          )
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', lineHeight: 24 },
  options: { marginTop: 4 },
  revealCta: { marginTop: 14, backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  revealCtaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
