import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { CATEGORIES, type Category } from '../types';
import Chip from './Chip';

type Props = { value: Category | null; onChange: (tag: Category | null) => void };

export default function TagFilter({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      <Chip label="All" selected={value === null} onPress={() => onChange(null)} />
      {CATEGORIES.map((tag) => (
        <Chip key={tag} label={`#${tag}`} selected={value === tag} onPress={() => onChange(value === tag ? null : tag)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Without flexShrink: 0 the list below squeezes this row and clips the chips.
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: 16, gap: 8, paddingVertical: 8, alignItems: 'center' },
});
