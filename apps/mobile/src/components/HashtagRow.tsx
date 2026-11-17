import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = { tags: string[] };

export default function HashtagRow({ tags }: Props) {
  if (!tags.length) return null;
  return (
    <View style={styles.container}>
      {tags.map((tag) => (
        <Text key={tag} style={styles.tag}>
          #{tag}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    fontSize: 12,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
