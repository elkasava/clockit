'use client'

import { useEffect, useState } from 'react'
import type { Profile, Location, Expense } from '@/types/database'
import { formatDuration, formatCurrency, elapsedSeconds, laborCost } from '@/lib/utils'
import { MapPin, Clock, Euro, Receipt } from 'lucide-react'
import { motion } from 'framer-motion'

interface LiveShift {
  id: string
  user_id: string
  location_id: string | null
  start_time: string
  status: string
  profiles: Profile
  locations: Location | null
  expenses: Expense[]
}

interface LiveShiftCardProps {
  shift: LiveShift
}

const WORKDAY_SECS = 8 * 3600

export function LiveShiftCard({ shift }: LiveShiftCardProps) {
  const [elapsed, setElapsed] = useState(elapsedSeconds(shift.start_time))

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(elapsedSeconds(shift.start_time))
    }, 1000)
    return () => clearInterval(interval)
  }, [shift.start_time])

  const initials = (shift.profiles.full_name ?? shift.profiles.email)
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const totalExpenses = shift.expenses.reduce((s, e) => s + e.amount, 0)
  const currentLabor  = laborCost(elapsed, shift.profiles.hourly_rate)
  const progress      = Math.min(elapsed / WORKDAY_SECS, 1)

  const progressColor =
    progress < 0.75 ? '#10b981' :
    progress < 0.95 ? '#f59e0b' : '#ef4444'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="glass-card rounded-2xl p-4 space-y-3"
    >
      {/* Top row: avatar + name + Live badge */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <span className="text-sm font-bold text-emerald-400">{initials}</span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#0A0D14] animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90 truncate">
            {shift.profiles.full_name ?? shift.profiles.email}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-white/25 shrink-0" />
            <span className="text-xs text-white/40 truncate">
              {shift.locations?.name ?? 'Unknown location'}
            </span>
          </div>
        </div>

        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          LIVE
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: progressColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className="text-[10px] text-white/25 text-right">
          {Math.round(progress * 100)}% of 8h shift
        </p>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/8 flex-1">
          <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="font-timer text-sm font-semibold tabular-nums text-blue-400">
            {formatDuration(elapsed)}
          </span>
        </div>

        {shift.profiles.hourly_rate > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/8 flex-1">
            <Euro className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <motion.span
              key={Math.floor(currentLabor * 10)}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="font-timer text-sm font-semibold tabular-nums text-emerald-400"
            >
              {formatCurrency(currentLabor)}
            </motion.span>
          </div>
        )}

        {totalExpenses > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/8">
            <Receipt className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-timer text-sm font-semibold tabular-nums text-amber-400">
              {formatCurrency(totalExpenses)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
