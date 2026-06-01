'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Question = {
  id: number
  text: string
  options: string[]
  correctAnswerIndex: number
  explanation: string
}

type EditorialContent = {
  passage: string[]
  questions: Question[]
}

type EditorialRecord = {
  id: string
  publish_date: string
  title: string
  content: EditorialContent
}

export default function EditorialQuizEngine() {
  const params = useParams()
  const router = useRouter()
  const editorialId = params.id as string

  // Fetch State
  const [editorial, setEditorial] = useState<EditorialRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // Test Engine State
  const [hasStarted, setHasStarted] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Trackers
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set())

  // Timer & Scoring
  const TIME_LIMIT_SECONDS = 600 // 10 Minutes for an RC passage
  const [timeLeft, setTimeLeft] = useState<number>(TIME_LIMIT_SECONDS)
  const [results, setResults] = useState({ score: 0, correct: 0, wrong: 0, unattempted: 0 })

  // 1. Initial Data Fetch
  useEffect(() => {
    const fetchEditorialAndResult = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        // Fetch the RC content
        const { data: editorialData, error: editorialError } = await supabase
          .from('editorials')
          .select('*')
          .eq('id', editorialId)
          .single()

        if (editorialError) throw editorialError
        setEditorial(editorialData as EditorialRecord)

        // Check if already attempted
        const { data: resultData } = await supabase
          .from('editorial_results')
          .select('score, user_answers')
          .eq('editorial_id', editorialId)
          .eq('user_id', session.user.id)
          .single()

        if (resultData) {
          setIsReviewMode(true)
          setIsSubmitted(true)
          setAnswers(resultData.user_answers)
          
          let correct = 0, wrong = 0, unattempted = 0
          editorialData.content.questions.forEach((q: Question, idx: number) => {
            if (resultData.user_answers[idx] === undefined) unattempted++
            else if (resultData.user_answers[idx] === q.correctAnswerIndex) correct++
            else wrong++
          })
          setResults({ score: resultData.score, correct, wrong, unattempted })
        }
      } catch (error) {
        console.error("Failed to load editorial:", error)
      } finally {
        setLoading(false)
      }
    }

    if (editorialId) fetchEditorialAndResult()
  }, [editorialId, router])

  // 2. Live Timer Logic
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

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">Loading exam environment...</div>
  if (!editorial) return <div className="p-8 font-bold text-slate-500">Editorial not found.</div>

  const { content } = editorial
  const currentQuestion = content.questions[currentIndex]
  const totalQuestions = content.questions.length

  const handleSelectOption = (optionIndex: number) => {
    if (isReviewMode) return
    setAnswers(prev => ({ ...prev, [currentIndex]: optionIndex }))
  }

  const handleClearResponse = () => {
    if (isReviewMode) return
    setAnswers(prev => {
      const newAnswers = { ...prev }
      delete newAnswers[currentIndex]
      return newAnswers
    })
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
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
      if (newSet.has(currentIndex)) newSet.delete(currentIndex)
      else newSet.add(currentIndex)
      return newSet
    })
    handleNext()
  }

  const calculateResults = () => {
    let correct = 0
    let wrong = 0
    let unattempted = 0

    content.questions.forEach((q, idx) => {
      const userAns = answers[idx]
      if (userAns === undefined) unattempted++
      else if (userAns === q.correctAnswerIndex) correct++
      else wrong++
    })

    const score = correct - (wrong * 0.25)
    return { score, correct, wrong, unattempted }
  }

  const handleAutoSubmit = async () => {
    const finalResults = calculateResults()
    setResults(finalResults)
    setIsSubmitted(true)
    setHasStarted(false)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase.from('editorial_results').insert({
      user_id: session.user.id,
      editorial_id: editorial.id,
      score: finalResults.score,
      total_questions: totalQuestions,
      user_answers: answers
    })
  }

  const handleManualSubmit = () => {
    if (window.confirm("Are you sure you want to submit the RC Passage?")) {
      handleAutoSubmit()
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }


  // ==========================================
  // SCREEN 1: START SCREEN
  // ==========================================
  if (!hasStarted && !isSubmitted) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider mb-4 inline-block">
          RC PASSAGE
        </span>
        <h1 className="text-3xl font-black text-slate-900 mb-2">{editorial.title}</h1>
        <div className="flex gap-4 text-slate-500 mb-8 font-medium">
          <span>⏱️ {Math.floor(TIME_LIMIT_SECONDS / 60)} Minutes</span>
          <span>📝 {totalQuestions} Questions</span>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-8 text-sm text-blue-800">
          <strong>Instructions:</strong> Negative marking of 0.25 is applicable. Once started, the timer cannot be paused.
        </div>
        <button onClick={() => setHasStarted(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-sm">
          Start Passage Now
        </button>
      </div>
    )
  }

  // ==========================================
  // SCREEN 2: POST-SUBMISSION RESULTS
  // ==========================================
  if (isSubmitted && !isReviewMode) {
    const accuracy = results.correct + results.wrong > 0 
      ? Math.round((results.correct / (results.correct + results.wrong)) * 100) 
      : 0

    return (
      <div className="max-w-4xl mx-auto mt-10 p-8 bg-slate-50 font-sans pb-16">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm text-center p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-500 uppercase tracking-wider mb-1">Passage Completed</h2>
          <h1 className="text-3xl font-black text-slate-900 mb-8">{editorial.title}</h1>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Final Score</div>
              <div className="text-4xl font-black text-indigo-600">{results.score.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Accuracy</div>
              <div className="text-4xl font-black text-emerald-600">{accuracy}%</div>
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
            <button onClick={() => router.push('/editorial')} className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-colors">
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // SCREEN 3: ACTIVE TEST & REVIEW ENGINE
  // ==========================================
  return (
    // STRICT desktop row layout. No responsive stacking. 
    <div className="flex flex-row h-screen w-full bg-slate-100 font-sans overflow-hidden min-w-[1024px] overflow-x-auto">
      
      {/* LEFT: Passage Panel (40% width) */}
      <div className="w-[40%] h-full overflow-y-auto bg-white border-r border-slate-200 p-8 shrink-0 relative">
        <button 
          onClick={() => router.push('/editorial')}
          className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Exit
        </button>

        <h1 className="text-2xl font-black text-slate-900 mb-6 mt-8 leading-snug tracking-tight">
          {editorial.title}
        </h1>
        <div className="space-y-4 text-slate-700 text-[15px] leading-relaxed text-justify">
          {content.passage.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </div>

      {/* MIDDLE: Question Engine */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        {/* Header bar */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <h2 className="font-bold text-lg text-slate-800">
            RC Passage {isReviewMode && <span className="text-indigo-600 ml-2">(Review Mode)</span>}
          </h2>
          {isReviewMode ? (
            <div className="text-sm font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded">
              Score: {results.score.toFixed(2)}
            </div>
          ) : (
            <div className={`text-sm font-black px-3 py-1 rounded border transition-colors ${timeLeft < 60 ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'text-red-600 bg-red-50 border-red-100'}`}>
              Time: {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex gap-4 mb-8">
            <span className="flex-shrink-0 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
              {currentIndex + 1}
            </span>
            <p className="text-lg font-medium text-slate-900 mt-0.5 whitespace-pre-wrap leading-relaxed">
              {currentQuestion?.text}
            </p>
          </div>

          <div className="space-y-4 ml-12">
            {currentQuestion?.options.map((optionText, index) => {
              const isSelected = answers[currentIndex] === index
              const isCorrect = index === currentQuestion.correctAnswerIndex
              
              const hasLabel = /^[A-E]\.\s/.test(optionText)
              const label = hasLabel ? '' : `${String.fromCharCode(65 + index)}. `

              let btnClass = 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              
              if (isReviewMode) {
                if (isCorrect) btnClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                else if (isSelected) btnClass = 'border-red-500 bg-red-50 text-red-900 font-bold'
                else btnClass = 'border-slate-200 text-slate-400 opacity-70 cursor-not-allowed'
              } else if (isSelected) {
                btnClass = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-600'
              }

              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(index)}
                  disabled={isReviewMode}
                  className={`w-full text-left px-5 py-4 rounded-lg border transition-all ${btnClass}`}
                >
                  <span className="uppercase font-bold text-slate-400 mr-2">{label}</span>
                  {optionText}
                </button>
              )
            })}
          </div>

          {isReviewMode && currentQuestion?.explanation && (
            <div className="mt-8 ml-12 p-6 bg-blue-50 border border-blue-200 rounded-xl">
              <h4 className="font-black text-blue-900 mb-2 flex items-center gap-2">
                💡 Explanation
              </h4>
              <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {isReviewMode ? (
            <div className="flex justify-between w-full">
              <button onClick={handlePrevious} disabled={currentIndex === 0} className="px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300 disabled:opacity-50 transition-colors">
                Previous
              </button>
              {/* FIX 1: This now successfully returns to the Results screen */}
              <button onClick={() => setIsReviewMode(false)} className="px-8 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 transition-colors shadow-sm">
                Back to Score
              </button>
              <button onClick={handleNext} disabled={currentIndex === totalQuestions - 1} className="px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300 disabled:opacity-50 transition-colors">
                Next
              </button>
            </div>
          ) : (
            <>
              {/* FIX 2: Matched the TCS iON style buttons perfectly */}
              <div className="flex gap-3">
                <button onClick={handleMarkForReview} className="px-6 py-2.5 bg-white border border-purple-300 text-purple-700 font-bold rounded text-sm hover:bg-purple-50 transition-colors">
                  Mark for Review & Next
                </button>
                <button onClick={handleClearResponse} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded text-sm hover:bg-slate-50 transition-colors">
                  Clear Response
                </button>
              </div>
              <button onClick={handleNext} className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                Save & Next
              </button>
            </>
          )}
        </div>
      </div>

      {/* RIGHT: Question Palette (Fixed Sidebar - 280px) */}
      <div className="w-[280px] shrink-0 h-full border-l border-slate-200 bg-white flex flex-col">
        <div className="p-4 bg-slate-900 text-white font-bold text-center shrink-0 text-sm tracking-wider uppercase">
          {isReviewMode ? 'Review Palette' : 'Question Palette'}
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          {/* FIX 3: Fixed button sizes in the grid so they never squish or stretch */}
          <div className="grid grid-cols-4 gap-2">
            {content.questions.map((q, index) => {
              const isAnswered = answers[index] !== undefined 
              const isMarked = markedForReview.has(index)
              const isCurrent = index === currentIndex
              
              let bgColor = 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              
              if (isReviewMode) {
                const isCorrect = answers[index] === q.correctAnswerIndex
                if (isCurrent) bgColor = 'bg-slate-100 border-slate-800 text-slate-900 border-2'
                else if (isCorrect) bgColor = 'bg-emerald-500 border-emerald-600 text-white'
                else if (isAnswered) bgColor = 'bg-red-500 border-red-600 text-white'
                else bgColor = 'bg-slate-100 border-slate-200 text-slate-400'
              } else {
                if (isCurrent) bgColor = 'bg-slate-100 border-slate-800 text-slate-900 border-2 shadow-sm'
                else if (isMarked && isAnswered) bgColor = 'bg-purple-600 border-purple-700 text-white relative shadow-sm'
                else if (isMarked) bgColor = 'bg-purple-500 border-purple-600 text-white shadow-sm'
                else if (isAnswered) bgColor = 'bg-green-500 border-green-600 text-white shadow-sm'
              }

              return (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-12 w-full rounded flex items-center justify-center font-bold border transition-colors ${bgColor}`}
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
          <div className="p-4 border-t border-slate-200 shrink-0">
            <button onClick={handleManualSubmit} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-sm shadow-sm transition-colors uppercase tracking-wide">
              Submit Test
            </button>
          </div>
        )}
      </div>

    </div>
  )
}