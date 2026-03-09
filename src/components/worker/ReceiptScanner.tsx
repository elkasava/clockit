'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, CheckCircle, Loader2, Moon, RotateCcw, ScanLine, Store,
  Fuel, ShoppingCart, UtensilsCrossed, Coffee, ShoppingBag,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { matchBrand, isNightTime, categoryToExpenseType } from '@/lib/brands'
import type { Brand, BrandCategory } from '@/lib/brands'
import type { ExpenseType } from '@/types/database'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OCRData {
  storeName: string
  address: string
  receiptNumber: string
  date: string
  time: string
  items: { name: string; price: number }[]
  vatRate: number
  vatAmount: number
  total: number
  brand: Brand | null
  isNight: boolean
}

interface ReceiptScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: { amount: number; description: string; type: ExpenseType }) => void
}

type Stage = 'idle' | 'processing' | 'review' | 'confirmed'

// ─── OCR Simulation ───────────────────────────────────────────────────────────

const SAMPLE_ITEMS: Record<BrandCategory | 'night' | 'generic', { name: string; price: number }[]> = {
  fuel:     [{ name: 'Unleaded E10 · 35.2L', price: 62.30 }, { name: 'Car Wash Classic', price: 6.00 }],
  grocery:  [{ name: 'Food & Beverages ×12', price: 34.67 }, { name: 'Non-food items ×3', price: 9.85 }],
  fastfood: [{ name: 'Menu Combo Large', price: 9.99 }, { name: 'Extra sauce', price: 0.50 }, { name: 'Soft drink', price: 2.20 }],
  coffee:   [{ name: 'Caffe Latte Grande', price: 5.50 }, { name: 'Blueberry Muffin', price: 3.25 }],
  retail:   [{ name: 'Product ×1', price: 24.99 }, { name: 'Bag', price: 0.25 }],
  other:    [{ name: 'Purchase', price: 18.50 }],
  night:    [{ name: 'Beverages', price: 6.80 }, { name: 'Snacks', price: 4.20 }],
  generic:  [{ name: 'Items', price: 15.00 }],
}

function generateOCRData(imageText = ''): OCRData {
  const brand = matchBrand(imageText)
  const night = isNightTime()
  const now = new Date()
  const category = brand?.category ?? (night ? 'night' : 'generic')
  const items = SAMPLE_ITEMS[category as keyof typeof SAMPLE_ITEMS] ?? SAMPLE_ITEMS.generic
  const total = items.reduce((s, i) => s + i.price, 0)
  const vatRate = brand?.vatRate ?? 21
  const vatAmount = parseFloat((total * vatRate / (100 + vatRate)).toFixed(2))

  return {
    storeName: brand?.name ?? (night ? 'Night Shop' : 'Local Store'),
    address: 'Scanned address',
    receiptNumber: Math.random().toString(36).substring(2, 8).toUpperCase(),
    date: now.toLocaleDateString('nl-BE'),
    time: now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }),
    items,
    vatRate,
    vatAmount,
    total: parseFloat(total.toFixed(2)),
    brand,
    isNight: night,
  }
}

// ─── Category Icon ────────────────────────────────────────────────────────────

function CategoryIcon({ category, isNight, className }: { category: BrandCategory | null; isNight: boolean; className?: string }) {
  if (isNight && !category) return <Moon className={cn('h-5 w-5', className)} />
  switch (category) {
    case 'fuel':     return <Fuel className={cn('h-5 w-5', className)} />
    case 'grocery':  return <ShoppingCart className={cn('h-5 w-5', className)} />
    case 'fastfood': return <UtensilsCrossed className={cn('h-5 w-5', className)} />
    case 'coffee':   return <Coffee className={cn('h-5 w-5', className)} />
    case 'retail':   return <ShoppingBag className={cn('h-5 w-5', className)} />
    default:         return <Store className={cn('h-5 w-5', className)} />
  }
}

// ─── Digital Receipt ──────────────────────────────────────────────────────────

