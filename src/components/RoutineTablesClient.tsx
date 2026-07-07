'use client'

import Link from 'next/link'
import { Download, ChevronLeft } from 'lucide-react'

// ── Shared shapes (built server-side, passed as plain data) ─────────────────────

export type GridCell = {
  isTimed: boolean
  values: number[] // per-set reps (rep-based) or seconds (timed)
  weights: (number | null)[]
  durs: (number | null)[] // per-set duration in seconds
}

export type ExerciseRow = {
  key: string
  className: string
  variant: string // '' if the block mixes variants across sets
  isTimed: boolean
  isSecondary: boolean // bi-set secondary
}

export type SessionCol = {
  sessionId: string
  date: string
  durationSec: number | null
}

export type RoutineTable = {
  routineId: string
  name: string
  archived: boolean
  hasWeight: boolean
  rows: ExerciseRow[]
  sessions: SessionCol[] // newest first
  cells: Record<string, Record<string, GridCell>> // [rowKey][sessionId]
}

type Props = { tables: RoutineTable[] }

// ── Formatting ──────────────────────────────────────────────────────────────────

function fmtSeconds(s: number | null): string {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${s}s`
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Compact cell value: uniform → "3×10" / "3×30s"; varied → "3×8–10" (count × range).
// Weight appended when present ("· 20kg" or "· 20–25kg").
function fmtCell(cell: GridCell | undefined): string {
  if (!cell || cell.values.length === 0) return ''
  const unit = cell.isTimed ? 's' : ''
  const v = cell.values
  const n = v.length
  const lo = Math.min(...v)
  const hi = Math.max(...v)
  const main = lo === hi ? `${n}×${lo}${unit}` : `${n}×${lo}–${hi}${unit}`

  const w = cell.weights.filter((x): x is number => x != null)
  if (w.length === 0) return main
  const wlo = Math.min(...w)
  const whi = Math.max(...w)
  const wPart = wlo === whi ? `${wlo}kg` : `${wlo}–${whi}kg`
  return `${main} · ${wPart}`
}

// ── CSV (flat long format) ────────────────────────────────────────────────────

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = '﻿' + rows.map((r) => r.map((c) => csvEscape(String(c))).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'treino'
  )
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function rowLabel(row: ExerciseRow): string {
  return row.variant && row.variant !== row.className ? `${row.className} · ${row.variant}` : row.className
}

function BackLink() {
  return (
    <Link
      href="/routines"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft className="w-4 h-4" />
      Treinos
    </Link>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────────

export default function RoutineTablesClient({ tables }: Props) {
  if (tables.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">Nenhum treino com sessões registradas ainda.</p>
      </div>
    )
  }

  // Flat long-format CSV: one row per set, ordered by session (newest first) → exercise → set
  function exportCsv(table: RoutineTable) {
    const out: (string | number)[][] = [
      ['Data', 'Exercício', 'Variante', 'Série', 'Reps', 'Carga (kg)', 'Duração (s)'],
    ]
    for (const session of table.sessions) {
      for (const row of table.rows) {
        const cell = table.cells[row.key]?.[session.sessionId]
        if (!cell) continue
        for (let i = 0; i < cell.values.length; i++) {
          out.push([
            session.date,
            row.className,
            row.variant || row.className,
            i + 1,
            cell.isTimed ? '' : cell.values[i],
            cell.weights[i] ?? '',
            cell.durs[i] ?? '',
          ])
        }
      }
    }
    downloadCsv(`${slugify(table.name)}-${todayStr()}.csv`, out)
  }

  return (
    <div className="space-y-8">
      <div>
        <BackLink />
        <h1 className="text-3xl font-bold tracking-tight mt-1">Tabelas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Compare suas sessões por treino · role para os lados para ver sessões anteriores
        </p>
      </div>

      {tables.map((table) => {
        // per-session footer aggregates
        const seriesTotals = table.sessions.map((s) =>
          table.rows.reduce((a, r) => a + (table.cells[r.key]?.[s.sessionId]?.values.length ?? 0), 0)
        )
        const volumeTotals = table.sessions.map((s) =>
          table.rows.reduce((a, r) => {
            const c = table.cells[r.key]?.[s.sessionId]
            if (!c) return a
            return a + c.values.reduce((sum, v, i) => sum + (c.isTimed ? 0 : v) * (c.weights[i] ?? 0), 0)
          }, 0)
        )

        return (
          <section key={table.routineId} className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{table.name}</h2>
              {table.archived && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Arquivado</span>
              )}
              <span className="text-xs text-muted-foreground">
                {table.sessions.length} sessã{table.sessions.length === 1 ? 'o' : 'es'}
              </span>
              <button
                onClick={() => exportCsv(table)}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            <div className="rounded-xl border bg-card overflow-x-auto">
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={`${TH} sticky left-0 bg-card z-10 text-left min-w-[9rem]`}>Exercício</th>
                    {table.sessions.map((s) => (
                      <th key={s.sessionId} className={`${TH} text-right tabular-nums min-w-[4.5rem]`}>
                        {fmtDate(s.date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.key} className="hover:bg-muted/30">
                      <th
                        className={[
                          TD,
                          'sticky left-0 bg-card z-10 text-left font-medium whitespace-nowrap',
                          row.isSecondary ? 'pl-5 text-muted-foreground font-normal' : '',
                        ].join(' ')}
                      >
                        {row.isSecondary ? '+ ' : ''}
                        {rowLabel(row)}
                      </th>
                      {table.sessions.map((s) => {
                        const cell = table.cells[row.key]?.[s.sessionId]
                        const text = fmtCell(cell)
                        return (
                          <td key={s.sessionId} className={`${TD} text-right tabular-nums ${text ? '' : 'text-muted-foreground/40'}`}>
                            {text || '·'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <th className={`${TD} sticky left-0 bg-card z-10 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide`}>
                      Séries
                    </th>
                    {seriesTotals.map((n, i) => (
                      <td key={i} className={`${TD} text-right tabular-nums text-muted-foreground`}>{n}</td>
                    ))}
                  </tr>
                  {table.hasWeight && (
                    <tr>
                      <th className={`${TD} sticky left-0 bg-card z-10 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide`}>
                        Volume
                      </th>
                      {volumeTotals.map((v, i) => (
                        <td key={i} className={`${TD} text-right tabular-nums text-muted-foreground`}>{v || '—'}</td>
                      ))}
                    </tr>
                  )}
                  <tr>
                    <th className={`${TD} sticky left-0 bg-card z-10 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide`}>
                      Duração
                    </th>
                    {table.sessions.map((s) => (
                      <td key={s.sessionId} className={`${TD} text-right tabular-nums text-muted-foreground`}>
                        {fmtSeconds(s.durationSec)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

const TH = 'px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border'
const TD = 'px-3 py-1.5 border-b border-border/40 whitespace-nowrap'
