'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Table2, Rows3, ChevronLeft } from 'lucide-react'

// ── Shared shapes (built server-side, passed as plain data) ─────────────────────

export type TableCell = {
  setNumber: number
  variant: string
  reps: number | null // rep-based actual reps; null for timed
  weightKg: number | null
  durationSec: number | null
  isTimed: boolean
}

export type TableColumn = {
  key: string
  className: string
  isTimed: boolean
  hasWeight: boolean
}

export type TableRow = {
  sessionId: string
  date: string
  durationSec: number | null
  cells: Record<string, TableCell[]>
}

export type RoutineTable = {
  routineId: string
  name: string
  archived: boolean
  columns: TableColumn[]
  rows: TableRow[]
}

type Props = { tables: RoutineTable[] }
type Mode = 'compact' | 'detailed'
type SubCol = 'variant' | 'reps' | 'weight' | 'duration'

// ── Formatting ──────────────────────────────────────────────────────────────────

function fmtSeconds(s: number | null): string {
  if (s == null) return '—'
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${s}s`
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function subColsFor(col: TableColumn): SubCol[] {
  const cols: SubCol[] = ['variant']
  if (!col.isTimed) cols.push('reps')
  if (col.hasWeight) cols.push('weight')
  cols.push('duration')
  return cols
}

const SUB_LABEL: Record<SubCol, string> = {
  variant: 'Var',
  reps: 'Reps',
  weight: 'kg',
  duration: 'Tempo',
}

// Value of one sub-column for a single set
function cellValue(c: TableCell, sc: SubCol): string {
  switch (sc) {
    case 'variant':
      return c.variant
    case 'reps':
      return c.reps == null ? '—' : String(c.reps)
    case 'weight':
      return c.weightKg == null ? '—' : String(c.weightKg)
    case 'duration':
      return fmtSeconds(c.durationSec)
  }
}

// Joined value across all sets of a block for the compact view
function joinedValue(cells: TableCell[], sc: SubCol): string {
  if (cells.length === 0) return '—'
  if (sc === 'variant') {
    const variants = cells.map((c) => c.variant)
    const uniq = [...new Set(variants)]
    return uniq.length <= 1 ? uniq[0] ?? '—' : variants.join(' / ')
  }
  return cells.map((c) => cellValue(c, sc)).join(' / ')
}

// ── CSV ─────────────────────────────────────────────────────────────────────────

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function downloadCsv(filename: string, rows: string[][]) {
  // BOM so Excel renders accents (Flexão, Cadeirinha) correctly
  const csv = '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
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
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'treino'
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
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
  const [mode, setMode] = useState<Mode>('compact')

  if (tables.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">Nenhum treino com sessões registradas ainda.</p>
      </div>
    )
  }

  // ── CSV builders ────────────────────────────────────────────────────────────
  function exportDetail(table: RoutineTable) {
    const header1: string[] = ['Data']
    if (mode === 'detailed') header1.push('Série')
    for (const col of table.columns) {
      for (const sc of subColsFor(col)) header1.push(`${col.className} · ${SUB_LABEL[sc]}`)
    }
    const out: string[][] = [header1]

    for (const row of table.rows) {
      if (mode === 'compact') {
        const line = [fmtDate(row.date)]
        for (const col of table.columns) {
          const cells = row.cells[col.key] ?? []
          for (const sc of subColsFor(col)) line.push(joinedValue(cells, sc))
        }
        out.push(line)
      } else {
        const maxSets = Math.max(
          0,
          ...table.columns.map((col) => (row.cells[col.key] ?? []).length)
        )
        for (let i = 0; i < maxSets; i++) {
          const line = [fmtDate(row.date), String(i + 1)]
          for (const col of table.columns) {
            const c = (row.cells[col.key] ?? [])[i]
            for (const sc of subColsFor(col)) line.push(c ? cellValue(c, sc) : '')
          }
          out.push(line)
        }
      }
    }
    downloadCsv(`${slugify(table.name)}-series-${todayStr()}.csv`, out)
  }

  function exportTotals(table: RoutineTable) {
    const header: string[] = ['Data', 'Duração']
    for (const col of table.columns) {
      header.push(`${col.className} · Séries`)
      if (!col.isTimed) header.push(`${col.className} · Reps`)
      if (col.hasWeight) header.push(`${col.className} · Volume`)
      header.push(`${col.className} · Tempo`)
    }
    const out: string[][] = [header]
    for (const row of table.rows) {
      const line = [fmtDate(row.date), fmtSeconds(row.durationSec)]
      for (const col of table.columns) {
        const cells = row.cells[col.key] ?? []
        line.push(String(cells.length))
        if (!col.isTimed) line.push(String(cells.reduce((a, c) => a + (c.reps ?? 0), 0)))
        if (col.hasWeight)
          line.push(String(cells.reduce((a, c) => a + (c.reps ?? 0) * (c.weightKg ?? 0), 0)))
        line.push(fmtSeconds(cells.reduce((a, c) => a + (c.durationSec ?? 0), 0) || null))
      }
      out.push(line)
    }
    downloadCsv(`${slugify(table.name)}-totais-${todayStr()}.csv`, out)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <BackLink />
          <h1 className="text-3xl font-bold tracking-tight mt-1">Tabelas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Histórico de sessões por treino · exporte para CSV
          </p>
        </div>
        {/* Compacto / Detalhado toggle */}
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-card shrink-0">
          <button
            onClick={() => setMode('compact')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Table2 className="w-4 h-4" /> Compacto
          </button>
          <button
            onClick={() => setMode('detailed')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'detailed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Rows3 className="w-4 h-4" /> Detalhado
          </button>
        </div>
      </div>

      {tables.map((table) => (
        <section key={table.routineId} className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{table.name}</h2>
            {table.archived && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Arquivado</span>
            )}
            <span className="text-xs text-muted-foreground">
              {table.rows.length} sessã{table.rows.length === 1 ? 'o' : 'es'}
            </span>
          </div>

          {/* Detail table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {mode === 'compact' ? 'Séries (compacto)' : 'Séries (detalhado)'}
              </span>
              <button
                onClick={() => exportDetail(table)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              {mode === 'compact'
                ? renderCompact(table)
                : renderDetailed(table)}
            </div>
          </div>

          {/* Totals table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Totais</span>
              <button
                onClick={() => exportTotals(table)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">{renderTotals(table)}</div>
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Table renderers ───────────────────────────────────────────────────────────

const TH = 'px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border'
const TD = 'px-2 py-1.5 text-sm whitespace-nowrap tabular-nums border-b border-border/60'
const CELL_BORDER = 'border-l border-border/60'

function renderCompact(table: RoutineTable) {
  return (
    <table className="min-w-full text-left border-collapse">
      <thead>
        <tr>
          <th rowSpan={2} className={`${TH} sticky left-0 bg-card z-10`}>Data</th>
          {table.columns.map((col) => (
            <th key={col.key} colSpan={subColsFor(col).length} className={`${TH} text-center ${CELL_BORDER}`}>
              {col.className}
            </th>
          ))}
        </tr>
        <tr>
          {table.columns.flatMap((col) =>
            subColsFor(col).map((sc, i) => (
              <th key={`${col.key}-${sc}`} className={`${TH} ${i === 0 ? CELL_BORDER : ''}`}>
                {SUB_LABEL[sc]}
              </th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.sessionId} className="hover:bg-muted/30">
            <td className={`${TD} font-medium sticky left-0 bg-card`}>{fmtDate(row.date)}</td>
            {table.columns.map((col) => {
              const cells = row.cells[col.key] ?? []
              return subColsFor(col).map((sc, i) => (
                <td key={`${col.key}-${sc}`} className={`${TD} ${i === 0 ? CELL_BORDER : ''}`}>
                  {joinedValue(cells, sc)}
                </td>
              ))
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function renderDetailed(table: RoutineTable) {
  return (
    <table className="min-w-full text-left border-collapse">
      <thead>
        <tr>
          <th rowSpan={2} className={`${TH} sticky left-0 bg-card z-10`}>Data</th>
          <th rowSpan={2} className={TH}>Série</th>
          {table.columns.map((col) => (
            <th key={col.key} colSpan={subColsFor(col).length} className={`${TH} text-center ${CELL_BORDER}`}>
              {col.className}
            </th>
          ))}
        </tr>
        <tr>
          {table.columns.flatMap((col) =>
            subColsFor(col).map((sc, i) => (
              <th key={`${col.key}-${sc}`} className={`${TH} ${i === 0 ? CELL_BORDER : ''}`}>
                {SUB_LABEL[sc]}
              </th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => {
          const maxSets = Math.max(0, ...table.columns.map((col) => (row.cells[col.key] ?? []).length))
          return Array.from({ length: maxSets }, (_, i) => (
            <tr key={`${row.sessionId}-${i}`} className="hover:bg-muted/30">
              {i === 0 && (
                <td rowSpan={maxSets} className={`${TD} font-medium align-top sticky left-0 bg-card`}>
                  {fmtDate(row.date)}
                </td>
              )}
              <td className={`${TD} text-muted-foreground`}>{i + 1}</td>
              {table.columns.map((col) => {
                const c = (row.cells[col.key] ?? [])[i]
                return subColsFor(col).map((sc, si) => (
                  <td key={`${col.key}-${sc}`} className={`${TD} ${si === 0 ? CELL_BORDER : ''}`}>
                    {c ? cellValue(c, sc) : ''}
                  </td>
                ))
              })}
            </tr>
          ))
        })}
      </tbody>
    </table>
  )
}

function renderTotals(table: RoutineTable) {
  return (
    <table className="min-w-full text-left border-collapse">
      <thead>
        <tr>
          <th rowSpan={2} className={`${TH} sticky left-0 bg-card z-10`}>Data</th>
          <th rowSpan={2} className={TH}>Duração</th>
          {table.columns.map((col) => {
            const n = 2 + (col.isTimed ? 0 : 1) + (col.hasWeight ? 1 : 0)
            return (
              <th key={col.key} colSpan={n} className={`${TH} text-center ${CELL_BORDER}`}>
                {col.className}
              </th>
            )
          })}
        </tr>
        <tr>
          {table.columns.flatMap((col) => {
            const heads = [<th key={`${col.key}-s`} className={`${TH} ${CELL_BORDER}`}>Séries</th>]
            if (!col.isTimed) heads.push(<th key={`${col.key}-r`} className={TH}>Reps</th>)
            if (col.hasWeight) heads.push(<th key={`${col.key}-v`} className={TH}>Volume</th>)
            heads.push(<th key={`${col.key}-t`} className={TH}>Tempo</th>)
            return heads
          })}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.sessionId} className="hover:bg-muted/30">
            <td className={`${TD} font-medium sticky left-0 bg-card`}>{fmtDate(row.date)}</td>
            <td className={TD}>{fmtSeconds(row.durationSec)}</td>
            {table.columns.map((col) => {
              const cells = row.cells[col.key] ?? []
              const reps = cells.reduce((a, c) => a + (c.reps ?? 0), 0)
              const volume = cells.reduce((a, c) => a + (c.reps ?? 0) * (c.weightKg ?? 0), 0)
              const dur = cells.reduce((a, c) => a + (c.durationSec ?? 0), 0) || null
              const tds = [
                <td key={`${col.key}-s`} className={`${TD} ${CELL_BORDER}`}>{cells.length || '—'}</td>,
              ]
              if (!col.isTimed) tds.push(<td key={`${col.key}-r`} className={TD}>{reps || '—'}</td>)
              if (col.hasWeight) tds.push(<td key={`${col.key}-v`} className={TD}>{volume || '—'}</td>)
              tds.push(<td key={`${col.key}-t`} className={TD}>{fmtSeconds(dur)}</td>)
              return tds
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
