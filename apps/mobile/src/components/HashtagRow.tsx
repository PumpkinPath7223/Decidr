import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

type Props = { tags: string[] };

export default function HashtagRow({ tags }: Props) {
  if (!tags.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.container}>
      {tags.map((tag) => (
        <Text key={tag} style={styles.tag}>#{tag}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: 10 },
  container: { gap: 6, paddingRight: 4 },
  tag: {
    fontSize: 12,
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
