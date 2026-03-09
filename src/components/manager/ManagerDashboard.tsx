'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Location, Expense, Shift } from '@/types/database'
import { TopNav } from '@/components/shared/TopNav'
import { LiveShiftCard } from './LiveShiftCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDurationShort, laborCost, elapsedSeconds } from '@/lib/utils'
import {
  Users, Clock, DollarSign, Receipt, Activity,
  TrendingUp, MapPin
} from 'lucide-react'

type LiveShift = Shift & { profiles: Profile; locations: Location | null; expenses: Expense[] }
type CompletedShift = Shift & { profiles: Profile; locations: Location | null; expenses: Expense[] }

interface ManagerDashboardProps {
  managerProfile: Profile
  initialLiveShifts: LiveShift[]
  initialTodayCompleted: CompletedShift[]
  locations: Location[]
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-foreground',
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <Card className="border-border/50 bg-card/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ManagerDashboard({
  managerProfile,
  initialLiveShifts,
  initialTodayCompleted,
  locations,
}: ManagerDashboardProps) {
  const [liveShifts, setLiveShifts] = useState<LiveShift[]>(initialLiveShifts)
  const [todayCompleted, setTodayCompleted] = useState<CompletedShift[]>(initialTodayCompleted)
  const [lastUpdate, setLastUpdate] = useState(new Date())
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

  // Real-time subscription to shifts table
  useEffect(() => {
    const channel = supabase
      .channel('manager-shifts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          refreshLive()
          refreshCompleted()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => refreshLive()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, refreshLive, refreshCompleted])

  // Compute aggregate stats
  const totalLaborLive = liveShifts.reduce(
    (sum, s) => sum + laborCost(elapsedSeconds(s.start_time), s.profiles.hourly_rate),
    0
  )
  const totalExpensesLive = liveShifts.flatMap(s => s.expenses).reduce((s, e) => s + e.amount, 0)
  const totalExpensesToday = [
    ...liveShifts.flatMap(s => s.expenses),
    ...todayCompleted.flatMap(s => s.expenses),
  ].reduce((s, e) => s + e.amount, 0)

  const workersByLocation = liveShifts.reduce<Record<string, number>>((acc, s) => {
    const loc = s.locations?.name ?? 'Unknown'
    acc[loc] = (acc[loc] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background">
      <TopNav profile={managerProfile} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time workforce overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdate.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={Users}
            label="Active workers"
            value={String(liveShifts.length)}
            sub={`${todayCompleted.length} completed today`}
            color="text-emerald-400"
          />
          <StatCard
            icon={Clock}
            label="Shifts today"
            value={String(liveShifts.length + todayCompleted.length)}
          />
          <StatCard
            icon={DollarSign}
            label="Live labor cost"
            value={formatCurrency(totalLaborLive)}
            sub="accruing now"
            color="text-emerald-400"
          />
          <StatCard
            icon={Receipt}
            label="Expenses today"
            value={formatCurrency(totalExpensesToday)}
          />
        </div>

        {/* Location breakdown */}
        {Object.keys(workersByLocation).length > 0 && (
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Workers by location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(workersByLocation).map(([loc, count]) => (
                  <Badge key={loc} variant="secondary" className="gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {loc}
                    <span className="font-mono font-bold">{count}</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live shifts */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h2 className="font-semibold text-sm">Currently working</h2>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-400/20 text-xs">
              {liveShifts.length} active
            </Badge>
          </div>

          {liveShifts.length === 0 ? (
            <Card className="border-border/50 bg-card/40">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No workers currently clocked in
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {liveShifts.map(shift => (
                <LiveShiftCard key={shift.id} shift={shift} />
              ))}
            </div>
          )}
        </section>

        {/* Completed today */}
        {todayCompleted.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Completed today</h2>
              <Badge variant="secondary" className="text-xs">{todayCompleted.length}</Badge>
            </div>

            <div className="space-y-2">
              {todayCompleted.map(shift => {
                const shiftSecs = shift.end_time
                  ? Math.floor((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 1000)
                  : 0
                const shiftExpenses = shift.expenses.reduce((s, e) => s + e.amount, 0)
                const shiftLabor = laborCost(shiftSecs, shift.profiles.hourly_rate)

                return (
                  <Card key={shift.id} className="border-border/50 bg-card/40">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2 w-2 rounded-full bg-zinc-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {shift.profiles.full_name ?? shift.profiles.email}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {shift.locations?.name ?? '—'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="font-mono text-sm font-semibold">
                            {formatDurationShort(shiftSecs)}
                          </p>
                          {(shiftLabor > 0 || shiftExpenses > 0) && (
                            <p className="text-xs text-muted-foreground">
                              {shiftLabor > 0 && formatCurrency(shiftLabor)}
                              {shiftExpenses > 0 && ` + ${formatCurrency(shiftExpenses)}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Separator />
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-muted-foreground">Day total (labor + expenses)</span>
              <span className="font-mono font-bold">
                {formatCurrency(
                  todayCompleted.reduce((sum, s) => {
                    const secs = s.end_time
                      ? Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000)
                      : 0
                    return sum + laborCost(secs, s.profiles.hourly_rate) + s.expenses.reduce((es, e) => es + e.amount, 0)
                  }, 0) + totalLaborLive + totalExpensesLive
                )}
              </span>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
