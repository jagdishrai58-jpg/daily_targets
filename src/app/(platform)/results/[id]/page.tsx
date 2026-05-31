'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Quiz {
  id: string
  title: string
}

interface Ranking {
  rank: number
  total_students: number
  percentile: number
}

interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  score: number
}

interface BestResult {
  score: number
  total_correct: number
  total_wrong: number
  total_questions: number
}

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [bestResult, setBestResult] = useState<BestResult | null>(null)
  const [ranking, setRanking] = useState<Ranking>({ rank: 0, total_students: 0, percentile: 0 })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const fetchResultsData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error("Not authenticated")

        // 1. Fetch Quiz Info
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('id, title')
          .eq('id', quizId)
          .single()

        if (quizError) throw quizError
        setQuiz(quizData)

        // 2. Fetch User's Best Result for this quiz
        const { data: resultData, error: resultError } = await supabase
          .from('quiz_results')
          .select('*')
          .eq('quiz_id', quizId)
          .eq('user_id', session.user.id)
          .order('score', { ascending: false })
          .limit(1)

        if (resultData && resultData.length > 0) {
          setBestResult(resultData[0])
        }

        // 3. Fetch live Rank & Percentile
        const { data: rankData } = await supabase.rpc('get_quiz_ranking', {
          p_quiz_id: quizId,
          p_user_id: session.user.id
        })
        if (rankData) setRanking(rankData)

        // 4. Fetch Top 20 Leaderboard
        const { data: boardData } = await supabase.rpc('get_quiz_leaderboard', {
          p_quiz_id: quizId,
          p_limit: 20
        })
        if (boardData) setLeaderboard(boardData)

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (quizId) fetchResultsData()
  }, [quizId])

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">Loading analytics...</div>
  if (error) return <div className="p-8 text-red-500 font-bold">Error: {error}</div>
  if (!quiz) return <div className="p-8">Quiz not found.</div>

  const unattempted = bestResult 
    ? bestResult.total_questions - (bestResult.total_correct + bestResult.total_wrong) 
    : 0

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto font-sans pb-16">
      
      <div className="mb-6">
        <Link href="/daily-ca" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          &larr; Back to Daily CA
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm text-center p-8 mb-8">
        <h2 className="text-xl font-bold text-slate-500 uppercase tracking-wider mb-1">Performance Report</h2>
        <h1 className="text-3xl font-black text-slate-900 mb-8">{quiz.title}</h1>
        
        {bestResult ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Best Score</div>
                <div className="text-4xl font-black text-indigo-600">{bestResult.score.toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Accuracy</div>
                <div className="text-4xl font-black text-emerald-600">
                  {bestResult.total_correct + bestResult.total_wrong > 0 
                    ? Math.round((bestResult.total_correct / (bestResult.total_correct + bestResult.total_wrong)) * 100) 
                    : 0}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Global Rank</div>
                <div className="text-4xl font-black text-indigo-600">
                  {ranking.rank > 0 ? `#${ranking.rank}` : '-'}
                  <span className="text-sm font-medium text-slate-400 ml-2">of {ranking.total_students}</span>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Percentile</div>
                <div className="text-4xl font-black text-emerald-600">
                  {ranking.percentile > 0 ? `${ranking.percentile}%ile` : '-'}
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-8 text-sm font-bold text-slate-600 mb-8">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Correct: {bestResult.total_correct}</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Wrong: {bestResult.total_wrong}</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Unattempted: {unattempted}</div>
            </div>
          </>
        ) : (
          <div className="py-8 text-slate-500 font-bold">You haven't taken this test yet!</div>
        )}

        <div className="flex gap-4 justify-center">
          <Link href={`/quiz/${quiz.id}`} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">
            {bestResult ? "Retake Test" : "Start Test"}
          </Link>
          <Link href="/dashboard" className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-colors">
            Dashboard
          </Link>
        </div>
      </div>

      {leaderboard.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-900 p-4 text-left flex justify-between items-center">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              🏆 Top Performers
            </h3>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Live Global Board</span>
          </div>
          <div className="divide-y divide-slate-100">
            {leaderboard.map((entry) => {
              const isMe = ranking.rank === entry.rank
              
              return (
                <div key={entry.user_id} className={`flex justify-between items-center p-4 transition-colors ${isMe ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      entry.rank === 1 ? 'bg-amber-100 text-amber-700' :
                      entry.rank === 2 ? 'bg-slate-200 text-slate-700' :
                      entry.rank === 3 ? 'bg-orange-100 text-orange-800' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      #{entry.rank}
                    </div>
                    <span className={`font-bold ${isMe ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {entry.full_name} {isMe && <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">YOU</span>}
                    </span>
                  </div>
                  <div className="font-black text-slate-900">
                    {entry.score.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}