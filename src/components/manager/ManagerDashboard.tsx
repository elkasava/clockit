'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Location, Expense, Shift } from '@/types/database'
import { TopNav } from '@/components/shared/TopNav'
import { LiveShiftCard } from './LiveShiftCard'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDurationShort, laborCost, elapsedSeconds } from '@/lib/utils'
import {
  Users, Clock, Euro, Receipt, Activity,
  TrendingUp, MapPin, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type LiveShift      = Shift & { profiles: Profile; locations: Location | null; expenses: Expense[] }
type CompletedShift = Shift & { profiles: Profile; locations: Location | null; expenses: Expense[] }

interface ManagerDashboardProps {
  managerProfile:       Profile
  initialLiveShifts:    LiveShift[]
  initialTodayCompleted: CompletedShift[]
  locations:            Location[]
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
}

/* ─── Stat Card ─────────────────────────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color   = 'text-white/90',
  bg      = 'bg-white/5',
  glow    = '',
}: {
  icon:   React.ElementType
  label:  string
  value:  string
  sub?:   string
  color?: string
  bg?:    string
  glow?:  string
}) {
  return (
    <div className={cn('glass-card rounded-2xl p-4 space-y-3', glow)}>
      <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center', bg)}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div>
        <p className={cn('font-timer font-bold text-xl tabular-nums', color)}>{value}</p>
        <p className="text-xs text-white/35 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Dashboard ─────────────────────────────────────────────────────────── */
export function ManagerDashboard({
  managerProfile,
  initialLiveShifts,
  initialTodayCompleted,
  locations,
}: ManagerDashboardProps) {
  const [liveShifts,     setLiveShifts]     = useState<LiveShift[]>(initialLiveShifts)
  const [todayCompleted, setTodayCompleted] = useState<CompletedShift[]>(initialTodayCompleted)
  const [lastUpdate,     setLastUpdate]     = useState(new Date())
  const supabase = createClient()

  const refreshLive = useCallback(async () => {
    const { data } = await supabase
      .from('shifts')
      .select('*, profiles(*), locations(*), expenses(*)')
      .eq('status', 'active')
      .order('start_time', { ascending: true })
    setLiveShifts((data ?? []) as LiveShift[])
    setLastUpdate(new Date())
  }, [supabase])

  const refreshCompleted = useCallback(async () => {
    const { data } = await supabase
      .from('shifts')
      .select('*, profiles(*), locations(*), expenses(*)')
      .eq('status', 'completed')
      .gte('start_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order('end_time', { ascending: false })
    setTodayCompleted((data ?? []) as CompletedShift[])
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel('manager-shifts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' },   () => { refreshLive(); refreshCompleted() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => refreshLive())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, refreshLive, refreshCompleted])

  /* ── Aggregates ── */
  const totalLaborLive    = liveShifts.reduce((sum, s) => sum + laborCost(elapsedSeconds(s.start_time), s.profiles.hourly_rate), 0)
  const totalExpensesLive = liveShifts.flatMap(s => s.expenses).reduce((s, e) => s + e.amount, 0)
  const totalExpensesToday = [
    ...liveShifts.flatMap(s => s.expenses),
    ...todayCompleted.flatMap(s => s.expenses),
  ].reduce((s, e) => s + e.amount, 0)

  const grandTotalToday = todayCompleted.reduce((sum, s) => {
    const secs = s.end_time
      ? Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000)
      : 0
    return sum + laborCost(secs, s.profiles.hourly_rate) + s.expenses.reduce((es, e) => es + e.amount, 0)
  }, 0) + totalLaborLive + totalExpensesLive

  const workersByLocation = liveShifts.reduce<Record<string, number>>((acc, s) => {
    const loc = s.locations?.name ?? 'Unknown'
    acc[loc] = (acc[loc] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="obsidian-bg min-h-screen">
      <TopNav profile={managerProfile} />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show"
          className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Live{' '}
              <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-sm text-white/40 mt-1">Real-time workforce overview</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium font-timer">
              {lastUpdate.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </motion.div>

        {/* Stat cards */}
        <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={Users}
            label="Active workers"
            value={String(liveShifts.length)}
            sub={`${todayCompleted.length} completed today`}
            color="text-emerald-400"
            bg="bg-emerald-500/5"
            glow="stat-card-emerald"
          />
          <StatCard
            icon={Clock}
            label="Shifts today"
            value={String(liveShifts.length + todayCompleted.length)}
            color="text-blue-400"
            bg="bg-blue-500/5"
            glow="stat-card-cyan"
          />
          <StatCard
            icon={Euro}
            label="Live labor cost"
            value={formatCurrency(totalLaborLive)}
            sub="accruing now"
            color="text-emerald-400"
            bg="bg-emerald-500/5"
            glow="stat-card-emerald"
          />
          <StatCard
            icon={Receipt}
            label="Expenses today"
            value={formatCurrency(totalExpensesToday)}
            color="text-amber-400"
            bg="bg-amber-500/5"
            glow="stat-card-amber"
          />
        </motion.div>

        {/* Location breakdown */}
        <AnimatePresence>
          {Object.keys(workersByLocation).length > 0 && (
            <motion.div
              variants={fadeUp} custom={2} initial="hidden" animate="show"
              className="glass-card rounded-2xl px-5 py-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <MapPin className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <span className="text-sm font-semibold text-white/80">Workers by location</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(workersByLocation).map(([loc, count]) => (
                  <div key={loc}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/15">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-white/70">{loc}</span>
                    <span className="font-timer text-xs font-bold text-emerald-400">{count}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live shifts */}
        <motion.section variants={fadeUp} custom={3} initial="hidden" animate="show"
          className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <h2 className="font-semibold text-sm text-white/80">Currently working</h2>
            <span className="font-timer text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {liveShifts.length} ACTIVE
            </span>
          </div>

          {liveShifts.length === 0 ? (
            <div className="glass-card rounded-2xl py-12 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white/20" />
              </div>
              <p className="text-sm text-white/25">No workers currently clocked in</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {liveShifts.map(shift => (
                  <LiveShiftCard key={shift.id} shift={shift} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.section>

        {/* Completed today */}
        {todayCompleted.length > 0 && (
          <motion.section variants={fadeUp} custom={4} initial="hidden" animate="show"
            className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-white/40" />
              </div>
              <h2 className="font-semibold text-sm text-white/80">Completed today</h2>
              <span className="font-timer text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/35 border border-white/10">
                {todayCompleted.length}
              </span>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
              {todayCompleted.map(shift => {
                const shiftSecs    = shift.end_time
                  ? Math.floor((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 1000)
                  : 0
                const shiftExpenses = shift.expenses.reduce((s, e) => s + e.amount, 0)
                const shiftLabor    = laborCost(shiftSecs, shift.profiles.hourly_rate)
                const initials = (shift.profiles.full_name ?? shift.profiles.email)
                  .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

                return (
                  <div key={shift.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white/40">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/75 truncate">
                          {shift.profiles.full_name ?? shift.profiles.email}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-white/20 shrink-0" />
                          <p className="text-xs text-white/30 truncate">
                            {shift.locations?.name ?? '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-timer text-sm font-semibold text-white/75">
                        {formatDurationShort(shiftSecs)}
                      </p>
                      {(shiftLabor > 0 || shiftExpenses > 0) && (
                        <p className="text-xs text-white/30 mt-0.5 font-timer">
                          {shiftLabor > 0 && <span className="text-emerald-400/60">{formatCurrency(shiftLabor)}</span>}
                          {shiftExpenses > 0 && (
                            <span className="text-amber-400/60"> +{formatCurrency(shiftExpenses)}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Grand total */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <span className="text-sm text-white/60">Day total (labor + expenses)</span>
              <span className="font-timer font-bold text-emerald-400 text-base">
                {formatCurrency(grandTotalToday)}
              </span>
            </div>
          </motion.section>
        )}
      </main>
    </div>
  )
}
