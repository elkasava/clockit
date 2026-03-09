export type Role = 'worker' | 'manager'
export type ShiftStatus = 'active' | 'completed' | 'cancelled'
export type ExpenseType = 'transport' | 'food' | 'parking' | 'accommodation' | 'other'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  hourly_rate: number
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  name: string
  address: string | null
  is_active: boolean
  created_at: string
}

export interface Shift {
  id: string
  user_id: string
  location_id: string | null
  start_time: string
  end_time: string | null
  status: ShiftStatus
  notes: string | null
  created_at: string
  // Joined fields
  profiles?: Profile
  locations?: Location | null
  expenses?: Expense[]
}

export interface Expense {
  id: string
  shift_id: string
  user_id: string
  type: ExpenseType
  amount: number
  description: string | null
  created_at: string
}

export interface ShiftWithDetails extends Shift {
  profiles: Profile
  locations: Location | null
  expenses: Expense[]
  // Computed
  elapsed_seconds?: number
  total_expense?: number
  labor_cost?: number
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      locations: { Row: Location; Insert: Omit<Location, 'id' | 'created_at'>; Update: Partial<Location> }
      shifts: { Row: Shift; Insert: Omit<Shift, 'id' | 'created_at'>; Update: Partial<Shift> }
      expenses: { Row: Expense; Insert: Omit<Expense, 'id' | 'created_at'>; Update: Partial<Expense> }
    }
  }
}
