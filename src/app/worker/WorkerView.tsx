'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Location, Shift, Expense } from '@/types/database'
import { TopNav } from '@/components/shared/TopNav'
import { ClockButton } from '@/components/worker/ClockButton'
import { ExpenseTracker } from '@/components/worker/ExpenseTracker'
import { DaySummary } from '@/components/worker/DaySummary'

type ShiftWithDetails = Shift & { locations: Location | null; expenses: Expense[] }

interface WorkerViewProps {
  profile: Profile
  locations: Location[]
  initialActiveShift: ShiftWithDetails | null
  initialTodayShifts: ShiftWithDetails[]
}

export function WorkerView({ profile, locations, initialActiveShift, initialTodayShifts }: WorkerViewProps) {
  const [activeShift, setActiveShift] = useState<ShiftWithDetails | null>(initialActiveShift)
  const [todayShifts, setTodayShifts] = useState<ShiftWithDetails[]>(initialTodayShifts)
  const supabase = createClient()

  const refreshData = useCallback(async () => {
    const [{ data: active }, { data: today }] = await Promise.all([
      supabase
        .from('shifts')
        .select('*, locations(*), expenses(*)')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('shifts')
        .select('*, locations(*), expenses(*)')
        .eq('user_id', profile.id)
        .gte('start_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('start_time', { ascending: false }),
    ])
    setActiveShift(active as ShiftWithDetails | null)
    setTodayShifts((today ?? []) as ShiftWithDetails[])
  }, [profile.id, supabase])

  return (
    <div className="min-h-screen bg-background">
      <TopNav profile={profile} />

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div className="text-center">
          <h1 className="text-xl font-semibold">
            Hey, {profile.full_name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeShift ? 'You\'re currently clocked in' : 'Ready to start your shift?'}
          </p>
        </div>

        {/* THE PULSE — main clock button */}
        <div className="flex justify-center py-4">
          <ClockButton
            profile={profile}
            locations={locations}
            activeShift={activeShift}
            onShiftChange={refreshData}
          />
        </div>

        {/* Expense tracker — only shown during active shift */}
        {activeShift && (
          <ExpenseTracker
            activeShift={activeShift}
            expenses={activeShift.expenses}
            onExpenseChange={refreshData}
          />
        )}

        {/* Day summary — always shown if there are shifts today */}
        <DaySummary shifts={todayShifts} profile={profile} />
      </main>
    </div>
  )
}
