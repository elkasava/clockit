'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Location, Shift, Expense } from '@/types/database'
import { TopNav } from '@/components/shared/TopNav'
import { ClockButton } from '@/components/worker/ClockButton'
import { ExpenseTracker } from '@/components/worker/ExpenseTracker'
import { DaySummary } from '@/components/worker/DaySummary'
import { formatDuration, formatCurrency, elapsedSeconds, laborCost } from '@/lib/utils'
import { Clock, TrendingUp, Receipt, Layers } from 'lucide-react'

type ShiftWithDetails = Shift & { locations: Location | null; expenses: Expense[] }

interface WorkerViewProps {
  profile: Profile
  locations: Location[]
  initialActiveShift: ShiftWithDetails | null
  initialTodayShifts: ShiftWithDetails[]
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
}

export function WorkerView({ profile, locations, initialActiveShift, initialTodayShifts }: WorkerViewProps) {
  const [activeShift, setActiveShift] = useState<ShiftWithDetails | null>(initialActiveShift)
  const [todayShifts, setTodayShifts] = useState<ShiftWithDetails[]>(initialTodayShifts)
  const supabase = createClient()

  const refreshData = useCallback(async () => {
    const [{ data: active }, { data: today }] = await Promise.all([
      supabase
        .from('shifts').select('*, locations(*), expenses(*)')
        .eq('user_id', profile.id).eq('status', 'active').maybeSingle(),
      supabase
        .from('shifts').select('*, locations(*), expenses(*)')
        .eq('user_id', profile.id)
        .gte('start_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('start_time', { ascending: false }),
    ])
    setActiveShift(active as ShiftWithDetails | null)
    setTodayShifts((today ?? []) as ShiftWithDetails[])
  }, [profile.id, supabase])

  const completedShifts = todayShifts.filter(s => s.status === 'completed')
  const totalSeconds = completedShifts.reduce((sum, s) => {
    if (!s.end_time) return sum
    return sum + Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000)
  }, 0)
  const totalExpenses = todayShifts.flatMap(s => s.expenses).reduce((sum, e) => sum + e.amount, 0)
  const totalLabor = laborCost(totalSeconds, profile.hourly_rate)
  const activeElapsed = activeShift ? elapsedSeconds(activeShift.start_time) : 0

  const firstName = profile.full_name?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const statCards = [
    { icon: Clock,      label: 'Time today',  value: formatDuration(totalSeconds), color: 'text-blue-400',   glow: 'stat-card-cyan',    bg: 'bg-blue-500/5' },
    { icon: TrendingUp, label: 'Labor earned', value: formatCurrency(totalLabor),   color: 'text-emerald-400',glow: 'stat-card-emerald', bg: 'bg-emerald-500/5', hide: profile.hourly_rate === 0 },
    { icon: Receipt,    label: 'Expenses',    value: formatCurrency(totalExpenses), color: 'text-amber-400',  glow: 'stat-card-amber',   bg: 'bg-amber-500/5' },
    { icon: Layers,     label: 'Shifts done', value: `${completedShifts.length}`,   color: 'text-violet-400', glow: 'stat-card-purple',  bg: 'bg-violet-500/5' },
  ].filter(c => !c.hide)

  return (
    <div className="obsidian-bg min-h-screen">
      <TopNav profile={profile} isActive={!!activeShift} />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Greeting */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show"
          className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting},{' '}
              <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="text-sm text-white/40 mt-1">
              {activeShift
                ? `On shift · ${locations.find(l => l.id === activeShift.location_id)?.name ?? '—'}`
                : 'Ready to start your shift?'}
            </p>
          </div>
          {activeShift && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400 font-timer tabular-nums">
                {formatDuration(activeElapsed)}
              </span>
            </div>
          )}
        </motion.div>

        {/* Stat cards */}
        {todayShifts.length > 0 && (
          <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statCards.map((card, i) => {
              const Icon = card.icon
              return (
                <div key={i} className={`glass-card ${card.glow} rounded-2xl p-4 space-y-3`}>
                  <div className={`h-8 w-8 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <div>
                    <p className="font-timer font-bold text-lg tabular-nums text-white/90">{card.value}</p>
                    <p className="text-xs text-white/35 mt-0.5">{card.label}</p>
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Clock panel */}
          <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show"
            className="lg:col-span-2 glass-card rounded-3xl p-8 flex flex-col items-center justify-center min-h-[420px]">
            <ClockButton
              profile={profile}
              locations={locations}
              activeShift={activeShift}
              onShiftChange={refreshData}
            />
          </motion.div>

          {/* Right column */}
          <div className="lg:col-span-3 space-y-4">
            {activeShift && (
              <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show">
                <ExpenseTracker
                  activeShift={activeShift}
                  expenses={activeShift.expenses}
                  onExpenseChange={refreshData}
                />
              </motion.div>
            )}
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show">
              <DaySummary shifts={todayShifts} profile={profile} />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  )
}
