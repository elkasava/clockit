'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import JsBarcode from 'jsbarcode'
import {
  Camera, CheckCircle, Loader2, Moon, RotateCcw, ScanLine, Store,
  Fuel, ShoppingCart, UtensilsCrossed, Coffee, ShoppingBag, AlertCircle,
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
  phone: string
  receiptNumber: string
  barcodeValue: string
  date: string
  time: string
  items: { name: string; price: number }[]
  vatRate: number
  vatAmount: number
  total: number
  brand: Brand | null
  isNight: boolean
}

export interface ReceiptScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: {
    amount: number
    description: string
    type: ExpenseType
    imageFile: File
  }) => void
}

type Stage = 'idle' | 'processing' | 'review' | 'confirmed'

// ─── Barcode ──────────────────────────────────────────────────────────────────

function BarcodeDisplay({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 9,
        height: 44,
        margin: 4,
        background: '#ffffff',
        lineColor: '#111111',
        fontOptions: 'bold',
        font: 'Courier New',
      })
    } catch { /* ignore invalid values */ }
  }, [value])
  return <svg ref={ref} className="w-full" />
}

// ─── OCR Text Parsing ─────────────────────────────────────────────────────────

interface ParsedReceipt {
  total: number | null
  date: string | null
  time: string | null
  vatAmount: number | null
}

function parseReceiptText(text: string): ParsedReceipt {
  // Total: look for TOTAAL/TOTAL/TE BETALEN + number
  let total: number | null = null
  const totalPatterns = [
    /(?:totaal|total|te betalen|to pay|bedrag|montant|amount due)[^\d]*(\d+[,.]?\d{0,2})/i,
    /(?:totaal|total)\s+(\d+[,.]?\d{2})/im,
  ]
  for (const p of totalPatterns) {
    const m = text.match(p)
    if (m) { total = parseFloat(m[1].replace(',', '.')); break }
  }
  // Fallback: largest price-like value
  if (!total) {
    const amounts: number[] = []
    const re = /(?:€\s*)?(\d{1,3}[.,]\d{2})(?!\d)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const v = parseFloat(m[1].replace(',', '.'))
      if (v > 0 && v < 10000) amounts.push(v)
    }
    if (amounts.length) total = Math.max(...amounts)
  }

  // Date: dd/mm/yyyy or dd-mm-yyyy
  const dateMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/)

  // Time: hh:mm
  const timeMatch = text.match(/(\d{1,2}:\d{2})(?::\d{2})?/)

  // VAT/BTW
  let vatAmount: number | null = null
  const vatMatch = text.match(/(?:btw|tva|vat)[^\d]*(\d+[,.]?\d{0,2})/i)
  if (vatMatch) vatAmount = parseFloat(vatMatch[1].replace(',', '.'))

  return {
    total,
    date: dateMatch?.[1] ?? null,
    time: timeMatch?.[1] ?? null,
    vatAmount,
  }
}

// ─── OCR Data Builder ─────────────────────────────────────────────────────────

const SAMPLE_ITEMS: Record<BrandCategory | 'night' | 'generic', { name: string; price: number }[]> = {
  fuel:     [{ name: 'UNLEADED E10  35.2L', price: 62.30 }, { name: 'CAR WASH CLASSIC', price: 6.00 }],
  grocery:  [{ name: 'FOOD & BEVERAGES X12', price: 34.67 }, { name: 'NON-FOOD ITEMS  X3', price: 9.85 }],
  fastfood: [{ name: 'MENU COMBO LARGE', price: 9.99 }, { name: 'EXTRA SAUCE', price: 0.50 }, { name: 'SOFT DRINK', price: 2.20 }],
  coffee:   [{ name: 'CAFFE LATTE GRANDE', price: 5.50 }, { name: 'BLUEBERRY MUFFIN', price: 3.25 }],
  retail:   [{ name: 'PRODUCT X1', price: 24.99 }, { name: 'BAG', price: 0.25 }],
  other:    [{ name: 'PURCHASE', price: 18.50 }],
  night:    [{ name: 'BEVERAGES', price: 6.80 }, { name: 'SNACKS', price: 4.20 }],
  generic:  [{ name: 'ITEMS', price: 15.00 }],
}

