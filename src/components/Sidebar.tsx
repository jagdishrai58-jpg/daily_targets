'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserEmail(user.email ?? null)
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Change this to YOUR actual admin email!
  const isAdmin = userEmail === 'jagdishrai58@gmail.com'

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊', show: true },
    { name: 'Today\'s To-Do', path: '/todo', icon: '📝', show: true },
    { name: 'Mock Tracker', path: '/mocks', icon: '🎯', show: true },
    { name: 'Daily CA', path: '/daily-ca', icon: '📅', show: true },
    { name: 'Weekly CA', path: '/weekly-ca', icon: '🗓️', show: true },
    { name: 'Computer Quizzes', path: '/computer', icon: '💻', show: true },
    { name: 'My Scores', path: '/scores', icon: '📈', show: true },
    { name: 'My Profile', path: '/profile', icon: '👤', show: true }, // <-- NEW Profile Link
    { name: 'Admin Panel', path: '/admin', icon: '⚙️', show: isAdmin },
  ]

  if (pathname.startsWith('/quiz/')) return null

  return (
    <div className="w-64 bg-slate-900 min-h-screen text-slate-300 flex flex-col hidden md:flex">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-wider">CA MASTER</h1>
        <p className="text-xs text-slate-500 mt-1">Exam Prep Portal</p>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-2">
        {navItems.map((item) => {
          if (!item.show) return null // Skips rendering if show is false
          
          const isActive = pathname === item.path
          return (
            <Link 
              key={item.name} 
              href={item.path}
              className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-blue-600 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
        {/* Made the user info a clickable quick-link to the profile */}
        <Link href="/profile" className="block px-2 group cursor-pointer">
          <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Logged in as:</p>
          <p className="text-sm font-bold text-slate-300 truncate mt-1 group-hover:text-white transition-colors">
            {userEmail}
          </p>
        </Link>

        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center px-4 py-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}