import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = { title: string; hint: string; value: boolean; onChange: (value: boolean) => void; activeColor?: string };

export default function SwitchRow({ title, hint, value, onChange, activeColor = colors.primary }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={{ true: activeColor }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
});
