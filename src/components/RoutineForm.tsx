'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ExerciseWithClass } from '@/lib/types'
import { routineMode, setUnit } from '@/lib/types'
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
import { GripVertical, Plus, Timer, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

/** One set row within an exercise block */
type SetDraft = {
  /** routine_exercise.id — present for rows loaded from DB, absent for newly added ones */
  id?: string
  /** Stable client-side key used for DnD and React keys */
  draftId: string
  exerciseId: string
  variantLabel: string
}

/** One exercise block (class + N set rows) */
type BlockDraft = {
  /** Stable client-side key used for outer DnD */
  draftId: string
  /** Shared block_id for blocks loaded from DB; undefined for brand-new blocks */
  blockId?: string
  classId: string
  className: string
  isTimed: boolean
  targetReps: number
  targetSeconds: number | null
  restSeconds: number | null
  displayOrder: number
  setRows: SetDraft[]
}

export type RoutineFormInitialData = {
  name: string
  blocks: BlockDraft[]
  isCircuit?: boolean
}

type Props = {
  routineId?: string
  allExercises: ExerciseWithClass[]
  initialData?: RoutineFormInitialData
}

// ── Inner sortable set row ─────────────────────────────────────────────────────

type SortableSetRowProps = {
  setRow: SetDraft
  blockIndex: number
  setIndex: number
  variantsForClass: ExerciseWithClass[]
  isTimed: boolean
  onChangeVariant: (blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) => void
  onRemove: (blockIndex: number, setIndex: number) => void
  canRemove: boolean
}

function SortableSetRow({
  setRow,
  blockIndex,
  setIndex,
  variantsForClass,
  isTimed,
  onChangeVariant,
  onRemove,
  canRemove,
}: SortableSetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: setRow.draftId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Arrastar para reordenar série"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums">
        S{setIndex + 1}
      </span>

      <select
        value={setRow.exerciseId}
        onChange={(e) => {
          const ex = variantsForClass.find((v) => v.id === e.target.value)
          if (ex) onChangeVariant(blockIndex, setIndex, ex.id, ex.variant)
          else onChangeVariant(blockIndex, setIndex, '', '')
        }}
        className={[
          'flex-1 h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
          setRow.exerciseId === ''
            ? 'border-destructive text-muted-foreground'
            : 'border-input',
        ].join(' ')}
        aria-label={`Variante da série ${setIndex + 1}`}
      >
        <option value="">—</option>
        {variantsForClass.map((v) => (
          <option key={v.id} value={v.id}>
            {v.variant}
          </option>
        ))}
      </select>

      {isTimed && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground border rounded-full px-1.5 py-0.5 shrink-0">
          <Timer className="w-3 h-3" /> tempo
        </span>
      )}

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(blockIndex, setIndex)}
          className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
          aria-label="Remover série"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Outer sortable block card ──────────────────────────────────────────────────

type SortableBlockProps = {
  block: BlockDraft
  blockIndex: number
  variantsByClass: Record<string, ExerciseWithClass[]>
  sensors: ReturnType<typeof useSensors>
  onUpdateConfig: (blockIndex: number, field: 'targetReps' | 'restSeconds' | 'targetSeconds', value: number | null) => void
  onChangeVariant: (blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) => void
  onAddSet: (blockIndex: number) => void
  onRemoveSet: (blockIndex: number, setIndex: number) => void
  onRemoveBlock: (blockIndex: number) => void
  onInnerDragEnd: (blockIndex: number, event: DragEndEvent) => void
}