const STORE_ADDRESSES: Record<string, { address: string; phone: string }> = {
  'Shell':         { address: 'Rue de la Loi 12, 1000 Brussel', phone: 'Tel: 02 511 22 33' },
  'Carrefour':     { address: 'Nieuwstraat 45, 1000 Brussel',   phone: 'Tel: 02 219 00 11' },
  'Delhaize':      { address: 'Anspachlaan 78, 1000 Brussel',   phone: 'Tel: 02 218 08 00' },
  'Lidl':          { address: 'Naamsestraat 32, 3000 Leuven',   phone: 'Tel: 016 22 44 55' },
  "McDonald's":    { address: 'Meir 50, 2000 Antwerpen',        phone: 'Tel: 03 232 10 10' },
  'Starbucks':     { address: 'Groenplaats 7, 2000 Antwerpen',  phone: 'Tel: 03 227 34 56' },
}

function buildOCRData(parsed: ParsedReceipt, rawText: string): OCRData {
  const brand = matchBrand(rawText)
  const night = isNightTime()
  const now = new Date()
  const category = brand?.category ?? (night ? 'night' : 'generic')
  const baseItems = SAMPLE_ITEMS[category as keyof typeof SAMPLE_ITEMS] ?? SAMPLE_ITEMS.generic
  const baseTotal = baseItems.reduce((s, i) => s + i.price, 0)

  // Use real OCR total; scale items to match
  const realTotal = parsed.total ?? baseTotal
  const scale = baseTotal > 0 ? realTotal / baseTotal : 1
  const items = baseItems.map(i => ({
    name: i.name,
    price: parseFloat((i.price * scale).toFixed(2)),
  }))

  const vatRate = brand?.vatRate ?? 21
  const vatAmount = parsed.vatAmount ?? parseFloat((realTotal * vatRate / (100 + vatRate)).toFixed(2))

  const receiptNum = Math.random().toString(36).substring(2, 8).toUpperCase()
  const barcodeValue = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${receiptNum}`
  const storeInfo = brand
    ? (STORE_ADDRESSES[brand.name] ?? { address: 'België', phone: '' })
    : { address: night ? 'Nachtwinkel' : 'Lokale winkel', phone: '' }

  return {
    storeName: brand?.name ?? (night ? 'Night Shop' : 'Local Store'),
    address: storeInfo.address,
    phone: storeInfo.phone,
    receiptNumber: receiptNum,
    barcodeValue,
    date: parsed.date ?? now.toLocaleDateString('nl-BE'),
    time: parsed.time ?? now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }),
    items,
    vatRate,
    vatAmount,
    total: parseFloat(realTotal.toFixed(2)),
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
  const headerBg    = brand?.bgColor ?? (data.isNight ? '#1e1b4b' : '#374151')
  const headerColor = brand?.color ?? '#FFFFFF'
  const courier = { fontFamily: "'Courier New', Courier, monospace" }

  return (
    <div style={courier} className="text-[12px] leading-[1.45] text-gray-900 select-none">
      {/* Brand identity layer ON TOP */}
      <div
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-t-md"
        style={{ backgroundColor: headerBg, color: headerColor }}
      >
        <CategoryIcon category={brand?.category ?? null} isNight={data.isNight} className="shrink-0" />
        <span className="font-black uppercase tracking-widest text-[15px]" style={{ textShadow: '0 0 8px rgba(0,0,0,0.25)' }}>
          {data.storeName}
        </span>
      </div>

      {/* White paper */}
      <div className="bg-white shadow-[0px_5px_10px_rgba(0,0,0,0.12)]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23ffffff'/%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%23f0ede8' opacity='0.6'/%3E%3C/svg%3E")` }}
      >
        {/* head-ticket */}
        <div className="text-center px-[17px] pt-3 pb-1">
          <p className="font-black text-[18px]" style={{ textShadow: '0px 0px 1px #000' }}>{data.storeName}</p>
          <p className="font-bold">{data.address}</p>
          {data.phone && <p className="font-bold">{data.phone}</p>}
          <br />
          <p className="font-bold">BEDANKT VOOR UW VERTROUWEN</p>
          <p className="text-left text-[11px]">Kassa 001 · {data.date} · {data.time}</p>
          <p className="text-left text-[11px]">Ticket {data.receiptNumber}</p>
          {/* Barcode — full bleed */}
          <div className="-mx-[17px] mt-[6px] bg-white">
            <BarcodeDisplay value={data.barcodeValue} />
          </div>
        </div>

        {/* body-ticket */}
        <div className="px-[17px] pb-1">
          <div className="my-[18px] space-y-[3px]">
            {data.items.map((item, i) => (
              <div key={i} className="flex justify-between w-full">
                <span>{item.name}</span>
                <span>{item.price.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-b border-dashed border-gray-400 w-[30%] ml-auto my-1" />
            <div className="flex justify-between w-full">
              <span>TOTAAL {data.items.length} artikel{data.items.length !== 1 ? 'en' : ''}</span>
              <span>{data.total.toFixed(2)}</span>
            </div>
            <br />
            <div className="flex justify-between w-full text-gray-600">
              <span>BTW {data.vatRate}%</span>
              <span>{data.vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-full text-gray-600">
              <span>Excl. BTW</span>
              <span>{(data.total - data.vatAmount).toFixed(2)}</span>
            </div>
          </div>
          <div className="border-b-2 border-dashed border-gray-500 my-2.5 w-full" />
          <div className="flex justify-between w-full font-black text-[14px] py-0.5">
            <span>TOTAAL</span>
            <span>€ {data.total.toFixed(2)}</span>
          </div>
          <div className="border-b-2 border-dashed border-gray-500 my-2.5 w-full" />
        </div>

        {/* footer-ticket */}
        <div className="px-[17px] py-3 text-center">
          <p className="font-black text-[15px] tracking-[2px]" style={{ textShadow: '0px 1px 0px rgba(0,0,0,0.3)' }}>
            Bedankt voor uw bezoek<br />en tot ziens
          </p>
        </div>
      </div>

      {/* Torn bottom */}
      <div className="w-full h-5 bg-white" style={{ clipPath: 'polygon(0% 0%, 2% 100%, 4% 0%, 6% 100%, 8% 0%, 10% 100%, 12% 0%, 14% 100%, 16% 0%, 18% 100%, 20% 0%, 22% 100%, 24% 0%, 26% 100%, 28% 0%, 30% 100%, 32% 0%, 34% 100%, 36% 0%, 38% 100%, 40% 0%, 42% 100%, 44% 0%, 46% 100%, 48% 0%, 50% 100%, 52% 0%, 54% 100%, 56% 0%, 58% 100%, 60% 0%, 62% 100%, 64% 0%, 66% 100%, 68% 0%, 70% 100%, 72% 0%, 74% 100%, 76% 0%, 78% 100%, 80% 0%, 82% 100%, 84% 0%, 86% 100%, 88% 0%, 90% 100%, 92% 0%, 94% 100%, 96% 0%, 98% 100%, 100% 0%)' }} />
    </div>
  )
}

// ─── Expense Type Options ─────────────────────────────────────────────────────

const EXPENSE_TYPE_OPTIONS: { value: ExpenseType; label: string }[] = [
  { value: 'transport',     label: 'Transport' },
  { value: 'food',          label: 'Food' },
  { value: 'parking',       label: 'Parking' },
  { value: 'accommodation', label: 'Stay' },
  { value: 'other',         label: 'Other' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReceiptScanner({ open, onOpenChange, onConfirm }: ReceiptScannerProps) {
  const [stage, setStage]             = useState<Stage>('idle')
  const [imageUrl, setImageUrl]       = useState<string | null>(null)
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [ocrData, setOcrData]         = useState<OCRData | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus]     = useState('Initialising…')
  const [ocrError, setOcrError]       = useState<string | null>(null)
  const [amount, setAmount]           = useState('')
  const [description, setDescription] = useState('')
  const [expenseType, setExpenseType] = useState<ExpenseType>('other')
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStage('idle')
    setImageUrl(null)
    setImageFile(null)
    setOcrData(null)
    setOcrProgress(0)
    setOcrStatus('Initialising…')
    setOcrError(null)
    setAmount('')
    setDescription('')
    setExpenseType('other')
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setTimeout(reset, 300)
  }, [onOpenChange, reset])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setImageFile(file)
    setStage('processing')
    setOcrError(null)
    setOcrProgress(0)

    try {
      // Dynamic import keeps tesseract.js out of the initial bundle
      const { recognize } = await import('tesseract.js')

      const result = await recognize(
        file,
        'nld+fra+eng',       // Dutch + French + English — covers Belgian receipts
        {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'loading tesseract core') setOcrStatus('Loading OCR engine…')
            else if (m.status === 'initializing tesseract') setOcrStatus('Initialising…')
            else if (m.status === 'loading language traineddata') setOcrStatus('Loading language data…')
            else if (m.status === 'initializing api') setOcrStatus('Starting up…')
            else if (m.status === 'recognizing text') {
              setOcrStatus('Reading receipt…')
              setOcrProgress(Math.round(m.progress * 100))
            }
          },
        },
      )

      const rawText = result.data.text
      const parsed  = parseReceiptText(rawText)
      const data    = buildOCRData(parsed, rawText)

      setOcrData(data)
      setAmount(data.total.toFixed(2))
      setDescription(data.storeName)
      const mapped = data.brand ? categoryToExpenseType(data.brand.category) : 'other'
      setExpenseType(mapped as ExpenseType)
      setStage('review')
    } catch (err) {
      console.error('OCR failed', err)
      setOcrError('OCR failed — using simulated data instead')
      // Graceful fallback: use simulated data so the user can still proceed
      const data = buildOCRData({ total: null, date: null, time: null, vatAmount: null }, '')
      setOcrData(data)
      setAmount(data.total.toFixed(2))
      setDescription(data.storeName)
      setExpenseType('other')
      setStage('review')
    }
  }, [])

  const handleConfirm = useCallback(() => {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0 || !imageFile) return
    setStage('confirmed')
    setTimeout(() => {
      onConfirm({ amount: parsed, description: description.trim(), type: expenseType, imageFile })
      handleClose()
    }, 900)
  }, [amount, description, expenseType, imageFile, onConfirm, handleClose])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-zinc-950 border-zinc-800">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <ScanLine className="h-4 w-4 text-emerald-400" />
            Smart Receipt Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait">

            {/* ── IDLE ── */}
            {stage === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-4 p-10 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all group cursor-pointer w-full"
                >
                  <div className="h-16 w-16 rounded-full bg-zinc-800 group-hover:bg-emerald-500/10 flex items-center justify-center transition-colors">
                    <Camera className="h-7 w-7 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-300">Scan a receipt</p>
                    <p className="text-xs text-zinc-600 mt-1">Take a photo or upload an image — OCR runs locally, free &amp; private</p>
                  </div>
                </button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
              </motion.div>
            )}

            {/* ── PROCESSING ── */}
            {stage === 'processing' && imageUrl && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-5"
              >
                <div className="relative w-full max-w-xs overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Receipt" className="w-full object-contain max-h-60 rounded-xl" />
                  <motion.div
                    className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.55)]"
                    animate={{ top: ['5%', '92%', '5%'] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="absolute inset-0 bg-emerald-500/5 rounded-xl" />
                </div>

                {/* Progress */}
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                      {ocrStatus}
                    </span>
                    <span className="text-emerald-400 font-mono">{ocrProgress}%</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      animate={{ width: `${ocrProgress}%` }}
                      transition={{ ease: 'linear' }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── REVIEW ── */}
            {stage === 'review' && imageUrl && ocrData && (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col gap-4"
              >
                {ocrError && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {ocrError}
                  </div>
                )}

                {/* Split view */}
                <div className="flex gap-4 items-start">
                  <motion.div initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="w-5/12 shrink-0">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 text-center">Original</p>
                    <div className="rounded-xl overflow-hidden border border-zinc-800 shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Receipt" className="w-full object-contain max-h-80" />
                    </div>
                    <p className="text-[9px] text-zinc-600 text-center mt-1.5 flex items-center justify-center gap-1">
                      <Camera className="h-2.5 w-2.5" /> Backup will be saved to your account
                    </p>
                  </motion.div>

                  <motion.div initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="flex-1 overflow-hidden rounded-md">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 text-center">Digital Twin</p>
                    <DigitalReceipt data={ocrData} />
                  </motion.div>
                </div>

                {/* Verify form */}
                <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3"
                >
                  <p className="text-xs text-zinc-500 font-medium">Verify before adding to expenses</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Type</Label>
                      <Select value={expenseType} onValueChange={v => { if (v) setExpenseType(v as ExpenseType) }}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Amount (€)</Label>
                      <Input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="bg-zinc-800 border-zinc-700 h-9 text-sm font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Description</Label>
                      <Input value={description} onChange={e => setDescription(e.target.value)} className="bg-zinc-800 border-zinc-700 h-9 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={reset} className="text-zinc-500 gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> Rescan
                    </Button>
                    <Button size="sm" className="ml-auto bg-emerald-600 hover:bg-emerald-500 gap-1.5"
                      onClick={handleConfirm} disabled={!amount || parseFloat(amount) <= 0}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Add to shift
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── CONFIRMED ── */}
            {stage === 'confirmed' && (
              <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-3"
              >
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
                  <CheckCircle className="h-14 w-14 text-emerald-400" />
                </motion.div>
                <p className="text-sm font-medium text-zinc-300">Expense added &amp; receipt saved!</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
