'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Question {
  id: string
  quiz_id: string
  question_text: string
  options: string[]
  correct_option: number 
  explanation?: string
}

interface Quiz {
  id: string
  title: string
  time_limit_minutes: number
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

export default function QuizTakingEngine() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  // Fetch State
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Test Engine State
  const [hasStarted, setHasStarted] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isReviewMode, setIsReviewMode] = useState(false) 
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({}) 
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set())

  // Timer & Scoring State
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [results, setResults] = useState({ score: 0, correct: 0, wrong: 0, unattempted: 0 })
  const [ranking, setRanking] = useState<Ranking>({ rank: 0, total_students: 0, percentile: 0 })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // 1. Initial Data Fetch
  useEffect(() => {
    const fetchQuizData = async () => {
      try {
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', quizId)
          .single()

        if (quizError) throw quizError

        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_id', quizId)
          .order('id', { ascending: true })

        if (questionError) throw questionError

        setQuiz(quizData)
        setQuestions(questionData || [])
        const timeLimit = quizData.time_limit_minutes || 20
        setTimeLeft(timeLimit * 60) 
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (quizId) fetchQuizData()
  }, [quizId])

  // 2. The Live Timer Logic
  useEffect(() => {
    if (!hasStarted || isSubmitted || isReviewMode || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleAutoSubmit() 
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasStarted, isSubmitted, isReviewMode, timeLeft])

  // --- Engine Logic ---
  const currentQuestion = questions[currentIndex]

  const handleSelectOption = (optionIndex: number) => {
    if (isReviewMode) return 
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: optionIndex }))
  }

  const handleClearResponse = () => {
    if (isReviewMode) return
    setAnswers(prev => {
      const newAnswers = { ...prev }
      delete newAnswers[currentQuestion.id]
      return newAnswers
    })
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const handleMarkForReview = () => {
    if (isReviewMode) return
    setMarkedForReview(prev => {
      const newSet = new Set(prev)
      if (newSet.has(currentQuestion.id)) newSet.delete(currentQuestion.id)
      else newSet.add(currentQuestion.id)
      return newSet
    })
    handleNext()
  }

  // 3. The Grading & Ranking Engine
  const calculateResults = () => {
    let correct = 0
    let wrong = 0
    let unattempted = 0

    questions.forEach(q => {
      const userAns = answers[q.id]
      if (userAns === undefined) {
        unattempted++
      } else {
        if (userAns === q.correct_option - 1) correct++
        else wrong++
      }
    })

    const score = correct - (wrong * 0.25)
    return { score, correct, wrong, unattempted }
  }

  const handleAutoSubmit = async () => {
    const finalResults = calculateResults()
    setResults(finalResults)
    setIsSubmitted(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Save score to database
    const { error: insertError } = await supabase.from('quiz_results').insert({
      user_id: session.user.id,
      quiz_id: quizId,
      score: finalResults.score,
      total_correct: finalResults.correct,
      total_wrong: finalResults.wrong,
      total_questions: questions.length, 
    })

    if (insertError) {
      console.error("Failed to save score:", insertError.message)
    }

    // Fetch precise rank and percentile
    const { data: rankData, error: rankError } = await supabase.rpc('get_quiz_ranking', {
      p_quiz_id: quizId,
      p_user_id: session.user.id
    })

    if (rankData && !rankError) {
      setRanking(rankData)
    }

    // Fetch the Leaderboard
    const { data: boardData, error: boardError } = await supabase.rpc('get_quiz_leaderboard', {
      p_quiz_id: quizId,
      p_limit: 20 
    })

    if (boardError) {
      console.error("Leaderboard Fetch Error:", boardError.message)
    }

    if (boardData && !boardError) {
      setLeaderboard(boardData)
    }
  }

  const handleManualSubmit = () => {
    if (window.confirm("Are you sure you want to submit the test?")) {
      handleAutoSubmit()
    }
  }

  const handleReattempt = () => {
    setAnswers({})
    setMarkedForReview(new Set())
    setCurrentIndex(0)
    setIsSubmitted(false)
    setIsReviewMode(false)
    setHasStarted(true)
    const timeLimit = quiz?.time_limit_minutes || 20
    setTimeLeft(timeLimit * 60)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // --- Rendering ---
  if (loading) return <div className="p-8 text-slate-500 font-bold">Loading test environment...</div>
  if (error) return <div className="p-8 text-red-500 font-bold">Error: {error}</div>
  if (!quiz || questions.length === 0) return <div className="p-8">Quiz not found or has no questions.</div>

  // SCREEN 1: START SCREEN
  if (!hasStarted) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
        <h1 className="text-3xl font-black text-slate-900 mb-2">{quiz.title}</h1>
        <div className="flex gap-4 text-slate-500 mb-8 font-medium">
          <span>⏱️ {quiz.time_limit_minutes || 20} Minutes</span>
          <span>📝 {questions.length} Questions</span>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-8 text-sm text-blue-800">
          <strong>Instructions:</strong> Negative marking of 0.25 is applicable. Once started, the timer cannot be paused.
        </div>
        <button onClick={() => setHasStarted(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
          Start Test Now
        </button>
      </div>
    )
  }

  // SCREEN 2: POST-SUBMISSION RESULTS
  if (isSubmitted && !isReviewMode) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-8 bg-slate-50 font-sans pb-16">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm text-center p-8 mb-8">
          <h2 className="text-3xl font-black text-slate-900 mb-6">Test Submitted!</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Score</div>
              <div className="text-4xl font-black text-indigo-600">{results.score.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Accuracy</div>
              <div className="text-4xl font-black text-emerald-600">
                {results.correct + results.wrong > 0 
                  ? Math.round((results.correct / (results.correct + results.wrong)) * 100) 
                  : 0}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Your Rank</div>
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
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Correct: {results.correct}</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Wrong: {results.wrong}</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Unattempted: {results.unattempted}</div>
          </div>

          <div className="flex gap-4 justify-center">
            <button onClick={() => setIsReviewMode(true)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">
              Review Mistakes
            </button>
            <button onClick={handleReattempt} className="px-8 py-3 bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 font-bold rounded-lg transition-colors">
              Reattempt Test
            </button>
            <button onClick={() => router.push('/dashboard')} className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-colors">
              Dashboard
            </button>
          </div>
        </div>

        {leaderboard.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-900 p-4 text-left">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                🏆 Top Performers
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {leaderboard.map((entry) => {
                const isMe = ranking.rank === entry.rank && results.score === entry.score
                
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

  // SCREEN 3: ACTIVE TEST & REVIEW ENVIRONMENT
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      
      {/* LEFT: Main Question Area */}
      <div className="flex-1 flex flex-col bg-white">
        
        {/* Header bar */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-bold text-lg text-slate-800">
            {quiz.title} {isReviewMode && <span className="text-indigo-600 ml-2">(Review Mode)</span>}
          </h2>
          
          {isReviewMode ? (
            <div className="text-lg font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-1 rounded">
              Score: {results.score.toFixed(2)}
            </div>
          ) : (
            <div className={`text-lg font-black px-4 py-1 rounded border transition-colors ${timeLeft < 60 ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'text-red-600 bg-red-50 border-red-100'}`}>
              Time: {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Question Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex gap-4 mb-6">
            <span className="flex-shrink-0 w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-lg">
              {currentIndex + 1}
            </span>
            <p className="text-lg font-medium text-slate-900 mt-1 whitespace-pre-wrap">
              {currentQuestion?.question_text}
            </p>
          </div>

          <div className="space-y-3 ml-14">
            {currentQuestion?.options && currentQuestion.options.map((optionText, index) => {
              const isSelected = answers[currentQuestion.id] === index
              const isCorrect = index === currentQuestion.correct_option - 1
              const label = String.fromCharCode(65 + index)

              let btnClass = 'border-slate-200 text-slate-700 hover:border-slate-300'
              
              if (isReviewMode) {
                if (isCorrect) {
                  btnClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                } else if (isSelected) {
                  btnClass = 'border-red-500 bg-red-50 text-red-900 font-bold'
                } else {
                  btnClass = 'border-slate-200 text-slate-400 opacity-70 cursor-not-allowed'
                }
              } else if (isSelected) {
                btnClass = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
              }

              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(index)}
                  disabled={isReviewMode}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${btnClass}`}
                >
                  <span className="uppercase mr-3 inline-block w-6 font-bold text-slate-400">
                    {label}.
                  </span>
                  {optionText}
                </button>
              )
            })}
          </div>

          {/* Explanation Reveal (Only in Review Mode) */}
          {isReviewMode && currentQuestion?.explanation && (
            <div className="mt-8 ml-14 p-6 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-black text-slate-900 mb-2 flex items-center gap-2">
                💡 Explanation
              </h4>
              <p className="text-slate-700 leading-relaxed">
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          {isReviewMode ? (
            <div className="flex justify-between w-full">
              <button onClick={handlePrevious} disabled={currentIndex === 0} className="px-8 py-2 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300 disabled:opacity-50">
                Previous
              </button>
              <button onClick={() => setIsReviewMode(false)} className="px-8 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">
                Exit Review
              </button>
              <button onClick={handleNext} disabled={currentIndex === questions.length - 1} className="px-8 py-2 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300 disabled:opacity-50">
                Next
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button onClick={handleMarkForReview} className="px-6 py-2 border border-purple-300 text-purple-700 font-bold rounded hover:bg-purple-50">
                  Mark for Review & Next
                </button>
                <button onClick={handleClearResponse} className="px-6 py-2 border border-slate-300 text-slate-600 font-bold rounded hover:bg-slate-100">
                  Clear Response
                </button>
              </div>
              <button onClick={handleNext} className="px-8 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">
                Save & Next
              </button>
            </>
          )}
        </div>
      </div>

      {/* RIGHT: Question Palette Panel */}
      <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
        <div className="p-4 bg-slate-800 text-white font-bold text-center">
          {isReviewMode ? 'Review Palette' : 'Question Palette'}
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, index) => {
              const isAnswered = answers[q.id] !== undefined 
              const isMarked = markedForReview.has(q.id)
              const isCurrent = index === currentIndex
              
              let bgColor = 'bg-white border-slate-300 text-slate-600'
              
              if (isReviewMode) {
                const isCorrect = answers[q.id] === q.correct_option - 1
                if (isCurrent) bgColor = 'bg-slate-100 border-slate-800 text-slate-900 border-2'
                else if (isCorrect) bgColor = 'bg-emerald-500 border-emerald-600 text-white'
                else if (isAnswered) bgColor = 'bg-red-500 border-red-600 text-white'
                else bgColor = 'bg-slate-100 border-slate-200 text-slate-400'
              } else {
                if (isCurrent) bgColor = 'bg-slate-100 border-slate-800 text-slate-900 border-2'
                else if (isMarked && isAnswered) bgColor = 'bg-purple-600 border-purple-700 text-white relative'
                else if (isMarked) bgColor = 'bg-purple-500 border-purple-600 text-white'
                else if (isAnswered) bgColor = 'bg-green-500 border-green-600 text-white'
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-12 w-full rounded font-bold border transition-colors ${bgColor}`}
                >
                  {index + 1}
                  {!isReviewMode && isMarked && isAnswered && (
                     <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-300 rounded-full"></span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {!isReviewMode && (
          <div className="p-4 border-t border-slate-200">
            <button onClick={handleManualSubmit} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-lg shadow-sm">
              Submit Test
            </button>
          </div>
        )}
      </div>
    </div>
  )
}