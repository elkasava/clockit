'use client'

import { useEffect, useState } from 'react'
import type { Profile, Location, Expense } from '@/types/database'
import { formatDuration, formatCurrency, elapsedSeconds, laborCost } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MapPin, Clock, DollarSign, Receipt } from 'lucide-react'

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
  const currentLabor = laborCost(elapsed, shift.profiles.hourly_rate)

  return (
    <Card className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar with live indicator */}
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-emerald-500/10 text-emerald-400 text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm truncate">
                {shift.profiles.full_name ?? shift.profiles.email}
              </p>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-xs shrink-0">
                Live
              </Badge>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {shift.locations?.name ?? 'Unknown location'}
              </span>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatDuration(elapsed)}
                </span>
              </div>

              {shift.profiles.hourly_rate > 0 && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-mono text-sm text-emerald-400">
                    {formatCurrency(currentLabor)}
                  </span>
                </div>
              )}

              {totalExpenses > 0 && (
                <div className="flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono text-sm text-amber-400">
                    {formatCurrency(totalExpenses)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
