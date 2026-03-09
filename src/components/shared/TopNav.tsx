'use client'

import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { Clock, LogOut, Settings, User, Zap } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface TopNavProps {
  profile: Profile
  isActive?: boolean
}

export function TopNav({ profile, isActive = false }: TopNavProps) {
  const supabase = createClient()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  const initials = (profile.full_name ?? profile.email)
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isManager = profile.role === 'manager'

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0A0D14]/80 backdrop-blur-2xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
            <Clock className="h-4 w-4 text-emerald-400" />
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#0A0D14]" />
            )}
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-tight gradient-text">Clock It</span>
            <span className="text-[10px] text-white/30 tracking-widest uppercase">
              {isManager ? 'Command' : 'Workforce'}
            </span>
          </div>
        </div>

        {/* Centre pill — manager mode indicator */}
        {isManager && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-medium text-violet-400">
            <Zap className="h-3 w-3" />
            Manager View
          </div>
        )}

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Role badge */}
          <div className={cn(
            'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
            isActive
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-white/5 border-white/10 text-white/50'
          )}>
            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            {isActive ? 'On shift' : profile.role}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0D14]">
              <Avatar className="h-8 w-8 ring-2 ring-white/10 hover:ring-emerald-500/40 transition-all">
                <AvatarFallback className="bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[#161B28] border-white/8 shadow-2xl">
              <DropdownMenuLabel className="font-normal py-2.5">
                <p className="text-sm font-semibold truncate text-white/90">{profile.full_name ?? 'User'}</p>
                <p className="text-xs text-white/35 truncate mt-0.5">{profile.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/6" />
              <DropdownMenuItem disabled className="text-white/40 text-xs gap-2">
                <User className="h-3.5 w-3.5" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-white/40 text-xs gap-2">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/6" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-400 focus:text-red-300 focus:bg-red-500/10 text-xs gap-2"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
