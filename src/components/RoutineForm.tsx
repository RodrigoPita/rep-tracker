'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ExerciseWithClass } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

type RowDraft = {
  exercise_id: string
  label: string
  sets: number
  target_reps: number
  display_order: number
}

export type RoutineFormInitialData = {
  name: string
  rows: RowDraft[]
}

type Props = {
  routineId?: string
  allExercises: ExerciseWithClass[]
  initialData?: RoutineFormInitialData
}

function normalize(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function RoutineForm({ routineId, allExercises, initialData }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? '')
  const [rows, setRows] = useState<RowDraft[]>(initialData?.rows ?? [])
  const [exercises, setExercises] = useState<ExerciseWithClass[]>(allExercises)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = exercises.filter((e) => {
    const q = normalize(search)
    return (
      !rows.some((r) => r.exercise_id === e.id) &&
      (normalize(e.exercise_classes.name).includes(q) || normalize(e.variant).includes(q))
    )
  })

  const grouped = filtered.reduce<Record<string, { className: string; exercises: ExerciseWithClass[] }>>(
    (acc, e) => {
      if (!acc[e.class_id]) acc[e.class_id] = { className: e.exercise_classes.name, exercises: [] }
      acc[e.class_id].exercises.push(e)
      return acc
    },
    {}
  )

  function addExercise(exercise: ExerciseWithClass) {
    setRows((prev) => [
      ...prev,
      {
        exercise_id: exercise.id,
        label: exerciseLabel(exercise),
        sets: 3,
        target_reps: 10,
        display_order: prev.length,
      },
    ])
    setSearch('')
  }

  async function createAndAdd() {
    const trimmed = search.trim()
    if (!trimmed) return
    const parts = trimmed.split('—').map((s) => s.trim())
    const className = parts[0]
    const variant = parts[1] ?? 'Normal'

    let { data: classData } = await supabase
      .from('exercise_classes')
      .select('*')
      .eq('name', className)
      .single()
    if (!classData) {
      const res = await supabase.from('exercise_classes').insert({ name: className }).select().single()
      classData = res.data
    }
    if (!classData) return

    const { data: exData } = await supabase
      .from('exercises')
      .insert({ class_id: classData.id, variant })
      .select('*, exercise_classes(*)')
      .single()
    if (exData) {
      setExercises((prev) => [...prev, exData as ExerciseWithClass])
      addExercise(exData as ExerciseWithClass)
    }
  }

  function updateRow(index: number, field: 'sets' | 'target_reps', value: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function removeRow(index: number) {
    setRows((prev) =>
      prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, display_order: i }))
    )
  }

  function moveRow(index: number, direction: -1 | 1) {
    const next = index + direction
    if (next < 0 || next >= rows.length) return
    setRows((prev) => {
      const updated = [...prev]
      ;[updated[index], updated[next]] = [updated[next], updated[index]]
      return updated.map((r, i) => ({ ...r, display_order: i }))
    })
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)

    let rid = routineId
    if (rid) {
      await supabase.from('routines').update({ name }).eq('id', rid)
    } else {
      const { data } = await supabase.from('routines').insert({ name }).select().single()
      rid = data?.id
    }
    if (!rid) { setSaving(false); return }

    await supabase.from('routine_exercises').delete().eq('routine_id', rid)
    if (rows.length > 0) {
      await supabase.from('routine_exercises').insert(
        rows.map((r, i) => ({
          routine_id: rid!,
          exercise_id: r.exercise_id,
          sets: r.sets,
          target_reps: r.target_reps,
          display_order: i,
        }))
      )
    }

    router.push('/routines')
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do treino</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Treino A, Push Day…"
        />
      </div>

      <div className="space-y-2">
        <Label>Exercícios</Label>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum exercício adicionado.</p>
        )}
        {rows.map((row, i) => (
          <Card key={i}>
            <CardContent className="py-3 flex items-center gap-2 flex-wrap">
              <span className="font-medium flex-1 min-w-0 truncate text-sm">{row.label}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  value={row.sets}
                  onChange={(e) => updateRow(i, 'sets', parseInt(e.target.value) || 1)}
                  className="w-14 h-8 text-center"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">séries</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  value={row.target_reps}
                  onChange={(e) => updateRow(i, 'target_reps', parseInt(e.target.value) || 1)}
                  className="w-14 h-8 text-center"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">reps</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => moveRow(i, -1)} disabled={i === 0}>↑</Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1}>↓</Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeRow(i)}>✕</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Adicionar exercício</Label>
        <Input
          placeholder='Buscar… ex: "flexao" ou "diamante"'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {Object.values(grouped).map(({ className, exercises: exList }) => (
              <div key={className}>
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted uppercase tracking-wide sticky top-0">
                  {className}
                </p>
                {exList.map((e) => (
                  <button
                    key={e.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => addExercise(e)}
                  >
                    {e.variant}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-muted-foreground"
                onClick={createAndAdd}
              >
                Criar &quot;{search}&quot;
                <span className="text-xs ml-1 opacity-60">(formato: Classe — Variante)</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={save} disabled={saving || !name.trim()}>
          {saving ? 'Salvando…' : 'Salvar treino'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/routines')}>Cancelar</Button>
      </div>
    </div>
  )
}
