'use client'

import { useState, useMemo } from 'react'
import { Plus, X, Check, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExerciseClass } from '@/app/library/page'

type Props = {
  classes: ExerciseClass[]
  isAdmin: boolean
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function LibraryClient({ classes: initialClasses, isAdmin }: Props) {
  const [classes, setClasses] = useState(initialClasses)
  const [search, setSearch] = useState('')
  const [addingToClass, setAddingToClass] = useState<string | null>(null)
  const [newVariant, setNewVariant] = useState('')
  const [showNewClass, setShowNewClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassVariant, setNewClassVariant] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return classes
    const q = normalize(search)
    return classes
      .map((cls) => ({
        ...cls,
        exercises: cls.exercises.filter(
          (e) => normalize(e.variant).includes(q) || normalize(cls.name).includes(q)
        ),
      }))
      .filter((cls) => cls.exercises.length > 0 || normalize(cls.name).includes(q))
  }, [classes, search])

  function startAddVariant(classId: string) {
    setAddingToClass(classId)
    setNewVariant('')
  }

  function cancelAddVariant() {
    setAddingToClass(null)
    setNewVariant('')
  }

  async function saveVariant(classId: string) {
    const variant = newVariant.trim()
    if (!variant) return
    setSaving(true)
    const { data, error } = await supabase
      .from('exercises')
      .insert({ class_id: classId, variant })
      .select('id, variant')
      .single()
    if (error) {
      toast.error('Erro ao adicionar variante.')
    } else {
      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === classId
            ? {
                ...cls,
                exercises: [...cls.exercises, data]
                  .sort((a, b) => a.variant.localeCompare(b.variant)),
              }
            : cls
        )
      )
      setAddingToClass(null)
      setNewVariant('')
      toast.success('Variante adicionada!')
    }
    setSaving(false)
  }

  async function deleteVariant(classId: string, exerciseId: string, variant: string) {
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
    if (error) {
      toast.error('Erro ao remover variante.')
    } else {
      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === classId
            ? { ...cls, exercises: cls.exercises.filter((e) => e.id !== exerciseId) }
            : cls
        )
      )
      toast.success(`${variant} removida.`)
    }
  }

  async function saveNewClass() {
    const name = newClassName.trim()
    const variant = newClassVariant.trim()
    if (!name || !variant) return
    setSaving(true)

    const { data: cls, error: clsError } = await supabase
      .from('exercise_classes')
      .insert({ name })
      .select('id, name')
      .single()
    if (clsError) {
      toast.error('Erro ao criar classe.')
      setSaving(false)
      return
    }

    const { data: ex, error: exError } = await supabase
      .from('exercises')
      .insert({ class_id: cls.id, variant })
      .select('id, variant')
      .single()
    if (exError) {
      toast.error('Erro ao criar variante.')
      setSaving(false)
      return
    }

    setClasses((prev) =>
      [...prev, { id: cls.id, name: cls.name, exercises: [ex] }]
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    setShowNewClass(false)
    setNewClassName('')
    setNewClassVariant('')
    toast.success(`${cls.name} criada!`)
    setSaving(false)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Biblioteca</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeleteMode((d) => !d)}
              className={[
                'p-1.5 rounded-lg transition-colors',
                deleteMode
                  ? 'bg-destructive/10 text-destructive'
                  : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
              ].join(' ')}
              aria-label="Modo de exclusão"
              title={deleteMode ? 'Sair do modo de exclusão' : 'Modo de exclusão'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {!showNewClass && (
              <button
                onClick={() => setShowNewClass(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova classe
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício…"
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* New class form */}
      {showNewClass && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nova classe de exercício</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Nome da classe (ex: Panturrilha)"
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
            <input
              value={newClassVariant}
              onChange={(e) => setNewClassVariant(e.target.value)}
              placeholder="Primeira variante (ex: Individual)"
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => e.key === 'Enter' && saveNewClass()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowNewClass(false); setNewClassName(''); setNewClassVariant('') }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button
                onClick={saveNewClass}
                disabled={saving || !newClassName.trim() || !newClassVariant.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Criar
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exercise classes */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum exercício encontrado.</p>
      ) : (
        filtered.map((cls) => (
          <div key={cls.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{cls.name}</h2>
              {isAdmin && addingToClass !== cls.id && (
                <button
                  onClick={() => startAddVariant(cls.id)}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label={`Adicionar variante a ${cls.name}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              {cls.exercises.map((ex) => (
                <div
                  key={ex.id}
                  className={[
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    deleteMode ? 'bg-destructive/5' : 'bg-muted/40 hover:bg-muted text-foreground',
                  ].join(' ')}
                >
                  <span>{ex.variant}</span>
                  {isAdmin && deleteMode && (
                    <button
                      onClick={() => deleteVariant(cls.id, ex.id, ex.variant)}
                      className="text-destructive hover:text-destructive/70 transition-colors"
                      aria-label={`Remover ${ex.variant}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Inline add variant row */}
              {addingToClass === cls.id && (
                <div className="flex gap-2 pt-1">
                  <input
                    value={newVariant}
                    onChange={(e) => setNewVariant(e.target.value)}
                    placeholder="Nome da variante"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveVariant(cls.id)
                      if (e.key === 'Escape') cancelAddVariant()
                    }}
                  />
                  <button
                    onClick={() => saveVariant(cls.id)}
                    disabled={saving || !newVariant.trim()}
                    className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    aria-label="Salvar variante"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelAddVariant}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    aria-label="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </main>
  )
}
