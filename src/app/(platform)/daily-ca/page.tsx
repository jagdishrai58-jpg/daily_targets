'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function DailyCAPage() {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [completedQuizzes, setCompletedQuizzes] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch ONLY 'daily' quizzes
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('quiz_type', 'daily')
        .order('publish_date', { ascending: false })

      const { data: resultsData } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', user.id)

      if (quizData) setQuizzes(quizData)

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
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">Loading Daily CA...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-black text-slate-900 flex items-center">
          <span className="mr-3 text-4xl">📅</span> Daily Current Affairs
        </h1>
        <p className="text-slate-500 mt-2 text-lg">Stay updated with bite-sized daily quizzes.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => {
          const score = completedQuizzes[quiz.id]
          const isCompleted = score !== undefined

          return (
            <div key={quiz.id} className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold uppercase rounded-full">Daily</span>
                  {isCompleted && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">✓ Done</span>}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{quiz.title}</h3>
                <p className="text-sm text-slate-500 font-medium">{new Date(quiz.publish_date).toLocaleDateString()}</p>
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                {isCompleted ? (
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-500">
                      Best: <span className="text-emerald-600 font-black">{score}%</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* NEW: View Results Button */}
                      <Link 
                        href={`/results/${quiz.id}`} 
                        className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        Results
                      </Link>
                      
                      {/* Existing Retake Button (Restyled) */}
                      <Link 
                        href={`/quiz/${quiz.id}`} 
                        className="text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
                      >
                        Retake <span aria-hidden="true">&rarr;</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <Link 
                    href={`/quiz/${quiz.id}`} 
                    className="block w-full text-center bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Start Quiz
                  </Link>
                )}
              </div>
            </div>
          )
        })}

        {quizzes.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            No Daily CA quizzes found. Add some from the Admin Panel!
          </div>
        )}
      </div>
    </div>
  )
}