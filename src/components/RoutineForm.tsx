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

/** One set row within an exercise block. In a bi-set it holds both the main
 *  variant and the paired secondary variant for that set number. */
type SetDraft = {
  /** routine_exercise.id — present for rows loaded from DB, absent for newly added ones */
  id?: string
  /** Stable client-side key used for DnD and React keys */
  draftId: string
  exerciseId: string
  variantLabel: string
  /** routine_exercise.id of the paired secondary row (bi-set only) */
  secondaryId?: string
  secondaryExerciseId?: string
  secondaryVariantLabel?: string
}

/** Config for the secondary exercise of a bi-set block */
type SideConfig = {
  classId: string
  className: string
  isTimed: boolean
  targetReps: number
  targetSeconds: number | null
}

/** One exercise block (class + N set rows), optionally a bi-set with a secondary */
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
  /** When present, the block is a bi-set: each set pairs main + secondary with no rest between */
  secondary?: SideConfig
}

export type RoutineFormInitialData = {
  name: string
  blocks: BlockDraft[]
  isCircuit?: boolean
  interExerciseRestSeconds?: number | null
  roundRestSeconds?: number | null
  circuitRestSeconds?: number | null
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
  secondary?: SideConfig
  secondaryVariants: ExerciseWithClass[]
  onChangeVariant: (blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) => void
  onChangeSecondaryVariant: (blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) => void
  onRemove: (blockIndex: number, setIndex: number) => void
  canRemove: boolean
}

function SortableSetRow({
  setRow,
  blockIndex,
  setIndex,
  variantsForClass,
  isTimed,
  secondary,
  secondaryVariants,
  onChangeVariant,
  onChangeSecondaryVariant,
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
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button
        type="button"
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none mt-1.5"
        aria-label="Arrastar para reordenar série"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums mt-2">
        S{setIndex + 1}
      </span>

      <div className="flex-1 space-y-1.5">
        {/* Main variant */}
        <div className="flex items-center gap-2">
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
        </div>

        {/* Secondary variant (bi-set) */}
        {secondary && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 w-3 text-center">+</span>
            <select
              value={setRow.secondaryExerciseId ?? ''}
              onChange={(e) => {
                const ex = secondaryVariants.find((v) => v.id === e.target.value)
                if (ex) onChangeSecondaryVariant(blockIndex, setIndex, ex.id, ex.variant)
                else onChangeSecondaryVariant(blockIndex, setIndex, '', '')
              }}
              className={[
                'flex-1 h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
                !setRow.secondaryExerciseId
                  ? 'border-destructive text-muted-foreground'
                  : 'border-input',
              ].join(' ')}
              aria-label={`Variante secundária da série ${setIndex + 1}`}
            >
              <option value="">—</option>
              {secondaryVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.variant}
                </option>
              ))}
            </select>

            {secondary.isTimed && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground border rounded-full px-1.5 py-0.5 shrink-0">
                <Timer className="w-3 h-3" /> tempo
              </span>
            )}
          </div>
        )}
      </div>

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(blockIndex, setIndex)}
          className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 mt-1.5"
          aria-label="Remover série"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Outer sortable block card ──────────────────────────────────────────────────

type ClassInfo = { classId: string; className: string; isTimed: boolean }

type SortableBlockProps = {
  block: BlockDraft
  blockIndex: number
  variantsByClass: Record<string, ExerciseWithClass[]>
  allClasses: ClassInfo[]
  sensors: ReturnType<typeof useSensors>
  isCircuit: boolean
  onUpdateConfig: (blockIndex: number, field: 'targetReps' | 'restSeconds' | 'targetSeconds', value: number | null) => void
  onUpdateSecondaryConfig: (blockIndex: number, field: 'targetReps' | 'targetSeconds', value: number | null) => void
  onChangeVariant: (blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) => void
  onChangeSecondaryVariant: (blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) => void
  onAddSecondary: (blockIndex: number, classInfo: ClassInfo) => void
  onRemoveSecondary: (blockIndex: number) => void
  onAddSet: (blockIndex: number) => void
  onRemoveSet: (blockIndex: number, setIndex: number) => void
  onRemoveBlock: (blockIndex: number) => void
  onInnerDragEnd: (blockIndex: number, event: DragEndEvent) => void
}

