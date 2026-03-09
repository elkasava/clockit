import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format seconds → "HH:MM:SS" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

/** Format seconds → human-readable "2h 15m" */
export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Format currency */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency }).format(amount)
}

/** Elapsed seconds from an ISO start_time */
export function elapsedSeconds(startTime: string): number {
  return Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
}

/** Labor cost = hours * hourly_rate */
export function laborCost(elapsedSecs: number, hourlyRate: number): number {
  return (elapsedSecs / 3600) * hourlyRate
}
