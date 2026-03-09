'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Shift, Expense, Profile, Location } from '@/types/database'
import { formatDuration, formatCurrency, elapsedSeconds, laborCost } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, Euro, Receipt, MapPin, ChevronDown, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DaySummaryProps {
  shifts: (Shift & { locations: Location | null; expenses: Expense[] })[]
  profile: Profile
}

export function DaySummary({ shifts, profile }: DaySummaryProps) {
  const [expanded, setExpanded] = useState(false)
  if (shifts.length === 0) return null

  const completedShifts = shifts.filter(s => s.status === 'completed')
  const totalSeconds = completedShifts.reduce((sum, s) => {
    if (!s.end_time) return sum
    return sum + Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000)
  }, 0)
  const totalExpenses = shifts.flatMap(s => s.expenses).reduce((sum, e) => sum + e.amount, 0)
  const totalLabor = laborCost(totalSeconds, profile.hourly_rate)
  const grandTotal = totalLabor + totalExpenses
  const today = new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.025] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">Day Summary</p>
            <p className="text-xs text-white/35 capitalize">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile.hourly_rate > 0 && (
            <span className="font-timer text-sm font-bold text-emerald-400">{formatCurrency(grandTotal)}</span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-white/30 transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5">
              <Separator className="bg-white/[0.05]" />

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Clock,   label: 'Time worked', value: formatDuration(totalSeconds),  color: 'text-blue-400',    bg: 'bg-blue-500/8' },
                  { icon: Euro,    label: 'Labor',        value: formatCurrency(totalLabor),    color: 'text-emerald-400', bg: 'bg-emerald-500/8', hide: profile.hourly_rate === 0 },
                  { icon: Receipt, label: 'Expenses',     value: formatCurrency(totalExpenses), color: 'text-amber-400',   bg: 'bg-amber-500/8' },
                ].filter(s => !s.hide).map((stat, i) => {
                  const Icon = stat.icon
                  return (
                    <div key={i} className={`${stat.bg} rounded-xl p-3 text-center space-y-1.5`}>
                      <Icon className={`h-4 w-4 ${stat.color} mx-auto`} />
                      <p className={`font-timer text-sm font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] text-white/30">{stat.label}</p>
                    </div>
                  )
                })}
              </div>

              {profile.hourly_rate > 0 && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                  <span className="text-sm text-white/60">Total to reimburse</span>
                  <span className="font-timer font-bold text-emerald-400 text-base">{formatCurrency(grandTotal)}</span>
                </div>
              )}

              <Separator className="bg-white/[0.05]" />

              {/* Per-shift list */}
              <div className="space-y-3">
                {shifts.map((shift, i) => {
                  const shiftSecs = shift.end_time
                    ? Math.floor((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 1000)
                    : elapsedSeconds(shift.start_time)
                  const shiftExp = shift.expenses.reduce((s, e) => s + e.amount, 0)
                  const isLive = shift.status === 'active'
                  return (
                    <div key={shift.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn('h-2 w-2 rounded-full shrink-0', isLive ? 'bg-emerald-500 animate-pulse' : 'bg-white/15')} />
                          <MapPin className="h-3 w-3 text-white/30 shrink-0" />
                          <span className="text-sm text-white/75 truncate">{shift.locations?.name ?? '—'}</span>
                          <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0 border', isLive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/35 border-white/10')}>
                            {isLive ? 'Live' : 'Done'}
                          </Badge>
                        </div>
                        <span className="font-timer text-xs text-white/40 tabular-nums shrink-0">{formatDuration(shiftSecs)}</span>
                      </div>
                      {shiftExp > 0 && (
                        <p className="text-xs text-amber-400/60 pl-6 font-timer">+ {formatCurrency(shiftExp)} expenses</p>
                      )}
                      {i < shifts.length - 1 && <Separator className="mt-2 bg-white/[0.04]" />}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/8 text-xs text-white/40 hover:text-white/70 hover:border-white/16 hover:bg-white/4 transition-all font-medium"
              >
                <Printer className="h-3.5 w-3.5" />
                Export / Print PDF
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
