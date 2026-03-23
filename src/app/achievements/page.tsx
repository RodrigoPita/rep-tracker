import { supabaseServer } from '@/lib/supabase-server'
import { ACHIEVEMENT_DEFS, EXERCISE_TIERS, type AchievementKey, type UserAchievement } from '@/lib/achievements'
import { Card, CardContent } from '@/components/ui/card'
import { Medal, Star, Trophy, Crown, Target, Dumbbell, Flame, Lock, type LucideProps } from 'lucide-react'

type IconComponent = React.FC<LucideProps>
const ICON_MAP: Record<string, IconComponent> = {
  Medal, Star, Trophy, Crown, Target, Dumbbell, Flame,
}

const GLOBAL_KEYS: AchievementKey[] = ['streak_5', 'first_period_completed', 'weight_logged_10']

export default async function AchievementsPage() {
  const db = await supabaseServer()

  const [{ data: achievementsData }, { data: classSessions }, { data: allClasses }] = await Promise.all([
    db.from('user_achievements').select('*').order('earned_at', { ascending: false }),
    db
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
      .not('routine_exercise_id', 'is', null),
    db.from('exercise_classes').select('id, name').order('name'),
  ])

  const achievements = (achievementsData ?? []) as UserAchievement[]
  const earnedById = new Map(achievements.map((a) => [a.achievement_id, a]))

  // Compute distinct set count per exercise class
  const sessionSets = new Map<string, Set<string>>()
  for (const row of classSessions ?? []) {
    const re = row.routine_exercises as unknown as {
      exercises: { exercise_classes: { id: string; name: string } }
    }
    const cls = re?.exercises?.exercise_classes
    if (!cls) continue
    if (!sessionSets.has(cls.id)) sessionSets.set(cls.id, new Set())
    sessionSets.get(cls.id)!.add(row.session_id)
  }

  // Build locked exercise milestone rows: all classes × all tiers not yet earned
  const lockedExerciseRows: { classId: string; className: string; key: AchievementKey; threshold: number; current: number }[] = []
  for (const cls of allClasses ?? []) {
    const current = sessionSets.get(cls.id)?.size ?? 0
    for (const { key, threshold } of EXERCISE_TIERS) {
      const achievementId = `${key}:${cls.id}`
      if (!earnedById.has(achievementId)) {
        lockedExerciseRows.push({ classId: cls.id, className: cls.name, key, threshold, current })
      }
    }
  }

  const lockedGlobal = GLOBAL_KEYS.filter((key) => !earnedById.has(key))
  const totalEarned = achievements.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conquistas</h1>
        <p className="text-sm text-muted-foreground mt-1">{totalEarned} desbloqueada{totalEarned !== 1 ? 's' : ''}</p>
      </div>

      {/* Earned */}
      {achievements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Desbloqueadas</h2>
          <div className="grid grid-cols-1 gap-2">
            {achievements.map((a) => {
              const def = ACHIEVEMENT_DEFS[a.achievement_key]
              if (!def) return null
              const Icon = ICON_MAP[def.icon] ?? Medal
              const dateStr = new Date(a.earned_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              return (
                <Card key={a.id} className="border-primary/20">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{def.title}</p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">{def.description(a.metadata)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Locked global */}
      {lockedGlobal.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Bloqueadas</h2>
          <div className="grid grid-cols-1 gap-2">
            {lockedGlobal.map((key) => {
              const def = ACHIEVEMENT_DEFS[key]
              const Icon = ICON_MAP[def.icon] ?? Medal
              return (
                <Card key={key} className="opacity-50">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{def.title}</p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">{def.description({})}</p>
                    </div>
                    <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Locked exercise milestones — per class with progress */}
      {lockedExerciseRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Marcos de exercício</h2>
          <div className="grid grid-cols-1 gap-2">
            {lockedExerciseRows.map(({ classId, className, key, threshold, current }) => {
              const def = ACHIEVEMENT_DEFS[key]
              const Icon = ICON_MAP[def.icon] ?? Medal
              const pct = Math.min((current / threshold) * 100, 100)
              return (
                <Card key={`${key}:${classId}`} className="opacity-60">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{def.title} — {className}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/40 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{current.toLocaleString('pt-BR')}/{threshold.toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {achievements.length === 0 && lockedGlobal.length === 0 && lockedExerciseRows.length === 0 && (
        <p className="text-sm text-muted-foreground">Complete treinos para desbloquear conquistas.</p>
      )}
    </div>
  )
}
