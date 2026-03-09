import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkerView } from './WorkerView'
import type { Profile } from '@/types/database'

export default async function WorkerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profileData }, { data: locations }, { data: activeShift }, { data: todayShifts }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('locations').select('*').eq('is_active', true).order('name'),
      supabase
        .from('shifts')
        .select('*, locations(*), expenses(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('shifts')
        .select('*, locations(*), expenses(*)')
        .eq('user_id', user.id)
        .gte('start_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('start_time', { ascending: false }),
    ])

  if (!profileData) redirect('/login')
  const profile = profileData as Profile
  if (profile.role === 'manager') redirect('/manager')

  return (
    <WorkerView
      profile={profile}
      locations={locations ?? []}
      initialActiveShift={activeShift}
      initialTodayShifts={todayShifts ?? []}
    />
  )
}
