'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration, elapsedSeconds, formatCurrency, laborCost } from '@/lib/utils'
import type { Shift, Location, Profile } from '@/types/database'
import { Loader2, MapPin, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ClockButtonProps {
  profile: Profile
  locations: Location[]
  activeShift: Shift | null
  onShiftChange: () => void
}

export function ClockButton({ profile, locations, activeShift, onShiftChange }: ClockButtonProps) {
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const supabase = createClient()

  // Tick every second when clocked in
  useEffect(() => {
    if (!activeShift) {
      setElapsed(0)
      return
    }
    setElapsed(elapsedSeconds(activeShift.start_time))
    const interval = setInterval(() => {
      setElapsed(elapsedSeconds(activeShift.start_time))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeShift])

  const handleClockIn = useCallback(async () => {
    if (!selectedLocation) {
      toast.error('Please select a location first')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('shifts').insert({
        user_id: profile.id,
        location_id: selectedLocation,
        start_time: new Date().toISOString(),
        status: 'active',
      })
      if (error) throw error
      toast.success('Clocked in! Have a great shift.')
      onShiftChange()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to clock in')
    } finally {
      setLoading(false)
    }
  }, [selectedLocation, profile.id, supabase, onShiftChange])

  const handleClockOut = useCallback(async () => {
    if (!activeShift) return
    setLoading(true)
    try {
      const { error } = await supabase.from('shifts').update({
        end_time: new Date().toISOString(),
        status: 'completed',
      }).eq('id', activeShift.id)
      if (error) throw error
      toast.success('Clocked out. Great work today!')
      onShiftChange()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to clock out')
    } finally {
      setLoading(false)
    }
  }, [activeShift, supabase, onShiftChange])

  const isActive = !!activeShift
  const currentLaborCost = laborCost(elapsed, profile.hourly_rate)

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Main pulse button */}
      <div className="relative">
        {/* Animated rings when active */}
        {isActive && (
          <>
            <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <span className="absolute -inset-4 rounded-full bg-emerald-500/10 animate-pulse" />
          </>
        )}
        <button
          onClick={isActive ? handleClockOut : handleClockIn}
          disabled={loading || (!isActive && !selectedLocation)}
          className={cn(
            'relative w-52 h-52 rounded-full text-white font-bold transition-all duration-300',
            'flex flex-col items-center justify-center gap-2 select-none',
            'shadow-2xl focus:outline-none focus:ring-4 focus:ring-offset-4 focus:ring-offset-background',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isActive
              ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 focus:ring-emerald-500'
              : 'bg-gradient-to-br from-zinc-700 to-zinc-900 hover:from-zinc-600 hover:to-zinc-800 focus:ring-zinc-500 border-2 border-zinc-600'
          )}
        >
          {loading ? (
            <Loader2 className="h-12 w-12 animate-spin" />
          ) : isActive ? (
            <>
              <Square className="h-10 w-10 fill-white" />
              <span className="text-sm font-medium opacity-90">CLOCK OUT</span>
            </>
          ) : (
            <>
              <Play className="h-10 w-10 fill-white" />
              <span className="text-sm font-medium opacity-90">CLOCK IN</span>
            </>
          )}
        </button>
      </div>

      {/* Live timer display */}
      {isActive && (
        <div className="text-center space-y-1">
          <div className="font-mono text-5xl font-bold tabular-nums tracking-widest text-foreground">
            {formatDuration(elapsed)}
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{locations.find(l => l.id === activeShift?.location_id)?.name ?? 'Unknown location'}</span>
          </div>
          {profile.hourly_rate > 0 && (
            <div className="text-emerald-400 font-semibold text-lg">
              {formatCurrency(currentLaborCost)} earned
            </div>
          )}
        </div>
      )}

      {/* Location selector (only when not clocked in) */}
      {!isActive && (
        <div className="w-full max-w-xs space-y-2">
          <p className="text-center text-sm text-muted-foreground">Select your location</p>
          <Select value={selectedLocation} onValueChange={v => setSelectedLocation(v ?? '')}>
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder="Choose location…" />
            </SelectTrigger>
            <SelectContent>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {loc.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Quick action when active: change location note */}
      {isActive && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleClockOut} disabled={loading}>
          <Square className="h-3.5 w-3.5 mr-1.5" />
          End shift
        </Button>
      )}
    </div>
  )
}
