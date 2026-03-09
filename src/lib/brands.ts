export type BrandCategory = 'fuel' | 'grocery' | 'fastfood' | 'retail' | 'coffee' | 'other'

export interface Brand {
  name: string
  color: string      // text color on header
  bgColor: string    // header background
  category: BrandCategory
  keywords: string[]
  vatRate: number
}

export const BRANDS: Brand[] = [
  // Fuel
  { name: 'Shell', color: '#FFFFFF', bgColor: '#E8231A', category: 'fuel', keywords: ['shell'], vatRate: 21 },
  { name: 'Total', color: '#FFFFFF', bgColor: '#C8102E', category: 'fuel', keywords: ['total', 'totalenergies'], vatRate: 21 },
  { name: 'Q8', color: '#FFD700', bgColor: '#0033A0', category: 'fuel', keywords: ['q8', 'kuwait petroleum'], vatRate: 21 },
  { name: 'BP', color: '#FFFFFF', bgColor: '#00A650', category: 'fuel', keywords: ['bp station', 'british petroleum'], vatRate: 21 },
  { name: 'Texaco', color: '#FFFFFF', bgColor: '#E31837', category: 'fuel', keywords: ['texaco'], vatRate: 21 },
  { name: 'Esso', color: '#FF0000', bgColor: '#1A1A1A', category: 'fuel', keywords: ['esso'], vatRate: 21 },
  // Grocery
  { name: 'Carrefour', color: '#FFFFFF', bgColor: '#004A97', category: 'grocery', keywords: ['carrefour'], vatRate: 6 },
  { name: 'Delhaize', color: '#FFFFFF', bgColor: '#D22030', category: 'grocery', keywords: ['delhaize'], vatRate: 6 },
  { name: 'Lidl', color: '#FFD700', bgColor: '#0050AA', category: 'grocery', keywords: ['lidl'], vatRate: 6 },
  { name: 'Aldi', color: '#FFFFFF', bgColor: '#00519E', category: 'grocery', keywords: ['aldi'], vatRate: 6 },
  { name: 'Colruyt', color: '#FFFFFF', bgColor: '#E4002B', category: 'grocery', keywords: ['colruyt', 'collect & go'], vatRate: 6 },
  { name: 'Albert Heijn', color: '#FFFFFF', bgColor: '#00A0E2', category: 'grocery', keywords: ['albert heijn', 'ah to go'], vatRate: 6 },
  { name: 'Jumbo', color: '#003087', bgColor: '#FFD700', category: 'grocery', keywords: ['jumbo'], vatRate: 6 },
  { name: 'Spar', color: '#FFFFFF', bgColor: '#00843D', category: 'grocery', keywords: ['spar'], vatRate: 6 },
  { name: 'Okay', color: '#FFFFFF', bgColor: '#E4002B', category: 'grocery', keywords: ['okay supermarkt'], vatRate: 6 },
  // Fast food
  { name: "McDonald's", color: '#FFD700', bgColor: '#DA291C', category: 'fastfood', keywords: ['mcdonald', 'mc donald', 'mcdo', 'mcdrive'], vatRate: 21 },
  { name: 'Burger King', color: '#FFD700', bgColor: '#D62300', category: 'fastfood', keywords: ['burger king', 'burgerking'], vatRate: 21 },
  { name: 'Quick', color: '#FFFFFF', bgColor: '#CC0000', category: 'fastfood', keywords: ['quick restaurant'], vatRate: 21 },
  { name: 'KFC', color: '#FFFFFF', bgColor: '#CC0000', category: 'fastfood', keywords: ['kfc', 'kentucky fried'], vatRate: 21 },
  { name: 'Subway', color: '#FFD700', bgColor: '#008C45', category: 'fastfood', keywords: ['subway'], vatRate: 21 },
  { name: 'Pizza Hut', color: '#FFFFFF', bgColor: '#CC0000', category: 'fastfood', keywords: ['pizza hut'], vatRate: 21 },
  // Coffee
  { name: 'Starbucks', color: '#FFFFFF', bgColor: '#00704A', category: 'coffee', keywords: ['starbucks'], vatRate: 21 },
  { name: 'Costa Coffee', color: '#FFFFFF', bgColor: '#6B1C33', category: 'coffee', keywords: ['costa coffee', 'costa '], vatRate: 21 },
  // Retail
  { name: 'IKEA', color: '#003399', bgColor: '#FFDA1A', category: 'retail', keywords: ['ikea'], vatRate: 21 },
  { name: 'MediaMarkt', color: '#FFFFFF', bgColor: '#CC0000', category: 'retail', keywords: ['mediamarkt', 'media markt'], vatRate: 21 },
  { name: 'Fnac', color: '#FFFFFF', bgColor: '#F5A623', category: 'retail', keywords: ['fnac'], vatRate: 21 },
  { name: 'Action', color: '#FFFFFF', bgColor: '#E4002B', category: 'retail', keywords: ['action store'], vatRate: 21 },
  { name: 'Gamma', color: '#FFFFFF', bgColor: '#00A550', category: 'retail', keywords: ['gamma bouwmarkt'], vatRate: 21 },
  { name: 'Brico', color: '#FFFFFF', bgColor: '#FF6600', category: 'retail', keywords: ['brico', 'bricolage'], vatRate: 21 },
  { name: 'Leroy Merlin', color: '#FFFFFF', bgColor: '#007A33', category: 'retail', keywords: ['leroy merlin'], vatRate: 21 },
]

export function matchBrand(text: string): Brand | null {
  if (!text?.trim()) return null
  const lower = text.toLowerCase()
  for (const brand of BRANDS) {
    if (brand.keywords.some(k => lower.includes(k.toLowerCase()))) return brand
  }
  return null
}

export function isNightTime(): boolean {
  const h = new Date().getHours()
  return h >= 20 || h < 6
}

export function categoryToExpenseType(cat: BrandCategory): 'transport' | 'food' | 'other' {
  if (cat === 'fuel') return 'transport'
  if (cat === 'grocery' || cat === 'fastfood' || cat === 'coffee') return 'food'
  return 'other'
}
