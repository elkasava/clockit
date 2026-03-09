'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { formatDuration, elapsedSeconds, formatCurrency, laborCost } from '@/lib/utils'
import type { Shift, Location, Profile } from '@/types/database'
import { Loader2, MapPin, Play, Square } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Ring geometry ──────────────────────────────────────────────────────────
const RADIUS = 92          // SVG circle radius
const STROKE = 5           // ring stroke width
const CIRCUMFERENCE = 2 * Math.PI * RADIUS   // ≈ 578
const WORKDAY_SECS = 8 * 3600                // 8-hour ring = full

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
  const [prevCost, setPrevCost] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!activeShift) { setElapsed(0); return }
    setElapsed(elapsedSeconds(activeShift.start_time))
    const id = setInterval(() => setElapsed(elapsedSeconds(activeShift.start_time)), 1000)
    return () => clearInterval(id)
  }, [activeShift])

  const handleClockIn = useCallback(async () => {
    if (!selectedLocation) { toast.error('Pick a location first'); return }
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

  // Track cost change for ticker animation
  useEffect(() => {
    if (currentLaborCost !== prevCost) setPrevCost(currentLaborCost)
  }, [currentLaborCost, prevCost])

  // Ring progress (0–1), capped at 1
  const progress = Math.min(elapsed / WORKDAY_SECS, 1)
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  // Colour gradient stops change as shift progresses
  const ringColor = progress < 0.75
    ? ['#10b981', '#34d399']   // emerald
    : progress < 0.95
      ? ['#f59e0b', '#fbbf24'] // amber warning
      : ['#ef4444', '#f87171'] // red overtime

  return (
    <div className="flex flex-col items-center gap-8 select-none">

      {/* ── SVG RING + BUTTON ──────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center">

        {/* Ambient glow layers */}
        {isActive && (
          <>
            <div className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${ringColor[0]}18 0%, transparent 72%)`,
                transform: 'scale(1.5)',
              }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ inset: '-16px', background: `radial-gradient(circle, ${ringColor[0]}0A 0%, transparent 70%)` }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        {/* SVG ring */}
        <svg width="220" height="220" className="absolute" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={ringColor[0]} />
              <stop offset="100%" stopColor={ringColor[1]} />
            </linearGradient>
            <filter id="ringGlow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Track ring */}
          <circle
            cx="110" cy="110" r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {/* Progress ring */}
          {isActive && progress > 0 && (
            <circle
              cx="110" cy="110" r={RADIUS}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              filter="url(#ringGlow)"
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
            />
          )}

          {/* Tick marks */}
          {!isActive && [0,90,180,270].map(deg => {
            const rad = (deg - 90) * Math.PI / 180
            const x1 = 110 + (RADIUS - 7) * Math.cos(rad)
            const y1 = 110 + (RADIUS - 7) * Math.sin(rad)
            const x2 = 110 + (RADIUS + 1) * Math.cos(rad)
            const y2 = 110 + (RADIUS + 1) * Math.sin(rad)
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.12)" strokeWidth={2} strokeLinecap="round" style={{transform: 'rotate(90deg)', transformOrigin: '110px 110px'}} />
          })}
        </svg>

        {/* Inner button */}
        <motion.button
          onClick={isActive ? handleClockOut : handleClockIn}
          disabled={loading || (!isActive && !selectedLocation)}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          className={cn(
            'relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center gap-2',
            'font-bold text-white transition-all duration-300',
            'focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed',
            isActive
              ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 shadow-[0_0_40px_rgba(16,185,129,0.35),0_8px_32px_rgba(0,0,0,0.5)]'
              : 'bg-gradient-to-br from-[#1e2433] to-[#161b26] border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-white/14'
          )}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="h-10 w-10 animate-spin" />
              </motion.div>
            ) : isActive ? (
              <motion.div key="active" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex flex-col items-center gap-1.5">
                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                  <Square className="h-5 w-5 fill-white" />
                </div>
                <span className="text-[11px] font-semibold tracking-[0.2em] opacity-90 uppercase">Clock Out</span>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex flex-col items-center gap-1.5">
                <div className="h-9 w-9 rounded-full border-2 border-white/20 flex items-center justify-center">
                  <Play className="h-5 w-5 fill-white/70 ml-0.5" />
                </div>
                <span className="text-[11px] font-medium tracking-[0.2em] opacity-60 uppercase">Clock In</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ── LIVE STATS (when clocked in) ───────────────────────────────── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="text-center space-y-2"
          >
            {/* Big timer */}
            <div className="font-timer text-5xl font-bold tabular-nums tracking-[0.08em] text-white"
              style={{ textShadow: '0 0 40px rgba(16,185,129,0.25)' }}>
              {formatDuration(elapsed)}
            </div>

            {/* Location */}
            <div className="flex items-center justify-center gap-1.5 text-sm text-white/45">
              <MapPin className="h-3.5 w-3.5 text-emerald-500/70" />
              <span>{locations.find(l => l.id === activeShift?.location_id)?.name ?? '—'}</span>
            </div>

            {/* Earnings ticker */}
            {profile.hourly_rate > 0 && (
              <motion.div
                key={Math.floor(currentLaborCost * 10)}
                initial={{ opacity: 0.6, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-base font-timer"
              >
                <span className="text-emerald-600 text-xs">€</span>
                {currentLaborCost.toFixed(2)} earned
              </motion.div>
            )}

            {/* Progress label */}
            <div className="text-xs text-white/25 font-timer">
              {Math.round(progress * 100)}% of 8h shift
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOCATION SELECTOR (clocked out) ───────────────────────────── */}
      <AnimatePresence>
        {!isActive && (
          <motion.div
            key="location"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="w-full max-w-[280px] space-y-3"
          >
            <p className="text-center text-xs text-white/35 uppercase tracking-widest">Select location</p>
            <Select value={selectedLocation} onValueChange={v => setSelectedLocation(v ?? '')}>
              <SelectTrigger className="bg-white/4 border-white/8 hover:border-white/14 focus:border-emerald-500/50 focus:ring-0 transition-colors h-11 rounded-xl text-sm">
                <SelectValue placeholder="Choose location…" />
              </SelectTrigger>
              <SelectContent className="bg-[#161B28] border-white/8">
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id} className="focus:bg-white/6">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-white/35" />
                      {loc.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