function SortableBlock({
  block,
  blockIndex,
  variantsByClass,
  sensors,
  onUpdateConfig,
  onChangeVariant,
  onAddSet,
  onRemoveSet,
  onRemoveBlock,
  onInnerDragEnd,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.draftId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const variants = variantsByClass[block.classId] ?? []

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardContent className="py-3 space-y-3">
          {/* Row 1: drag handle + class name + remove */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
              aria-label="Arrastar para reordenar exercício"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <span className="font-medium text-sm flex-1">{block.className}</span>
            <button
              type="button"
              onClick={() => onRemoveBlock(blockIndex)}
              className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
              aria-label="Remover exercício"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: reps/seconds + rest config */}
          <div className="flex items-center gap-2 pl-6">
            {block.isTimed ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={block.targetSeconds ?? ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    onUpdateConfig(blockIndex, 'targetSeconds', e.target.value === '' || isNaN(v) ? null : v)
                  }}
                  placeholder="30"
                  className="w-14 h-8 text-center"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">{setUnit(true)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={block.targetReps}
                  onChange={(e) => onUpdateConfig(blockIndex, 'targetReps', parseInt(e.target.value) || 1)}
                  className="w-14 h-8 text-center"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">{setUnit(false)}</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                type="number"
                value={block.restSeconds ?? ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  onUpdateConfig(blockIndex, 'restSeconds', e.target.value === '' || isNaN(v) ? null : v)
                }}
                placeholder="—"
                className="w-14 h-8 text-center"
                min={1}
              />
              <span className="text-sm text-muted-foreground">s</span>
            </div>
          </div>

          {/* Row 3: per-set variant rows (inner DnD) */}
          <div className="pl-6 space-y-1.5">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => onInnerDragEnd(blockIndex, e)}
            >
              <SortableContext
                items={block.setRows.map((r) => r.draftId)}
                strategy={verticalListSortingStrategy}
              >
                {block.setRows.map((setRow, setIndex) => (
                  <SortableSetRow
                    key={setRow.draftId}
                    setRow={setRow}
                    blockIndex={blockIndex}
                    setIndex={setIndex}
                    variantsForClass={variants}
                    isTimed={block.isTimed}
                    onChangeVariant={onChangeVariant}
                    onRemove={onRemoveSet}
                    canRemove={block.setRows.length > 1}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={() => onAddSet(blockIndex)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Série
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function RoutineForm({ routineId, allExercises, initialData }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? '')
  const [blocks, setBlocks] = useState<BlockDraft[]>(initialData?.blocks ?? [])
  const [isCircuit, setIsCircuit] = useState(initialData?.isCircuit ?? false)
  const exercises = allExercises
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [targetSessions, setTargetSessions] = useState<string>('')

  // Track which routine_exercise IDs existed at load time so we can soft-delete removed ones
  const initialSetIds = useRef<Set<string>>(
    new Set(
      initialData?.blocks.flatMap((b) => b.setRows.map((r) => r.id).filter(Boolean) as string[]) ?? []
    )
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Variants keyed by class id for fast lookup
  const variantsByClass = exercises.reduce<Record<string, ExerciseWithClass[]>>((acc, e) => {
    if (!acc[e.class_id]) acc[e.class_id] = []
    acc[e.class_id].push(e)
    return acc
  }, {})

  // Unique exercise classes for the class picker
  const allClasses = Object.values(
    exercises.reduce<Record<string, { classId: string; className: string; isTimed: boolean }>>(
      (acc, e) => {
        if (!acc[e.class_id]) acc[e.class_id] = {
          classId: e.class_id,
          className: e.exercise_classes.name,
          isTimed: e.exercise_classes.is_timed,
        }
        return acc
      },
      {}
    )
  )

  const filteredClasses = allClasses.filter((c) =>
    normalize(c.className).includes(normalize(search))
  )

  function addBlock(classInfo: { classId: string; className: string; isTimed: boolean }) {
    setBlocks((prev) => [
      ...prev,
      {
        draftId: crypto.randomUUID(),
        classId: classInfo.classId,
        className: classInfo.className,
        isTimed: classInfo.isTimed,
        targetReps: 10,
        targetSeconds: classInfo.isTimed ? 30 : null,
        restSeconds: null,
        displayOrder: prev.length,
        setRows: [{ draftId: crypto.randomUUID(), exerciseId: '', variantLabel: '' }],
      },
    ])
    setSearch('')
    setShowPicker(false)
  }

  async function createAndAdd() {
    const trimmed = search.trim()
    if (!trimmed) return

    let { data: classData } = await supabase
      .from('exercise_classes')
      .select('*')
      .ilike('name', trimmed)
      .single()
    if (!classData) {
      const res = await supabase.from('exercise_classes').insert({ name: trimmed }).select().single()
      if (res.error) { toast.error('Não foi possível criar a classe de exercício.'); return }
      classData = res.data
    }
    if (!classData) return

    addBlock({ classId: classData.id, className: classData.name, isTimed: classData.is_timed ?? false })
  }

  function updateConfig(blockIndex: number, field: 'targetReps' | 'restSeconds' | 'targetSeconds', value: number | null) {
    setBlocks((prev) => prev.map((b, i) =>
      i === blockIndex
        ? { ...b, [field]: value }
        : b
    ))
  }

  function changeVariant(blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) {
    setBlocks((prev) => prev.map((b, bi) => {
      if (bi !== blockIndex) return b
      return {
        ...b,
        setRows: b.setRows.map((r, si) =>
          si === setIndex ? { ...r, exerciseId, variantLabel } : r
        ),
      }
    }))
  }

  function addSet(blockIndex: number) {
    setBlocks((prev) => prev.map((b, i) => {
      if (i !== blockIndex) return b
      const last = b.setRows[b.setRows.length - 1]
      return {
        ...b,
        setRows: [
          ...b.setRows,
          {
            draftId: crypto.randomUUID(),
            exerciseId: last?.exerciseId ?? b.setRows[0]?.exerciseId ?? '',
            variantLabel: last?.variantLabel ?? b.setRows[0]?.variantLabel ?? '',
          },
        ],
      }
    }))
  }

  function removeSet(blockIndex: number, setIndex: number) {
    setBlocks((prev) => prev.map((b, i) => {
      if (i !== blockIndex) return b
      return { ...b, setRows: b.setRows.filter((_, si) => si !== setIndex) }
    }))
  }

  function removeBlock(blockIndex: number) {
    setBlocks((prev) =>
      prev.filter((_, i) => i !== blockIndex).map((b, i) => ({ ...b, displayOrder: i }))
    )
  }

  function handleOuterDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.draftId === active.id)
      const newIndex = prev.findIndex((b) => b.draftId === over.id)
      return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, displayOrder: i }))
    })
  }

  function handleInnerDragEnd(blockIndex: number, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBlocks((prev) => prev.map((b, i) => {
      if (i !== blockIndex) return b
      const oldIndex = b.setRows.findIndex((r) => r.draftId === active.id)
      const newIndex = b.setRows.findIndex((r) => r.draftId === over.id)
      return { ...b, setRows: arrayMove(b.setRows, oldIndex, newIndex) }
    }))
  }

  async function save() {
    if (!name.trim()) return
    const hasUnselected = blocks.some((b) => b.setRows.some((r) => !r.exerciseId))
    if (hasUnselected) {
      toast.error('Selecione um exercício para cada série antes de salvar.')
      return
    }
    setSaving(true)

    let rid = routineId
    if (rid) {
      const { error } = await supabase.from('routines').update({ name, is_circuit: isCircuit }).eq('id', rid)
      if (error) { toast.error('Não foi possível atualizar o treino.'); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('routines').insert({ name, is_circuit: isCircuit, user_id: user?.id }).select().single()
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

    // Collect all current routine_exercise IDs still present in the form
    const keptIds = new Set(
      blocks.flatMap((b) => b.setRows.map((r) => r.id).filter(Boolean) as string[])
    )
    const deletedIds = [...initialSetIds.current].filter((id) => !keptIds.has(id))

    // Soft-delete removed rows
    if (deletedIds.length > 0) {
      const { error } = await supabase.from('routine_exercises')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', deletedIds)
      if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
    }

    // Build the flat list of set rows to upsert/insert
    for (const block of blocks) {
      // For new blocks (no blockId) we generate a stable block_id now
      const blockId = block.blockId ?? crypto.randomUUID()

      const existingRows = block.setRows.filter((r) => r.id)
      const newRows = block.setRows.filter((r) => !r.id)

      if (existingRows.length > 0) {
        const { error } = await supabase.from('routine_exercises').upsert(
          existingRows.map((r) => ({
            id: r.id!,
            routine_id: rid!,
            exercise_id: r.exerciseId,
            exercise_class_id: block.classId,
            block_id: blockId,
            set_number: block.setRows.indexOf(r) + 1,
            sets: block.setRows.length,
            target_reps: block.targetReps,
            target_seconds: block.targetSeconds ?? null,
            rest_seconds: block.restSeconds ?? null,
            display_order: block.displayOrder,
            deleted_at: null,
          }))
        )
        if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
      }

      if (newRows.length > 0) {
        const { error } = await supabase.from('routine_exercises').insert(
          newRows.map((r) => ({
            routine_id: rid!,
            exercise_id: r.exerciseId,
            exercise_class_id: block.classId,
            block_id: blockId,
            set_number: block.setRows.indexOf(r) + 1,
            sets: block.setRows.length,
            target_reps: block.targetReps,
            target_seconds: block.targetSeconds ?? null,
            rest_seconds: block.restSeconds ?? null,
            display_order: block.displayOrder,
          }))
        )
        if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
      }
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
        <Label>Modo</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsCircuit(false)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              !isCircuit
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {routineMode(false)}
          </button>
          <button
            type="button"
            onClick={() => setIsCircuit(true)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              isCircuit
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {routineMode(true)}
          </button>
        </div>
        {isCircuit && (
          <p className="text-xs text-muted-foreground">
            Uma série de cada exercício por rodada, em sequência.
          </p>
        )}
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
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum exercício adicionado.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOuterDragEnd}>
          <SortableContext items={blocks.map((b) => b.draftId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((block, i) => (
                <SortableBlock
                  key={block.draftId}
                  block={block}
                  blockIndex={i}
                  variantsByClass={variantsByClass}
                  sensors={sensors}
                  onUpdateConfig={updateConfig}
                  onChangeVariant={changeVariant}
                  onAddSet={addSet}
                  onRemoveSet={removeSet}
                  onRemoveBlock={removeBlock}
                  onInnerDragEnd={handleInnerDragEnd}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => { setShowPicker((v) => !v); setSearch('') }}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar exercício
        </Button>

        {showPicker && (
          <div className="border rounded-md overflow-hidden">
            <div className="p-2 border-b">
              <Input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                placeholder='Filtrar… ex: "flexao"'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filteredClasses.map((c) => (
                <button
                  key={c.classId}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => addBlock(c)}
                >
                  {c.className}
                </button>
              ))}
              {filteredClasses.length === 0 && (
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-muted-foreground"
                  onClick={createAndAdd}
                >
                  Criar &quot;{search}&quot;
                </button>
              )}
            </div>
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
