import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns today's date string (YYYY-MM-DD) in UTC-3 (Brazil Standard Time). */
export function todayBRT(): string {
  const now = new Date()
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().split('T')[0]
}

/** Strips diacritics and lowercases a string for accent-insensitive comparison. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Returns the current consecutive-day streak ending today (or yesterday).
 * Expects an array of unique YYYY-MM-DD date strings.
 */
export function computeCurrentStreak(uniqueDates: string[]): number {
  const sorted = [...uniqueDates].sort().reverse()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  let streak = 0
  let cursor = todayStr
  for (const date of sorted) {
    if (date === cursor) {
      streak++
      const d = new Date(cursor + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      cursor = d.toISOString().split('T')[0]
    } else break
  }
  return streak
}

/**
 * Returns the longest consecutive-day streak across all dates.
 * Expects an array of unique YYYY-MM-DD date strings.
 */
export function computeMaxStreak(uniqueDates: string[]): number {
  if (uniqueDates.length === 0) return 0
  const sorted = [...uniqueDates].sort()
  let max = 1
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays === 1) {
      current++
      if (current > max) max = current
    } else {
      current = 1
    }
  }
  return max
}
