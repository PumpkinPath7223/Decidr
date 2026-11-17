import { type Rank } from './types';

export const colors = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  track: '#F3F4F6',
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  optionA: '#3B82F6',
  optionALight: '#EFF6FF',
  optionB: '#8B5CF6',
  optionBLight: '#F5F3FF',
  success: '#10B981',
  successLight: '#ECFDF5',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
} as const;

export const rankColors: Record<Rank, { bg: string; text: string }> = {
  Rookie: { bg: '#F3F4F6', text: '#6B7280' },
  Analyst: { bg: '#DBEAFE', text: '#2563EB' },
  Strategist: { bg: '#EDE9FE', text: '#7C3AED' },
  Oracle: { bg: '#FEF3C7', text: '#D97706' },
};

export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
} as const;
