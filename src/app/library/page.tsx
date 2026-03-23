import { supabaseServer } from '@/lib/supabase-server'
import LibraryClient from '@/components/LibraryClient'

export type ExerciseClass = {
  id: string
  name: string
  is_timed: boolean
  exercises: { id: string; variant: string }[]
}

export default async function LibraryPage() {
  const db = await supabaseServer()

  const [{ data: { user } }, { data }] = await Promise.all([
    db.auth.getUser(),
    db.from('exercise_classes')
      .select('id, name, is_timed, exercises(id, variant)')
      .order('name'),
  ])

  const isAdmin = user?.id === process.env.ADMIN_USER_ID

  const classes: ExerciseClass[] = (data ?? []).map((cls) => ({
    id: cls.id,
    name: cls.name,
    is_timed: cls.is_timed ?? false,
    exercises: [...(cls.exercises as { id: string; variant: string }[])]
      .sort((a, b) => a.variant.localeCompare(b.variant)),
  }))

  return <LibraryClient classes={classes} isAdmin={isAdmin} />
}
