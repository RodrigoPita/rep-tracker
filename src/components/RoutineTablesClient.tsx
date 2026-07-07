'use client'

import Link from 'next/link'
import { Download, ChevronLeft } from 'lucide-react'

// ── Shared shapes (built server-side, passed as plain data) ─────────────────────

export type SetEntry = {
  className: string
  variant: string
  setNumber: number
  reps: number | null // rep-based actual reps; null for timed
  weightKg: number | null
  durationSec: number | null
  isTimed: boolean
}

export type SessionRow = {
  sessionId: string
  date: string
  durationSec: number | null
  sets: SetEntry[] // ordered by block → set number → main/secondary
}

export type RoutineTable = {
  routineId: string
  name: string
  archived: boolean
  hasWeight: boolean
  sessions: SessionRow[] // newest first
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
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function num(n: number | null): string {
  return n == null ? '—' : String(n)
}

// ── CSV ─────────────────────────────────────────────────────────────────────────

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  // BOM so Excel renders accents (Flexão, Cadeirinha) correctly
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

// Per-session aggregates for the Totais table
function totalsFor(session: SessionRow) {
  const series = session.sets.length
  const reps = session.sets.reduce((a, s) => a + (s.reps ?? 0), 0)
  const volume = session.sets.reduce((a, s) => a + (s.reps ?? 0) * (s.weightKg ?? 0), 0)
  return { series, reps, volume }
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

  function exportSets(table: RoutineTable) {
    const rows: (string | number)[][] = [
      ['Data', 'Exercício', 'Variante', 'Série', 'Reps', 'Carga (kg)', 'Duração (s)'],
    ]
    for (const session of table.sessions) {
      for (const s of session.sets) {
        rows.push([
          session.date,
          s.className,
          s.variant,
          s.setNumber,
          s.reps ?? '',
          s.weightKg ?? '',
          s.durationSec ?? '',
        ])
      }
    }
    downloadCsv(`${slugify(table.name)}-series-${todayStr()}.csv`, rows)
  }

  function exportTotals(table: RoutineTable) {
    const rows: (string | number)[][] = [['Data', 'Séries', 'Reps', 'Volume (kg)', 'Duração (s)']]
    for (const session of table.sessions) {
      const t = totalsFor(session)
      rows.push([session.date, t.series, t.reps, t.volume, session.durationSec ?? ''])
    }
    downloadCsv(`${slugify(table.name)}-totais-${todayStr()}.csv`, rows)
  }

  return (
    <div className="space-y-8">
      <div>
        <BackLink />
        <h1 className="text-3xl font-bold tracking-tight mt-1">Tabelas</h1>
        <p className="text-muted-foreground mt-1 text-sm">Histórico de sessões por treino · exporte para CSV</p>
      </div>

      {tables.map((table) => (
        <section key={table.routineId} className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{table.name}</h2>
            {table.archived && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Arquivado</span>
            )}
            <span className="text-xs text-muted-foreground">
              {table.sessions.length} sessã{table.sessions.length === 1 ? 'o' : 'es'}
            </span>
          </div>

          {/* Séries — one row per set */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Séries</span>
              <button
                onClick={() => exportSets(table)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className={TH}>Data</th>
                    <th className={TH}>Exercício</th>
                    <th className={TH}>Variante</th>
                    <th className={`${TH} text-center`}>Sé</th>
                    <th className={`${TH} text-right`}>Reps</th>
                    {table.hasWeight && <th className={`${TH} text-right`}>Carga</th>}
                    <th className={`${TH} text-right`}>Tempo</th>
                  </tr>
                </thead>
                {table.sessions.map((session, si) => (
                  <tbody key={session.sessionId} className={si > 0 ? 'border-t-2 border-border' : ''}>
                    {(session.sets.length > 0 ? session.sets : [null]).map((s, ri) => (
                      <tr key={ri} className="hover:bg-muted/30">
                        {ri === 0 && (
                          <td
                            rowSpan={Math.max(1, session.sets.length)}
                            className={`${TD} font-medium align-top whitespace-nowrap tabular-nums`}
                          >
                            {fmtDate(session.date)}
                          </td>
                        )}
                        {s ? (
                          <>
                            <td className={`${TD} whitespace-nowrap`}>{s.className}</td>
                            <td className={`${TD} text-muted-foreground whitespace-nowrap`}>{s.variant}</td>
                            <td className={`${TD} text-center text-muted-foreground tabular-nums`}>{s.setNumber}</td>
                            <td className={`${TD} text-right tabular-nums`}>{num(s.reps)}</td>
                            {table.hasWeight && <td className={`${TD} text-right tabular-nums`}>{num(s.weightKg)}</td>}
                            <td className={`${TD} text-right tabular-nums text-muted-foreground`}>
                              {fmtSeconds(s.durationSec)}
                            </td>
                          </>
                        ) : (
                          <td className={`${TD} text-muted-foreground`} colSpan={table.hasWeight ? 5 : 4}>
                            —
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>

          {/* Totais — one row per session */}
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className={TH}>Data</th>
                    <th className={`${TH} text-right`}>Séries</th>
                    <th className={`${TH} text-right`}>Reps</th>
                    {table.hasWeight && <th className={`${TH} text-right`}>Volume</th>}
                    <th className={`${TH} text-right`}>Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {table.sessions.map((session) => {
                    const t = totalsFor(session)
                    return (
                      <tr key={session.sessionId} className="hover:bg-muted/30 border-t border-border/60">
                        <td className={`${TD} font-medium whitespace-nowrap tabular-nums`}>{fmtDate(session.date)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{t.series}</td>
                        <td className={`${TD} text-right tabular-nums`}>{t.reps || '—'}</td>
                        {table.hasWeight && <td className={`${TD} text-right tabular-nums`}>{t.volume || '—'}</td>}
                        <td className={`${TD} text-right tabular-nums text-muted-foreground`}>
                          {fmtSeconds(session.durationSec)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

const TH = 'px-3 py-2 font-semibold whitespace-nowrap border-b border-border'
const TD = 'px-3 py-1.5 border-b border-border/40'
