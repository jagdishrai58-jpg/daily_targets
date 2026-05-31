'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function WeeklyCAPage() {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [completedQuizzes, setCompletedQuizzes] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWeeklyQuizzes() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // 1. Fetch only quizzes matching 'weekly' type
        const { data: quizData, error: supabaseError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('quiz_type', 'weekly')
          .order('publish_date', { ascending: false })

        if (supabaseError) throw supabaseError

        // 2. Fetch User Results for the Completion Badges
        const { data: resultsData, error: resultsError } = await supabase
          .from('quiz_results')
          .select('*')
          .eq('user_id', user.id)

        if (resultsError) throw resultsError

        if (quizData) setQuizzes(quizData)

        // 3. Map out the best scores
        if (resultsData) {
          const completedMap: Record<string, number> = {}
          resultsData.forEach(res => {
            const pct = Math.round((res.score / res.total_questions) * 100)
            if (!completedMap[res.quiz_id] || pct > completedMap[res.quiz_id]) {
              completedMap[res.quiz_id] = pct
            }
          })
          setCompletedQuizzes(completedMap)
        }
      } catch (err: any) {
        console.error('Error loading weekly quizzes:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchWeeklyQuizzes()
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 transition">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-800 mt-2">Weekly Current Affairs</h1>
        <p className="text-slate-500 text-sm">Select a weekly compilation set to begin your practice run.</p>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400 animate-pulse text-sm">
          Fetching live sets from database...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to load quizzes: {error}
        </div>
      )}

      {!loading && !error && quizzes.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-slate-50/50">
          <p className="text-slate-400 text-sm">No weekly quizzes available right now.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quizzes.map((quiz) => {
          const score = completedQuizzes[quiz.id]
          const isCompleted = score !== undefined

          return (
            <div 
              key={quiz.id} 
              className="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-purple-400 hover:shadow-md transition flex flex-col overflow-hidden"
            >
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-amber-50 text-amber-700 rounded border border-amber-200">
                    Weekly Set
                  </span>
                  {isCompleted && (
                    <span className="text-[10px] uppercase font-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      ✓ Done
                    </span>
                  )}
                </div>
                
                <h3 className="font-bold text-slate-800 truncate mb-1">
                  {quiz.title}
                </h3>
                <span className="text-xs text-slate-400">
                  Published: {new Date(quiz.publish_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
              
              {/* Action Bar (Changes based on Completion) */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto">
                {isCompleted ? (
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-500">
                      Best: <span className="text-emerald-600 font-black">{score}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Link href={`/results/${quiz.id}`} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                        Results
                      </Link>
                      <Link href={`/quiz/${quiz.id}`} className="text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1">
                        Retake <span aria-hidden="true">&rarr;</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <Link href={`/quiz/${quiz.id}`} className="block w-full text-center bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm">
                    Start Practice Run
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}