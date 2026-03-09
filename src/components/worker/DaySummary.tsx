'use client'

import { useState } from 'react'
import type { Shift, Expense, Profile, Location } from '@/types/database'
import { formatDuration, formatCurrency, elapsedSeconds, laborCost } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, DollarSign, Receipt, MapPin, ChevronDown, ChevronUp } from 'lucide-react'

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
    const start = new Date(s.start_time).getTime()
    const end = new Date(s.end_time).getTime()
    return sum + Math.floor((end - start) / 1000)
  }, 0)

  const totalExpenses = shifts.flatMap(s => s.expenses).reduce((sum, e) => sum + e.amount, 0)
  const totalLabor = laborCost(totalSeconds, profile.hourly_rate)
  const grandTotal = totalLabor + totalExpenses

  const today = new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Day Summary
            <Badge variant="secondary" className="text-xs capitalize">{today}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-background/50">
              <Clock className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <p className="font-mono text-sm font-bold">{formatDuration(totalSeconds)}</p>
              <p className="text-xs text-muted-foreground">Time worked</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/50">
              <DollarSign className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <p className="font-mono text-sm font-bold">{formatCurrency(totalLabor)}</p>
              <p className="text-xs text-muted-foreground">Labor</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/50">
              <Receipt className="h-4 w-4 text-amber-400 mx-auto mb-1" />
              <p className="font-mono text-sm font-bold">{formatCurrency(totalExpenses)}</p>
              <p className="text-xs text-muted-foreground">Expenses</p>
            </div>
          </div>

          {/* Grand total */}
          {profile.hourly_rate > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-medium">Total to reimburse</span>
              <span className="font-mono font-bold text-primary">{formatCurrency(grandTotal)}</span>
            </div>
          )}

          <Separator />

          {/* Per-shift breakdown */}
          <div className="space-y-3">
            {shifts.map((shift, i) => {
              const shiftSeconds = shift.end_time
                ? Math.floor((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 1000)
                : elapsedSeconds(shift.start_time)
              const shiftExpenses = shift.expenses.reduce((s, e) => s + e.amount, 0)

              return (
                <div key={shift.id} className="text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{shift.locations?.name ?? 'Unknown'}</span>
                      <Badge
                        variant={shift.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {shift.status === 'active' ? 'Live' : 'Done'}
                      </Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDuration(shiftSeconds)}
                    </span>
                  </div>
                  {shiftExpenses > 0 && (
                    <p className="text-xs text-muted-foreground pl-4">
                      + {formatCurrency(shiftExpenses)} expenses
                    </p>
                  )}
                  {i < shifts.length - 1 && <Separator className="mt-2" />}
                </div>
              )
            })}
          </div>

          {/* Print button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.print()}
          >
            <FileText className="h-3.5 w-3.5 mr-2" />
            Export / Print PDF
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
