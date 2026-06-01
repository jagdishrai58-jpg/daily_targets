'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type EditorialMeta = {
  id: string
  publish_date: string
  title: string
}

type EditorialResult = {
  editorial_id: string
  score: number
}

export default function EditorialLauncherPage() {
  const [editorials, setEditorials] = useState<EditorialMeta[]>([])
  const [results, setResults] = useState<Record<string, EditorialResult>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEditorialsAndResults = async () => {
      try {
        // 1. Get current logged-in user
        const { data: { session } } = await supabase.auth.getSession()

        // 2. Fetch all available Editorials
        const { data: edData, error: edError } = await supabase
          .from('editorials')
          .select('id, publish_date, title')
          .order('publish_date', { ascending: false })

        if (edError) throw edError
        if (edData) setEditorials(edData)

        // 3. Fetch the user's completed results
        if (session) {
          const { data: resData, error: resError } = await supabase
            .from('editorial_results')
            .select('editorial_id, score')
            .eq('user_id', session.user.id)

          if (resError) throw resError
          
          if (resData) {
            // Map results by editorial_id for instant lookup
            const resultsMap: Record<string, EditorialResult> = {}
            resData.forEach(r => {
              resultsMap[r.editorial_id] = r
            })
            setResults(resultsMap)
          }
        }
      } catch (err) {
        console.error('Failed to load editorials list', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEditorialsAndResults()
  }, [])

  // Format date nicely (e.g., "1st June 2026")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto font-sans">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📰</span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Daily Editorial RC</h1>
        </div>
        <p className="text-slate-500 font-medium">Practice Reading Comprehension with daily passages.</p>
      </div>

      {loading ? (
        <div className="text-slate-400 font-bold animate-pulse">Loading editorials...</div>
      ) : editorials.length === 0 ? (
        <div className="text-slate-400 font-medium bg-slate-50 p-8 rounded-xl border border-slate-200 text-center">
          No Editorials uploaded yet. Check back later!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {editorials.map((ed) => {
            const result = results[ed.id]
            const isCompleted = !!result

            return (
              <div key={ed.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col hover:shadow-md transition-shadow relative">
                
                {/* Status Badge */}
                {isCompleted ? (
                  <div className="absolute top-6 right-6 bg-emerald-50 border border-emerald-200 text-emerald-600 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 uppercase tracking-wider">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    Done
                  </div>
                ) : (
                  <div className="absolute top-6 right-6 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                    Daily
                  </div>
                )}

                <div className="flex-1">
                  <h2 className="mt-2 text-xl font-bold text-slate-900 line-clamp-2 leading-snug pr-16">
                    {ed.title}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mt-2">
                    {formatDate(ed.publish_date)}
                  </p>
                </div>
                
                <div className="mt-8 pt-4 border-t border-slate-100">
                  {isCompleted ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-bold text-slate-500">
                        Score: <span className="text-indigo-600 text-base ml-1">{result.score.toFixed(2)}</span>
                      </div>
                      <Link 
                        href={`/editorial/${ed.id}`}
                        className="text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm text-sm"
                      >
                        Review Passage &rarr;
                      </Link>
                    </div>
                  ) : (
                    <Link 
                      href={`/editorial/${ed.id}`}
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm"
                    >
                      Start Passage
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}