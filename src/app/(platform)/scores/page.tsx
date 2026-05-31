'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ScoresPage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchScores = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch results and join with the quizzes table to get the quiz title
      const { data } = await supabase
        .from('quiz_results')
        .select(`
          id,
          score,
          total_questions,
          created_at,
          quizzes ( title )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (data) setResults(data)
      setLoading(false)
    }

    fetchScores()
  }, [])

  if (loading) return <div className="p-8 text-slate-500">Loading your performance data...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">My Performance</h1>
      <p className="text-slate-500 mb-8">Track your Daily CA and Banking Awareness scores over time.</p>

      {results.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">No quizzes taken yet!</h3>
          <p className="text-slate-500 mb-6">Head over to the dashboard to take your first test.</p>
          <Link href="/dashboard" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">Date Taken</th>
                <th className="p-4 font-semibold">Test Name</th>
                <th className="p-4 font-semibold">Score</th>
                <th className="p-4 font-semibold">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((result) => {
                const percentage = Math.round((result.score / result.total_questions) * 100)
                const date = new Date(result.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })

                return (
                  <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-600 text-sm">{date}</td>
                    <td className="p-4 font-medium text-slate-800">{result.quizzes.title}</td>
                    <td className="p-4 font-bold text-slate-700">{result.score} / {result.total_questions}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        percentage >= 80 ? 'bg-green-100 text-green-700' : 
                        percentage >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
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
      )}
    </div>
  )
}