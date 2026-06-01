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
  
  // NEW: State to track if the mobile menu is open or closed
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false) 

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

  // NEW: Automatically close the mobile menu whenever the user clicks a link to a new page
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Show a verification screen while the bouncer checks their ID
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-sm">
        Verifying access...
      </div>
    )
  }

  // They passed! Render the layout with responsive mobile sliding mechanics
  return (
    <div className="flex min-h-screen bg-slate-50 flex-col md:flex-row relative">
      
      {/* NEW: Mobile Header with Hamburger Button (Only visible on mobile) */}
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

      {/* NEW: Sidebar Wrapper with sliding animation (Fixed on mobile, static on desktop) */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar />
      </div>

      {/* NEW: Dark semi-transparent overlay when menu is open on mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)} // Closes menu if they tap outside of it
        />
      )}

      {/* The actual page content (Dashboard, Admin, etc.) */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}