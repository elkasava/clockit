'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Expense, ExpenseType, Shift } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Receipt, Car, UtensilsCrossed, ParkingCircle, BedDouble, MoreHorizontal, ScanLine, ImageIcon, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ReceiptScanner } from './ReceiptScanner'

interface ExpenseTrackerProps {
  activeShift: Shift
  expenses: Expense[]
  onExpenseChange: () => void
}

const EXPENSE_TYPES: { value: ExpenseType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'transport', label: 'Transport', icon: Car, color: 'text-blue-400' },
  { value: 'food', label: 'Food', icon: UtensilsCrossed, color: 'text-amber-400' },
  { value: 'parking', label: 'Parking', icon: ParkingCircle, color: 'text-purple-400' },
  { value: 'accommodation', label: 'Stay', icon: BedDouble, color: 'text-pink-400' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'text-zinc-400' },
]

function getExpenseIcon(type: ExpenseType) {
  const found = EXPENSE_TYPES.find(t => t.value === type)
  if (!found) return <MoreHorizontal className="h-4 w-4" />
  const Icon = found.icon
  return <Icon className={cn('h-4 w-4', found.color)} />
}

function getExpenseColor(type: ExpenseType) {
  return EXPENSE_TYPES.find(t => t.value === type)?.color ?? 'text-zinc-400'
}

export function ExpenseTracker({ activeShift, expenses, onExpenseChange }: ExpenseTrackerProps) {
  const [type, setType] = useState<ExpenseType>('transport')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null)
  const supabase = createClient()

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('expenses').insert({
        shift_id: activeShift.id,
        user_id: activeShift.user_id,
        type,
        amount: parsed,
        description: description.trim() || null,
      })
      if (error) throw error
      toast.success('Expense added')
      setAmount('')
      setDescription('')
      onExpenseChange()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add expense')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (expenseId: string) => {
    setDeletingId(expenseId)
    try {
      // Delete receipt image from storage if it exists
      const expense = expenses.find(e => e.id === expenseId)
      if (expense?.receipt_image_url) {
        await supabase.storage.from('receipts').remove([expense.receipt_image_url])
      }
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
      if (error) throw error
      toast.success('Expense removed')
      onExpenseChange()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove expense')
    } finally {
      setDeletingId(null)
    }
  }

  const handleViewReceipt = useCallback(async (expense: Expense) => {
    if (!expense.receipt_image_url) return
    setViewingReceiptId(expense.id)
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(expense.receipt_image_url, 60) // 60-second signed URL
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to open receipt image')
    } finally {
      setViewingReceiptId(null)
    }
  }, [supabase])

  const handleScanConfirm = useCallback(async ({
    amount,
    description,
    type,
    imageFile,
  }: {
    amount: number
    description: string
    type: ExpenseType
    imageFile: File
  }) => {
    try {
      // 1. Insert expense and get the new id back
      const { data: newExpense, error: insertError } = await supabase
        .from('expenses')
        .insert({
          shift_id: activeShift.id,
          user_id: activeShift.user_id,
          type,
          amount,
          description: description || null,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      // 2. Upload receipt image to Supabase Storage
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const storagePath = `${activeShift.user_id}/${newExpense.id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, imageFile, { contentType: imageFile.type, upsert: false })

      if (uploadError) {
        // Don't fail the whole expense — just warn
        toast.warning('Expense saved but receipt image upload failed')
        onExpenseChange()
        return
      }

      // 3. Update expense with storage path
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_image_url: storagePath })
        .eq('id', newExpense.id)

      if (updateError) {
        toast.warning('Expense saved but could not link receipt image')
      } else {
        toast.success('Receipt expense added with photo backup')
      }

      onExpenseChange()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add expense')
    }
  }, [activeShift, supabase, onExpenseChange])

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Expenses
          </CardTitle>
          <div className="flex items-center gap-2">
            {totalExpenses > 0 && (
              <Badge variant="secondary" className="font-mono">
                {formatCurrency(totalExpenses)}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 -mr-1"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Scan
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add expense form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={type} onValueChange={v => { if (v) setType(v as ExpenseType) }}>
              <SelectTrigger className="bg-background/50 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPES.map(t => {
                  const Icon = t.icon
                  return (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <Icon className={cn('h-3.5 w-3.5', t.color)} />
                        {t.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pl-7 bg-background/50 text-sm"
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-background/50 text-sm flex-1"
            />
            <Button type="submit" size="icon" disabled={loading} className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Expense list */}
        {expenses.length > 0 && (
          <>
            <Separator />
            <ul className="space-y-2">
              {expenses.map(expense => (
                <li
                  key={expense.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-background/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getExpenseIcon(expense.type)}
                    <div className="min-w-0">
                      <p className={cn('text-xs font-medium capitalize', getExpenseColor(expense.type))}>
                        {expense.type}
                      </p>
                      {expense.description && (
                        <p className="text-xs text-muted-foreground truncate">{expense.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-sm font-medium mr-1">
                      {formatCurrency(expense.amount)}
                    </span>
                    {expense.receipt_image_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => handleViewReceipt(expense)}
                        disabled={viewingReceiptId === expense.id}
                        title="View receipt photo"
                      >
                        {viewingReceiptId === expense.id
                          ? <ExternalLink className="h-3 w-3 animate-pulse" />
                          : <ImageIcon className="h-3 w-3" />
                        }
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {expenses.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-2">
            No expenses yet this shift
          </p>
        )}
      </CardContent>

      <ReceiptScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onConfirm={handleScanConfirm}
      />
    </Card>
  )
}
