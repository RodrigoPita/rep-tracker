'use server'

import { supabaseServer } from '@/lib/supabase-server'
import { ACHIEVEMENT_DEFS, EXERCISE_TIERS, type AchievementKey, type AchievementDef } from '@/lib/achievements'
import { computeMaxStreak } from '@/lib/utils'

type EarnedCandidate = {
  achievement_key: AchievementKey
  achievement_id: string
  metadata: Record<string, string>
}

export type UnlockedAchievement = AchievementDef & {
  metadata: Record<string, string>
}

export async function checkAndUnlockAchievements(): Promise<UnlockedAchievement[]> {
  const db = await supabaseServer()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return []

  // Already earned achievement_ids
  const { data: existing } = await db
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', user.id)
  const earnedIds = new Set((existing ?? []).map((a: { achievement_id: string }) => a.achievement_id))

  const candidates: EarnedCandidate[] = []

  // ── Exercise session milestones ──────────────────────────────────────────
  // Count distinct completed sessions per exercise class for this user.
  // workout_sets → routine_exercises → exercises → exercise_classes
  const { data: classSessions } = await db
    .from('workout_sets')
    .select(`
      session_id,
      routine_exercises!inner(
        exercises!inner(
          exercise_classes!inner(id, name)
        )
      )
    `)
    .eq('completed', true)
    .not('routine_exercise_id', 'is', null)

  if (classSessions) {
    // Aggregate: class_id → Set of session_ids
    const sessionsByClass = new Map<string, { name: string; sessions: Set<string> }>()

    for (const row of classSessions) {
      const re = row.routine_exercises as unknown as {
        exercises: { exercise_classes: { id: string; name: string } }
      }
      const cls = re?.exercises?.exercise_classes
      if (!cls) continue

      if (!sessionsByClass.has(cls.id)) {
        sessionsByClass.set(cls.id, { name: cls.name, sessions: new Set() })
      }
      sessionsByClass.get(cls.id)!.sessions.add(row.session_id)
    }

    for (const [classId, { name, sessions }] of sessionsByClass) {
      const count = sessions.size
      for (const { key, threshold } of EXERCISE_TIERS) {
        if (count >= threshold) {
          const achievementId = `${key}:${classId}`
          candidates.push({
            achievement_key: key,
            achievement_id: achievementId,
            metadata: { class_id: classId, class_name: name, count: String(count) },
          })
        }
      }
    }
  }

  // ── First routine period completed ───────────────────────────────────────
  const { data: periods } = await db
    .from('routine_periods')
    .select('id')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .limit(1)

  if (periods && periods.length > 0) {
    candidates.push({
      achievement_key: 'first_period_completed',
      achievement_id: 'first_period_completed',
      metadata: {},
    })
  }

  // ── Weight logged on 10 sets ─────────────────────────────────────────────
  const { count: weightCount } = await db
    .from('workout_sets')
    .select('id', { count: 'exact', head: true })
    .not('weight_kg', 'is', null)
    .eq('completed', true)

  if ((weightCount ?? 0) >= 10) {
    candidates.push({
      achievement_key: 'weight_logged_10',
      achievement_id: 'weight_logged_10',
      metadata: { count: String(weightCount) },
    })
  }

  // ── 5-day streak (best ever) ─────────────────────────────────────────────
  const { data: sessionDates } = await db
    .from('workout_sessions')
    .select('date')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('date', { ascending: true })

  if (sessionDates && sessionDates.length >= 5) {
    const uniqueDates = [...new Set(sessionDates.map((s: { date: string }) => s.date))]
    const maxStreak = computeMaxStreak(uniqueDates)
    if (maxStreak >= 5) {
      candidates.push({
        achievement_key: 'streak_5',
        achievement_id: 'streak_5',
        metadata: { max_streak: String(maxStreak) },
      })
    }
  }

  // ── Insert newly earned achievements ─────────────────────────────────────
  const newCandidates = candidates.filter((c) => !earnedIds.has(c.achievement_id))

  if (newCandidates.length > 0) {
    await db.from('user_achievements').insert(
      newCandidates.map((c) => ({
        user_id: user.id,
        achievement_key: c.achievement_key,
        achievement_id: c.achievement_id,
        metadata: c.metadata,
      }))
    )
  }

  return newCandidates.map((c) => ({
    ...ACHIEVEMENT_DEFS[c.achievement_key],
    metadata: c.metadata,
  }))
}
