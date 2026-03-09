import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ManagerDashboard } from '@/components/manager/ManagerDashboard'
import type { Profile } from '@/types/database'

export default async function ManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profileData) redirect('/login')
  const profile = profileData as Profile
  if (profile.role !== 'manager') redirect('/worker')

  const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  const [{ data: liveShifts }, { data: todayCompleted }, { data: locations }] = await Promise.all([
    supabase
      .from('shifts')
      .select('*, profiles(*), locations(*), expenses(*)')
      .eq('status', 'active')
      .order('start_time', { ascending: true }),
    supabase
      .from('shifts')
      .select('*, profiles(*), locations(*), expenses(*)')
      .eq('status', 'completed')
      .gte('start_time', today)
      .order('end_time', { ascending: false }),
    supabase.from('locations').select('*').eq('is_active', true).order('name'),
  ])

  return (
    <ManagerDashboard
      managerProfile={profile}
      initialLiveShifts={(liveShifts ?? []) as never}
      initialTodayCompleted={(todayCompleted ?? []) as never}
      locations={locations ?? []}
    />
  )
}