function DigitalReceipt({ data }: { data: OCRData }) {
  const { brand } = data
  const headerBg = brand?.bgColor ?? (data.isNight ? '#1e1b4b' : '#374151')
  const headerColor = brand?.color ?? '#FFFFFF'

  return (
    <div className="select-none font-mono text-gray-900 text-[11px] leading-relaxed">
      {/* Brand header */}
      <div
        className="rounded-t-lg px-5 py-4 text-center"
        style={{ backgroundColor: headerBg, color: headerColor }}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <CategoryIcon category={brand?.category ?? null} isNight={data.isNight} />
          <span className="text-xl font-bold tracking-widest uppercase">{data.storeName}</span>
        </div>
        <p className="text-xs opacity-70">{data.address}</p>
      </div>

      {/* Perforations */}
      <div className="bg-white flex items-center gap-0.5 px-2 py-1.5">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-200 shrink-0" />
        ))}
      </div>

      {/* Body */}
      <div className="bg-white px-5 pb-2">
        {/* Receipt meta */}
        <div className="flex justify-between text-gray-500 text-[10px] mb-3">
          <span>Nr: {data.receiptNumber}</span>
          <span>{data.date} · {data.time}</span>
        </div>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Line items */}
        <div className="space-y-1 my-3">
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span className="truncate pr-2">{item.name}</span>
              <span className="shrink-0">{item.price.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Subtotal + VAT */}
        <div className="space-y-1 text-gray-600">
          <div className="flex justify-between">
            <span>Subtotal excl. BTW</span>
            <span>{(data.total - data.vatAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>BTW {data.vatRate}%</span>
            <span>{data.vatAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-gray-400 my-2" />

        {/* Total */}
        <div className="flex justify-between font-bold text-sm text-gray-900 py-1">
          <span className="tracking-widest">TOTAL</span>
          <span>€ {data.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Torn bottom edge */}
      <div
        className="bg-white w-full h-4"
        style={{
          clipPath: 'polygon(0% 0%, 3% 100%, 6% 0%, 9% 100%, 12% 0%, 15% 100%, 18% 0%, 21% 100%, 24% 0%, 27% 100%, 30% 0%, 33% 100%, 36% 0%, 39% 100%, 42% 0%, 45% 100%, 48% 0%, 51% 100%, 54% 0%, 57% 100%, 60% 0%, 63% 100%, 66% 0%, 69% 100%, 72% 0%, 75% 100%, 78% 0%, 81% 100%, 84% 0%, 87% 100%, 90% 0%, 93% 100%, 96% 0%, 99% 100%, 100% 0%)',
        }}
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EXPENSE_TYPE_OPTIONS: { value: ExpenseType; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'food', label: 'Food' },
  { value: 'parking', label: 'Parking' },
  { value: 'accommodation', label: 'Stay' },
  { value: 'other', label: 'Other' },
]

export function ReceiptScanner({ open, onOpenChange, onConfirm }: ReceiptScannerProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [ocrData, setOcrData] = useState<OCRData | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [expenseType, setExpenseType] = useState<ExpenseType>('other')
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStage('idle')
    setImageUrl(null)
    setOcrData(null)
    setAmount('')
    setDescription('')
    setExpenseType('other')
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setTimeout(reset, 300)
  }, [onOpenChange, reset])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setStage('processing')

    // Simulate OCR (1.8s)
    setTimeout(() => {
      const data = generateOCRData(file.name)
      setOcrData(data)
      setAmount(data.total.toFixed(2))
      setDescription(data.storeName)
      const mapped = data.brand ? categoryToExpenseType(data.brand.category) : 'other'
      setExpenseType(mapped as ExpenseType)
      setStage('review')
    }, 1800)
  }, [])

  const handleConfirm = useCallback(() => {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) return
    setStage('confirmed')
    setTimeout(() => {
      onConfirm({ amount: parsed, description: description.trim(), type: expenseType })
      handleClose()
    }, 800)
  }, [amount, description, expenseType, onConfirm, handleClose])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-zinc-950 border-zinc-800">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <ScanLine className="h-4 w-4 text-emerald-400" />
            Smart Receipt Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 min-h-[360px] flex flex-col">
          <AnimatePresence mode="wait">

            {/* ── IDLE ── */}
            {stage === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-4 p-10 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group cursor-pointer w-full"
                >
                  <div className="h-16 w-16 rounded-full bg-zinc-800 group-hover:bg-emerald-500/10 flex items-center justify-center transition-colors">
                    <Camera className="h-7 w-7 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-300">Scan a receipt</p>
                    <p className="text-xs text-zinc-600 mt-1">Take a photo or upload an image</p>
                  </div>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </motion.div>
            )}

            {/* ── PROCESSING ── */}
            {stage === 'processing' && imageUrl && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-5"
              >
                <div className="relative w-full max-w-xs overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Receipt" className="w-full object-contain max-h-64 rounded-xl" />
                  {/* Scan line */}
                  <motion.div
                    className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.5)]"
                    animate={{ top: ['5%', '92%', '5%'] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="absolute inset-0 bg-emerald-500/5 rounded-xl" />
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading receipt…
                </div>
              </motion.div>
            )}

            {/* ── REVIEW ── */}
            {stage === 'review' && imageUrl && ocrData && (
              <motion.div
                key="review"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col gap-5"
              >
                {/* Split view */}
                <div className="flex gap-4 items-start">
                  {/* Left: original photo */}
                  <motion.div
                    initial={{ x: -24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    className="w-5/12 shrink-0"
                  >
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 text-center">Original</p>
                    <div className="rounded-xl overflow-hidden border border-zinc-800 shadow-lg bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Receipt" className="w-full object-contain max-h-72" />
                    </div>
                  </motion.div>

                  {/* Right: digital receipt */}
                  <motion.div
                    initial={{ x: 24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex-1 overflow-hidden rounded-xl shadow-2xl"
                  >
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 text-center">Digital Twin</p>
                    <DigitalReceipt data={ocrData} />
                  </motion.div>
                </div>

                {/* Edit fields */}
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3"
                >
                  <p className="text-xs text-zinc-500 font-medium">Verify before adding to expenses</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Type</Label>
                      <Select value={expenseType} onValueChange={v => { if (v) setExpenseType(v as ExpenseType) }}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_TYPE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Amount (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 h-9 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Description</Label>
                      <Input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={reset} className="text-zinc-500 gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rescan
                    </Button>
                    <Button
                      size="sm"
                      className="ml-auto bg-emerald-600 hover:bg-emerald-500 gap-1.5"
                      onClick={handleConfirm}
                      disabled={!amount || parseFloat(amount) <= 0}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Add to shift
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── CONFIRMED ── */}
            {stage === 'confirmed' && (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <CheckCircle className="h-14 w-14 text-emerald-400" />
                </motion.div>
                <p className="text-sm font-medium text-zinc-300">Expense added!</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
