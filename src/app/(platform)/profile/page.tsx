'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [profile, setProfile] = useState({
    id: '',
    email: '',
    full_name: '',
    created_at: '',
    role: 'student'
  })

  const [stats, setStats] = useState({
    tasksCompleted: 0,
    mocksTaken: 0,
    quizzesTaken: 0
  })

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 1. Fetch Profile Data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile({
          id: profileData.id,
          email: profileData.email || user.email || '',
          full_name: profileData.full_name || '',
          created_at: profileData.created_at || '',
          role: profileData.role || 'student'
        })
      }

      // 2. Fetch Lifetime Stats in parallel
      const [tasksRes, mocksRes, quizzesRes] = await Promise.all([
        supabase.from('user_task_progress').select('id', { count: 'exact' }).eq('user_id', user.id).eq('is_completed', true),
        supabase.from('mock_tests').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('quiz_results').select('id', { count: 'exact' }).eq('user_id', user.id)
      ])

      setStats({
        tasksCompleted: tasksRes.count || 0,
        mocksTaken: mocksRes.count || 0,
        quizzesTaken: quizzesRes.count || 0
      })

    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profile.full_name })
      .eq('id', profile.id)

    setSaving(false)
    if (!error) {
      alert("Profile updated successfully!")
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">Loading Profile...</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      
      <div className="mb-8 border-b border-slate-200 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Profile</h1>
          <p className="text-slate-500 mt-2 text-sm">Manage your personal information and preferences.</p>
        </div>
        <button 
          onClick={handleSignOut}
          className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Stats & Meta */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-md text-center">
            <div className="w-20 h-20 bg-indigo-500 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-black shadow-inner">
              {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : '👤'}
            </div>
            <h2 className="text-xl font-black truncate">{profile.full_name || 'Candidate'}</h2>
            <p className="text-indigo-200 text-xs font-medium mt-1 uppercase tracking-wider">{profile.role}</p>
            <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-400">
              Joined {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Lifetime Activity</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Tasks Completed</span>
                <span className="text-lg font-black text-indigo-600">{stats.tasksCompleted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Mocks Attempted</span>
                <span className="text-lg font-black text-emerald-600">{stats.mocksTaken}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Quizzes Taken</span>
                <span className="text-lg font-black text-blue-600">{stats.quizzesTaken}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Settings Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6">Account Details</h3>
            
            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                <input 
                  type="text" 
                  value={profile.full_name}
                  onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  placeholder="Enter your name"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={profile.email}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-500 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400 mt-1">Email cannot be changed directly.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">Study Preferences</h3>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Schedule Format</label>
                <select 
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  defaultValue="slot"
                >
                  <option value="slot">Slot-Based Blocks (Advanced)</option>
                  <option value="time">Strict Timetable (Traditional)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Slot-based formatting is highly recommended for structured revision.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button 
                type="submit"
                disabled={saving}
                className="bg-slate-900 hover:bg-slate-800 text-white font-black py-3 px-8 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}