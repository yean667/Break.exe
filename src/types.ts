export type BreakReason =
  | 'water'
  | 'food'
  | 'phone'
  | 'bathroom'
  | 'brain'
  | 'grass'
  | 'existing'
  | 'other';

export interface ReasonConfig {
  id: BreakReason;
  label: string;
  icon: string;
  defaultHumorNote: string;
}

export interface BreakRecord {
  id: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  reason: BreakReason;
  note: string;
  dateKey: string; // YYYY-MM-DD
}

export type CharacterModel = 'blob' | 'slime' | 'bunny' | 'bear' | 'cloud';

export type CharacterAccessory = 'headphones' | 'bow' | 'sprout' | 'star';

export interface CharacterConfig {
  model: CharacterModel;
  name: string;
  bodyColor: string;
  headphoneColor: string;
  accessory: CharacterAccessory;
  blushColor: string;
}

export interface ActiveBreak {
  startTime: number;
  reason: BreakReason;
  note: string;
  targetMinutes: number; // 0 for open-ended, or 5, 10, 15, 25
  notifiedAboutToEnd?: boolean;
}

export interface TodayStats {
  totalSeconds: number;
  count: number;
  longestSeconds: number;
  averageSeconds: number;
}

