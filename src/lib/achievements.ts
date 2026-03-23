export type AchievementKey =
  | 'exercise_sessions_500'
  | 'exercise_sessions_2000'
  | 'exercise_sessions_5000'
  | 'exercise_sessions_10000'
  | 'first_period_completed'
  | 'weight_logged_10'
  | 'streak_5'

export type AchievementDef = {
  key: AchievementKey
  title: string
  /** Called with metadata to produce a contextual description */
  description: (meta: Record<string, string>) => string
  /** lucide icon name */
  icon: string
}

export const ACHIEVEMENT_DEFS: Record<AchievementKey, AchievementDef> = {
  exercise_sessions_500: {
    key: 'exercise_sessions_500',
    title: 'Dedicado',
    description: (m) => `500 séries completadas com ${m.class_name ?? 'um exercício'}`,
    icon: 'Medal',
  },
  exercise_sessions_2000: {
    key: 'exercise_sessions_2000',
    title: 'Consistente',
    description: (m) => `2.000 séries completadas com ${m.class_name ?? 'um exercício'}`,
    icon: 'Star',
  },
  exercise_sessions_5000: {
    key: 'exercise_sessions_5000',
    title: 'Centurião',
    description: (m) => `5.000 séries completadas com ${m.class_name ?? 'um exercício'}`,
    icon: 'Trophy',
  },
  exercise_sessions_10000: {
    key: 'exercise_sessions_10000',
    title: 'Lendário',
    description: (m) => `10.000 séries completadas com ${m.class_name ?? 'um exercício'}`,
    icon: 'Crown',
  },
  first_period_completed: {
    key: 'first_period_completed',
    title: 'Missão Cumprida',
    description: () => 'Completou o primeiro período de treino',
    icon: 'Target',
  },
  weight_logged_10: {
    key: 'weight_logged_10',
    title: 'Levantando Peso',
    description: () => 'Registrou peso em 10 séries',
    icon: 'Dumbbell',
  },
  streak_5: {
    key: 'streak_5',
    title: '5 Dias Seguidos',
    description: () => 'Treinou por 5 dias consecutivos',
    icon: 'Flame',
  },
}

export const EXERCISE_TIERS: { key: AchievementKey; threshold: number }[] = [
  { key: 'exercise_sessions_500', threshold: 500 },
  { key: 'exercise_sessions_2000', threshold: 2000 },
  { key: 'exercise_sessions_5000', threshold: 5000 },
  { key: 'exercise_sessions_10000', threshold: 10000 },
]

export type UserAchievement = {
  id: string
  user_id: string
  achievement_key: AchievementKey
  achievement_id: string
  metadata: Record<string, string>
  earned_at: string
}
