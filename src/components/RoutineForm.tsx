'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ExerciseWithClass } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'
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
import { GripVertical } from 'lucide-react'

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

type SortableRowProps = {
  row: RowDraft
  index: number
  total: number
  onUpdate: (index: number, field: 'sets' | 'target_reps', value: number) => void
  onRemove: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
}

function SortableRow({ row, index, total, onUpdate, onRemove, onMove }: SortableRowProps) {
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
        <CardContent className="py-3 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <span className="font-medium flex-1 min-w-0 truncate text-sm">{row.label}</span>

          <div className="flex items-center gap-1 shrink-0">
            <Input
              type="number"
              value={row.sets}
              onChange={(e) => onUpdate(index, 'sets', parseInt(e.target.value) || 1)}
              className="w-14 h-8 text-center"
              min={1}
            />
            <span className="text-sm text-muted-foreground">séries</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Input
              type="number"
              value={row.target_reps}
              onChange={(e) => onUpdate(index, 'target_reps', parseInt(e.target.value) || 1)}
              className="w-14 h-8 text-center"
              min={1}
            />
            <span className="text-sm text-muted-foreground">reps</span>
          </div>

          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              aria-label="Mover para cima"
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onMove(index, 1)}
              disabled={index === total - 1}
              aria-label="Mover para baixo"
            >
              ↓
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onRemove(index)}
              aria-label="Remover exercício"
            >
              ✕
            </Button>
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
  const [exercises, setExercises] = useState<ExerciseWithClass[]>(allExercises)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
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
      const { data, error } = await supabase.from('routines').insert({ name }).select().single()
      if (error) { toast.error('Não foi possível criar o treino.'); setSaving(false); return }
      rid = data?.id
    }
    if (!rid) { setSaving(false); return }

    const { error: deleteError } = await supabase.from('routine_exercises').delete().eq('routine_id', rid)
    if (deleteError) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('routine_exercises').insert(
        rows.map((r, i) => ({
          routine_id: rid!,
          exercise_id: r.exercise_id,
          sets: r.sets,
          target_reps: r.target_reps,
          display_order: i,
        }))
      )
      if (insertError) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.exercise_id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <SortableRow
                  key={row.exercise_id}
                  row={row}
                  index={i}
                  total={rows.length}
                  onUpdate={updateRow}
                  onRemove={removeRow}
                  onMove={moveRow}
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
