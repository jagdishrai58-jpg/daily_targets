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
  
  // Start as null so we know when it's actively checking vs denied
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false) 

  useEffect(() => {
    let isMounted = true

    const checkAccess = async () => {
      try {
        // 1. Get session (using getSession is faster but can be stale, getUser forces a network check)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          if (isMounted) router.replace('/login')
          return
        }

        // 2. Force a fresh fetch of the profile directly from the DB, bypassing cache
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .single()

        if (profileError || !profile) {
          if (isMounted) router.replace('/login')
          return
        }

        // 3. Security Rules Execution
        if (pathname.startsWith('/admin') && profile.role !== 'admin') {
          console.log("Access Denied: You do not have admin privileges.")
          if (isMounted) router.replace('/dashboard') // Kicks them to dashboard
          return
        }

        if (profile.role !== 'admin' && profile.is_active === false) {
          console.log("Access Denied: Account is not active.")
          if (isMounted) router.replace('/pending')
          return
        }

        // 4. Success! Unlock the doors.
        if (isMounted) setIsAuthorized(true)

      } catch (err) {
        console.error("Authorization check failed:", err)
        if (isMounted) router.replace('/login')
      }
    }

    // Run the check every time the pathname changes
    checkAccess()

    return () => {
      isMounted = false
    }
  }, [router, pathname])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Show verification screen while `isAuthorized` is null
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-sm">
        Verifying access credentials...
      </div>
    )
  }

  // If false (though redirects should catch this), show nothing to prevent flashes
  if (isAuthorized === false) return null

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col md:flex-row relative">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 px-5 py-4 text-white shadow-md z-50 relative">
        <span className="font-black text-lg tracking-tight">Command Center</span>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 -mr-1.5 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar />
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}