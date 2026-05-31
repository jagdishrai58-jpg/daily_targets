'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError("Invalid email or password.")
      setLoading(false)
      return
    }

    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', authData.user.id)
        .single()

      if (profile?.role === 'admin') {
        router.push('/admin')
      } else if (profile?.is_active === true) {
        router.push('/todo')
      } else {
        router.push('/pending')
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-black mb-6">Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded-lg text-sm" required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded-lg text-sm" required />
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
        {error && <p className="text-red-500 text-xs mt-4 font-bold">{error}</p>}
      </div>
    </div>
  )
}