function SortableBlock({
  block,
  blockIndex,
  variantsByClass,
  allClasses,
  sensors,
  isCircuit,
  onUpdateConfig,
  onUpdateSecondaryConfig,
  onChangeVariant,
  onChangeSecondaryVariant,
  onAddSecondary,
  onRemoveSecondary,
  onAddSet,
  onRemoveSet,
  onRemoveBlock,
  onInnerDragEnd,
}: SortableBlockProps) {
  const [repsInput, setRepsInput] = useState<string>(String(block.targetReps))
  const [secRepsInput, setSecRepsInput] = useState<string>(String(block.secondary?.targetReps ?? 10))
  const [showSecPicker, setShowSecPicker] = useState(false)
  const [secSearch, setSecSearch] = useState('')
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
  const secondaryVariants = block.secondary ? (variantsByClass[block.secondary.classId] ?? []) : []
  const filteredSecClasses = allClasses.filter((c) =>
    c.classId !== block.classId && normalize(c.className).includes(normalize(secSearch))
  )

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
                  value={repsInput}
                  onChange={(e) => {
                    setRepsInput(e.target.value)
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 1) onUpdateConfig(blockIndex, 'targetReps', v)
                  }}
                  onBlur={() => {
                    const v = parseInt(repsInput)
                    if (isNaN(v) || v < 1) setRepsInput(String(block.targetReps))
                  }}
                  className="w-14 h-8 text-center"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">{setUnit(false)}</span>
              </div>
            )}

            {!isCircuit && (
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
            )}
          </div>

          {/* Row 2b: secondary exercise config (bi-set, standard mode only) */}
          {!isCircuit && block.secondary && (
            <div className="pl-6 space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground shrink-0">Bi-set +</span>
                <span className="text-sm font-medium flex-1">{block.secondary.className}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSecondary(blockIndex)}
                  className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
                  aria-label="Remover bi-set"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {block.secondary.isTimed ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={block.secondary.targetSeconds ?? ''}
                      onChange={(e) => {
                        const v = parseInt(e.target.value)
                        onUpdateSecondaryConfig(blockIndex, 'targetSeconds', e.target.value === '' || isNaN(v) ? null : v)
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
                      value={secRepsInput}
                      onChange={(e) => {
                        setSecRepsInput(e.target.value)
                        const v = parseInt(e.target.value)
                        if (!isNaN(v) && v >= 1) onUpdateSecondaryConfig(blockIndex, 'targetReps', v)
                      }}
                      onBlur={() => {
                        const v = parseInt(secRepsInput)
                        if (isNaN(v) || v < 1) setSecRepsInput(String(block.secondary?.targetReps ?? 10))
                      }}
                      className="w-14 h-8 text-center"
                      min={1}
                    />
                    <span className="text-sm text-muted-foreground">{setUnit(false)}</span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground">sem descanso entre o par</span>
              </div>
            </div>
          )}

          {/* Row 3: variant picker */}
          {isCircuit ? (
            // Circuit mode: single variant choice applied to all rounds
            <div className="pl-6">
              <select
                value={block.setRows[0]?.exerciseId ?? ''}
                onChange={(e) => {
                  const ex = variants.find((v) => v.id === e.target.value)
                  if (ex) onChangeVariant(blockIndex, 0, ex.id, ex.variant)
                  else onChangeVariant(blockIndex, 0, '', '')
                }}
                className={[
                  'w-full h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
                  block.setRows[0]?.exerciseId ? 'border-input' : 'border-destructive text-muted-foreground',
                ].join(' ')}
                aria-label="Variante"
              >
                <option value="">—</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.variant}</option>
                ))}
              </select>
            </div>
          ) : (
            // Standard mode: per-set variant rows with DnD
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
                      secondary={block.secondary}
                      secondaryVariants={secondaryVariants}
                      onChangeVariant={onChangeVariant}
                      onChangeSecondaryVariant={onChangeSecondaryVariant}
                      onRemove={onRemoveSet}
                      canRemove={block.setRows.length > 1}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <div className="flex items-center gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={() => onAddSet(blockIndex)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Série
                </button>

                {!block.secondary && (
                  <button
                    type="button"
                    onClick={() => { setShowSecPicker((v) => !v); setSecSearch('') }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Bi-set
                  </button>
                )}
              </div>

              {/* Secondary class picker */}
              {!block.secondary && showSecPicker && (
                <div className="border rounded-md overflow-hidden">
                  <div className="p-2 border-b">
                    <Input
                      autoFocus
                      placeholder='Exercício secundário… ex: "cadeirinha"'
                      value={secSearch}
                      onChange={(e) => setSecSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredSecClasses.map((c) => (
                      <button
                        key={c.classId}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => { onAddSecondary(blockIndex, c); setShowSecPicker(false); setSecSearch('') }}
                      >
                        {c.className}
                      </button>
                    ))}
                    {filteredSecClasses.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma classe encontrada.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
  const [rounds, setRounds] = useState<number>(() => {
    if (initialData?.isCircuit && initialData.blocks.length > 0) {
      return Math.max(1, initialData.blocks[0].setRows.length)
    }
    return 3
  })
  const [roundsInput, setRoundsInput] = useState<string>(() => {
    if (initialData?.isCircuit && initialData.blocks.length > 0) {
      return String(Math.max(1, initialData.blocks[0].setRows.length))
    }
    return '3'
  })
  const [interExerciseRestSeconds, setInterExerciseRestSeconds] = useState<number | null>(initialData?.interExerciseRestSeconds ?? null)
  const [roundRestSeconds, setRoundRestSeconds] = useState<number | null>(initialData?.roundRestSeconds ?? null)
  const [circuitRestSeconds, setCircuitRestSeconds] = useState<number | null>(initialData?.circuitRestSeconds ?? null)
  const exercises = allExercises
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [targetSessions, setTargetSessions] = useState<string>('')

  // Track which routine_exercise IDs existed at load time so we can soft-delete removed ones
  // (includes both main and paired secondary rows of bi-sets)
  const initialSetIds = useRef<Set<string>>(
    new Set(
      initialData?.blocks.flatMap((b) =>
        b.setRows.flatMap((r) => [r.id, r.secondaryId].filter(Boolean) as string[])
      ) ?? []
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

  function handleModeChange(circuit: boolean) {
    if (circuit && !isCircuit) {
      // Bi-sets aren't supported in circuit mode — drop them on conversion
      if (blocks.some((b) => b.secondary)) {
        toast.info('Bi-sets não são suportados no modo Circuito e foram removidos.')
      }
      // Switching Padrão → Circuito: collapse each block to `rounds` uniform rows.
      // Secondary (bi-set) fields are dropped so their DB rows get soft-deleted on save.
      setBlocks((prev) => prev.map((b) => {
        const first = b.setRows[0]
        return {
          ...b,
          secondary: undefined,
          setRows: Array.from({ length: rounds }, (_, i) => ({
            draftId: i === 0 && first ? first.draftId : crypto.randomUUID(),
            id: i === 0 ? first?.id : undefined,
            exerciseId: first?.exerciseId ?? '',
            variantLabel: first?.variantLabel ?? '',
          })),
        }
      }))
    }
    setIsCircuit(circuit)
  }

  function handleRoundsChange(newRounds: number) {
    if (newRounds < 1) return
    setRounds(newRounds)
    setBlocks((prev) => prev.map((b) => {
      const current = b.setRows
      if (newRounds > current.length) {
        const first = current[0]
        const toAdd = Array.from({ length: newRounds - current.length }, () => ({
          draftId: crypto.randomUUID(),
          exerciseId: first?.exerciseId ?? '',
          variantLabel: first?.variantLabel ?? '',
        }))
        return { ...b, setRows: [...current, ...toAdd] }
      }
      return { ...b, setRows: current.slice(0, newRounds) }
    }))
  }

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
        setRows: isCircuit
          ? Array.from({ length: rounds }, () => ({ draftId: crypto.randomUUID(), exerciseId: '', variantLabel: '' }))
          : [{ draftId: crypto.randomUUID(), exerciseId: '', variantLabel: '' }],
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
        setRows: isCircuit
          ? b.setRows.map((r) => ({ ...r, exerciseId, variantLabel }))
          : b.setRows.map((r, si) => si === setIndex ? { ...r, exerciseId, variantLabel } : r),
      }
    }))
  }

  function changeSecondaryVariant(blockIndex: number, setIndex: number, exerciseId: string, variantLabel: string) {
    setBlocks((prev) => prev.map((b, bi) => {
      if (bi !== blockIndex) return b
      return {
        ...b,
        setRows: b.setRows.map((r, si) =>
          si === setIndex ? { ...r, secondaryExerciseId: exerciseId, secondaryVariantLabel: variantLabel } : r
        ),
      }
    }))
  }

  function addSecondary(blockIndex: number, classInfo: { classId: string; className: string; isTimed: boolean }) {
    setBlocks((prev) => prev.map((b, i) =>
      i === blockIndex
        ? {
            ...b,
            secondary: {
              classId: classInfo.classId,
              className: classInfo.className,
              isTimed: classInfo.isTimed,
              targetReps: 10,
              targetSeconds: classInfo.isTimed ? 30 : null,
            },
            // reset per-set secondary variants for the new class
            setRows: b.setRows.map((r) => ({ ...r, secondaryExerciseId: '', secondaryVariantLabel: '' })),
          }
        : b
    ))
  }

  function removeSecondary(blockIndex: number) {
    // Drop secondary fields so their DB rows land in deletedIds and get soft-deleted
    setBlocks((prev) => prev.map((b, i) =>
      i === blockIndex
        ? {
            ...b,
            secondary: undefined,
            setRows: b.setRows.map((r) => ({
              ...r,
              secondaryId: undefined,
              secondaryExerciseId: undefined,
              secondaryVariantLabel: undefined,
            })),
          }
        : b
    ))
  }

  function updateSecondaryConfig(blockIndex: number, field: 'targetReps' | 'targetSeconds', value: number | null) {
    setBlocks((prev) => prev.map((b, i) =>
      i === blockIndex && b.secondary
        ? { ...b, secondary: { ...b.secondary, [field]: value } }
        : b
    ))
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
            ...(b.secondary
              ? {
                  secondaryExerciseId: last?.secondaryExerciseId ?? b.setRows[0]?.secondaryExerciseId ?? '',
                  secondaryVariantLabel: last?.secondaryVariantLabel ?? b.setRows[0]?.secondaryVariantLabel ?? '',
                }
              : {}),
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
    const hasUnselected = blocks.some((b) =>
      b.setRows.some((r) => !r.exerciseId || (b.secondary && !r.secondaryExerciseId))
    )
    if (hasUnselected) {
      toast.error('Selecione um exercício para cada série antes de salvar.')
      return
    }
    setSaving(true)

    let rid = routineId
    if (rid) {
      const { error } = await supabase.from('routines').update({ name, is_circuit: isCircuit, inter_exercise_rest_seconds: interExerciseRestSeconds ?? null, round_rest_seconds: roundRestSeconds ?? null, circuit_rest_seconds: circuitRestSeconds ?? null }).eq('id', rid)
      if (error) { toast.error('Não foi possível atualizar o treino.'); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('routines').insert({ name, is_circuit: isCircuit, inter_exercise_rest_seconds: interExerciseRestSeconds ?? null, round_rest_seconds: roundRestSeconds ?? null, circuit_rest_seconds: circuitRestSeconds ?? null, user_id: user?.id }).select().single()
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
    // (both main and paired secondary rows of bi-sets)
    const keptIds = new Set(
      blocks.flatMap((b) => b.setRows.flatMap((r) => [r.id, r.secondaryId].filter(Boolean) as string[]))
    )
    const deletedIds = [...initialSetIds.current].filter((id) => !keptIds.has(id))

    // Soft-delete removed rows
    if (deletedIds.length > 0) {
      const { error } = await supabase.from('routine_exercises')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', deletedIds)
      if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
    }

    // Build the flat list of routine_exercise rows to upsert/insert.
    // Each set produces one main row (superset_position 0) and, for bi-sets,
    // one paired secondary row (superset_position 1) sharing the same block_id.
    type Row = { id?: string; payload: Record<string, unknown> }
    const rows: Row[] = []
    for (const block of blocks) {
      // For new blocks (no blockId) we generate a stable block_id now
      const blockId = block.blockId ?? crypto.randomUUID()

      block.setRows.forEach((r, idx) => {
        const setNumber = idx + 1
        rows.push({
          id: r.id,
          payload: {
            routine_id: rid!,
            exercise_id: r.exerciseId,
            exercise_class_id: block.classId,
            block_id: blockId,
            set_number: setNumber,
            superset_position: 0,
            sets: block.setRows.length,
            target_reps: block.targetReps,
            target_seconds: block.targetSeconds ?? null,
            rest_seconds: block.restSeconds ?? null,
            display_order: block.displayOrder,
          },
        })
        if (block.secondary) {
          rows.push({
            id: r.secondaryId,
            payload: {
              routine_id: rid!,
              exercise_id: r.secondaryExerciseId!,
              exercise_class_id: block.secondary.classId,
              block_id: blockId,
              set_number: setNumber,
              superset_position: 1,
              sets: block.setRows.length,
              target_reps: block.secondary.targetReps,
              target_seconds: block.secondary.targetSeconds ?? null,
              rest_seconds: block.restSeconds ?? null,
              display_order: block.displayOrder,
            },
          })
        }
      })
    }

    const existingRows = rows.filter((r) => r.id)
    const newRows = rows.filter((r) => !r.id)

    if (existingRows.length > 0) {
      const { error } = await supabase.from('routine_exercises').upsert(
        existingRows.map((r) => ({ id: r.id!, ...r.payload, deleted_at: null }))
      )
      if (error) { toast.error('Não foi possível salvar os exercícios.'); setSaving(false); return }
    }

    if (newRows.length > 0) {
      const { error } = await supabase.from('routine_exercises').insert(
        newRows.map((r) => r.payload)
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

      <div className="space-y-2">
        <Label>Modo</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleModeChange(false)}
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
            onClick={() => handleModeChange(true)}
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

      {!isCircuit && (
        <div className="space-y-2">
          <Label>Descanso entre exercícios</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={interExerciseRestSeconds ?? ''}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                setInterExerciseRestSeconds(e.target.value === '' || isNaN(v) ? null : v)
              }}
              placeholder="—"
              className="w-20"
              min={1}
            />
            <span className="text-sm text-muted-foreground">s</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Substitui o descanso individual ao terminar cada exercício.
          </p>
        </div>
      )}

      {isCircuit && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Rodadas</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={roundsInput}
                onChange={(e) => {
                  setRoundsInput(e.target.value)
                  const v = parseInt(e.target.value)
                  if (!isNaN(v) && v >= 1) handleRoundsChange(v)
                }}
                onBlur={() => {
                  const v = parseInt(roundsInput)
                  if (isNaN(v) || v < 1) setRoundsInput(String(rounds))
                }}
                className="w-20"
                min={1}
              />
              <span className="text-sm text-muted-foreground">rodadas</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descanso entre exercícios</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={circuitRestSeconds ?? ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  setCircuitRestSeconds(e.target.value === '' || isNaN(v) ? null : v)
                }}
                placeholder="—"
                className="w-20"
                min={1}
              />
              <span className="text-sm text-muted-foreground">s</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descanso entre rodadas</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={roundRestSeconds ?? ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  setRoundRestSeconds(e.target.value === '' || isNaN(v) ? null : v)
                }}
                placeholder="—"
                className="w-20"
                min={1}
              />
              <span className="text-sm text-muted-foreground">s</span>
            </div>
          </div>
        </div>
      )}

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
                  allClasses={allClasses}
                  sensors={sensors}
                  isCircuit={isCircuit}
                  onUpdateConfig={updateConfig}
                  onUpdateSecondaryConfig={updateSecondaryConfig}
                  onChangeVariant={changeVariant}
                  onChangeSecondaryVariant={changeSecondaryVariant}
                  onAddSecondary={addSecondary}
                  onRemoveSecondary={removeSecondary}
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
