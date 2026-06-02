'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type UnifiedScore = {
  id: string
  score: number
  total_questions: number
  created_at: string
  title: string
  type: 'Quiz' | 'RC Passage'
}

export default function ScoresPage() {
  const [results, setResults] = useState<UnifiedScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchScores = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch from BOTH tables simultaneously for speed
      const [quizRes, rcRes] = await Promise.all([
        supabase
          .from('quiz_results')
          .select('id, score, total_questions, created_at, quizzes(title)')
          .eq('user_id', user.id),
        supabase
          .from('editorial_results')
          .select('id, score, total_questions, created_at, editorials(title)')
          .eq('user_id', user.id)
      ])

      // 1. Format standard quizzes
      const formattedQuizzes: UnifiedScore[] = (quizRes.data || []).map((q: any) => ({
        id: q.id,
        score: q.score,
        total_questions: q.total_questions,
        created_at: q.created_at,
        // Handle potential array return from Supabase joins
        title: Array.isArray(q.quizzes) ? q.quizzes[0]?.title : q.quizzes?.title || 'Unknown Quiz',
        type: 'Quiz'
      }))

      // 2. Format RC passages
      const formattedRCs: UnifiedScore[] = (rcRes.data || []).map((rc: any) => ({
        id: rc.id,
        score: rc.score,
        total_questions: rc.total_questions,
        created_at: rc.created_at,
        title: Array.isArray(rc.editorials) ? rc.editorials[0]?.title : rc.editorials?.title || 'Unknown Passage',
        type: 'RC Passage'
      }))

      // 3. Combine them and sort by newest first
      const combined = [...formattedQuizzes, ...formattedRCs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setResults(combined)
      setLoading(false)
    }

    fetchScores()
  }, [])

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">Loading your performance data...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 font-sans">
      <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">My Performance</h1>
      <p className="text-slate-500 font-medium mb-8">Track your Daily CA, Banking Awareness, and RC scores over time.</p>

      {results.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No tests taken yet!</h3>
          <p className="text-slate-500 font-medium mb-6">Head over to the dashboard to start practicing.</p>
          <Link href="/dashboard" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm inline-block">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4 pl-6">Date Taken</th>
                  <th className="p-4">Test Name</th>
                  <th className="p-4">Score</th>
                  <th className="p-4 pr-6">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((result) => {
                  // Safely handle total_questions being 0
                  const percentage = result.total_questions > 0 
                    ? Math.round((result.score / result.total_questions) * 100) 
                    : 0
                  
                  const date = new Date(result.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })

                  return (
                    <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 pl-6 text-slate-500 text-sm font-medium">{date}</td>
                      <td className="p-4">
                        <p className="font-bold text-slate-900">{result.title}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          result.type === 'RC Passage' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {result.type}
                        </span>
                      </td>
                      <td className="p-4 font-black text-slate-700 text-lg">
                        {/* Use toFixed to handle decimal scores from RC negative marking cleanly */}
                        {Number.isInteger(result.score) ? result.score : result.score.toFixed(2)} 
                        <span className="text-sm font-medium text-slate-400 ml-1">/ {result.total_questions}</span>
                      </td>
                      <td className="p-4 pr-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                          percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                          percentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {percentage}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}