'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      // 1. Check if they are logged in at all
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.replace('/login')
        return
      }

      // 2. Fetch their profile to check their rank and status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', session.user.id)
        .single()

      // 3. The Security Rules
      if (!profile) {
        router.replace('/login')
        return
      }

      if (pathname.startsWith('/admin') && profile.role !== 'admin') {
        // Kick non-admins out of the admin panel
        router.replace('/todo')
        return
      }

      if (profile.role !== 'admin' && profile.is_active === false) {
        // Kick unpaid students to the pending page
        router.replace('/pending')
        return
      }

      // If they passed all checks, unlock the doors!
      setIsAuthorized(true)
    }

    checkAccess()
  }, [router, pathname])

  // Show a verification screen while the bouncer checks their ID
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-sm">
        Verifying access...
      </div>
    )
  }

  // They passed! Render your original layout with the Sidebar intact.
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* The Sidebar will sit on the left */}
      <Sidebar />

      {/* The actual page content (Dashboard, Admin, etc.) will render on the right */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}