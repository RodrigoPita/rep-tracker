'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ExerciseWithClass } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'
import { normalize } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Timer, X } from 'lucide-react'

type RowDraft = {
  id?: string           // routine_exercise id — present for existing rows, absent for newly added ones
  exercise_id: string
  label: string
  is_timed: boolean
  sets: number
  target_reps: number
  target_seconds: number | null
  rest_seconds: number | null
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


type SortableRowProps = {
  row: RowDraft
  index: number
  onUpdate: (index: number, field: 'sets' | 'target_reps', value: number) => void
  onUpdateTargetSeconds: (index: number, value: number | null) => void
  onUpdateRest: (index: number, value: number | null) => void
  onRemove: (index: number) => void
}

function SortableRow({ row, index, onUpdate, onUpdateTargetSeconds, onUpdateRest, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.exercise_id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardContent className="py-3 space-y-2">
          {/* Row 1: drag handle + exercise name + remove */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
              aria-label="Arrastar para reordenar"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <span className="font-medium text-sm flex-1">{row.label}</span>
            {row.is_timed && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-1.5 py-0.5">
                <Timer className="w-3 h-3" /> tempo
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
              aria-label="Remover exercício"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: sets, reps/seconds, rest */}
          <div className="flex items-center gap-2 pl-6">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={row.sets}
                onChange={(e) => onUpdate(index, 'sets', parseInt(e.target.value) || 1)}
                className="w-14 h-8 text-center"
                min={1}
              />
              <span className="text-sm text-muted-foreground">séries</span>
            </div>

            {row.is_timed ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={row.target_seconds ?? ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    onUpdateTargetSeconds(index, e.target.value === '' || isNaN(v) ? null : v)
                  }}
                  placeholder="30"
                  className="w-14 h-8 text-center"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">seg</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={row.target_reps}
                  onChange={(e) => onUpdate(index, 'target_reps', parseInt(e.target.value) || 1)}
                  className="w-14 h-8 text-center"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">reps</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                type="number"
                value={row.rest_seconds ?? ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  onUpdateRest(index, e.target.value === '' || isNaN(v) ? null : v)
                }}
                placeholder="—"
                className="w-14 h-8 text-center"
                min={1}
              />
              <span className="text-sm text-muted-foreground">s</span>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RoutineForm({ routineId, allExercises, initialData }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? '')
  const [rows, setRows] = useState<RowDraft[]>(initialData?.rows ?? [])
  // Track which routine_exercise IDs existed at load time so we can delete removed ones on save
  const initialRowIds = useRef<Set<string>>(
    new Set(initialData?.rows.map((r) => r.id).filter(Boolean) as string[])
  )
  const [exercises, setExercises] = useState<ExerciseWithClass[]>(allExercises)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [targetSessions, setTargetSessions] = useState<string>('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
    const isTimed = exercise.exercise_classes.is_timed
    setRows((prev) => [
      ...prev,
      {
        exercise_id: exercise.id,
        label: exerciseLabel(exercise),
        is_timed: isTimed,
        sets: 3,
        target_reps: 10,
        target_seconds: isTimed ? 30 : null,
        rest_seconds: null,
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
      if (res.error) { toast.error('Não foi possível criar a classe de exercício.'); return }
      classData = res.data
    }
    if (!classData) return

    const { data: exData, error: exError } = await supabase
      .from('exercises')
      .insert({ class_id: classData.id, variant })
      .select('*, exercise_classes(*)')
      .single()
    if (exError) { toast.error('Não foi possível criar o exercício.'); return }
    if (exData) {
      setExercises((prev) => [...prev, exData as ExerciseWithClass])
      addExercise(exData as ExerciseWithClass)
    }
  }

  function updateRow(index: number, field: 'sets' | 'target_reps', value: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function updateRowTargetSeconds(index: number, value: number | null) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, target_seconds: value } : r)))
  }

  function updateRowRest(index: number, value: number | null) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, rest_seconds: value } : r)))
  }

  function removeRow(index: number) {
    setRows((prev) =>
      prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, display_order: i }))
    )
  }

function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.exercise_id === active.id)
      const newIndex = prev.findIndex((r) => r.exercise_id === over.id)
      return arrayMove(prev, oldIndex, newIndex).map((r, i) => ({ ...r, display_order: i }))
    })
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)

    let rid = routineId
    if (rid) {
      const { error } = await supabase.from('routines').update({ name }).eq('id', rid)
      if (error) { toast.error('Não foi possível atualizar o treino.'); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('routines').insert({ name, user_id: user?.id }).select().single()
      if (error) { toast.error('Não foi possível criar o treino.'); setSaving(false); return }
      rid = data?.id
    }
    if (!rid) { setSaving(false); return }

    // Create period for new routines if target_sessions is set
    if (!routineId) {
      const ts = parseInt(targetSessions)
      if (!isNaN(ts) && ts > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('routine_periods').insert({ routine_id: rid, user_id: user?.id, target_sessions: ts })
      }
    }

    const existingRows = rows.filter((r) => r.id)
    const newRows = rows.filter((r) => !r.id)
    const keptIds = new Set(existingRows.map((r) => r.id!))
    const deletedIds = [...initialRowIds.current].filter((id) => !keptIds.has(id))

    // Soft-delete removed exercises so historical workout_sets keep their FK reference
    // (hard-deleting would set routine_exercise_id to NULL, wiping exercise names from the calendar)
    if (deletedIds.length > 0) {
      const { error } = await supabase.from('routine_exercises')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', deletedIds)
      if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
    }

    // Update existing exercises (order may have changed)
    if (existingRows.length > 0) {
      const { error } = await supabase.from('routine_exercises').upsert(
        existingRows.map((r) => ({
          id: r.id!,
          routine_id: rid!,
          exercise_id: r.exercise_id,
          sets: r.sets,
          target_reps: r.target_reps,
          target_seconds: r.target_seconds ?? null,
          rest_seconds: r.rest_seconds ?? null,
          display_order: rows.indexOf(r),
        }))
      )
      if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
    }

    // Insert newly added exercises
    if (newRows.length > 0) {
      const { error } = await supabase.from('routine_exercises').insert(
        newRows.map((r) => ({
          routine_id: rid!,
          exercise_id: r.exercise_id,
          sets: r.sets,
          target_reps: r.target_reps,
          target_seconds: r.target_seconds ?? null,
          rest_seconds: r.rest_seconds ?? null,
          display_order: rows.indexOf(r),
        }))
      )
      if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
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

      {!routineId && (
        <div className="space-y-2">
          <Label htmlFor="target_sessions">Meta de treinos (opcional)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="target_sessions"
              type="number"
              value={targetSessions}
              onChange={(e) => setTargetSessions(e.target.value)}
              placeholder="ex: 45"
              className="w-28"
              min={1}
            />
            <span className="text-sm text-muted-foreground">treinos neste ciclo</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Exercícios</Label>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum exercício adicionado.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.exercise_id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <SortableRow
                  key={row.exercise_id}
                  row={row}
                  index={i}
                  onUpdate={updateRow}
                  onUpdateTargetSeconds={updateRowTargetSeconds}
                  onUpdateRest={updateRowRest}
                  onRemove={removeRow}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
