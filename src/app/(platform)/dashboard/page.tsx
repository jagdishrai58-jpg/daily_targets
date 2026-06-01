'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Pre-defined list of upcoming major competitive exams
const UPCOMING_EXAMS = [
  { id: 'rbi_assistant_mains', name: 'RBI Assistant Mains', date: '2026-06-07T00:00:00' },
  { id: 'ibps_po_pre', name: 'IBPS PO Prelims', date: '2026-10-15T00:00:00' },
  { id: 'sbi_po_pre', name: 'SBI PO Prelims', date: '2026-11-20T00:00:00' },
  { id: 'ibps_so_it', name: 'IBPS SO IT Officer', date: '2026-12-28T00:00:00' },
  { id: 'ssc_cgl_tier1', name: 'SSC CGL Tier 1', date: '2026-09-01T00:00:00' },
]

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string>('Candidate')
  
  // Dashboard Widgets State
  const [todayTasks, setTodayTasks] = useState({ total: 0, completed: 0 })
  const [latestMock, setLatestMock] = useState<any>(null)

  // Multi-Exam Target State
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>(['rbi_assistant_mains'])
  const [isEditingExams, setIsEditingExams] = useState(false)
  const [isSavingExams, setIsSavingExams] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // 1. Fetch Name AND Saved Exam Preferences
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, target_exam')
        .eq('id', user.id)
        .single()
      
      if (profile?.full_name) setUserName(profile.full_name.split(' ')[0])
      
      // Split the comma-separated string back into an array
      if (profile?.target_exam) {
        setSelectedExamIds(profile.target_exam.split(','))
      }

      // 2. Fetch Today's Tasks Snapshot
      const todayStr = new Date().toLocaleDateString('en-CA')
      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('id')
        .eq('task_date', todayStr)
      
      if (tasks && tasks.length > 0) {
        const { data: progress } = await supabase
          .from('user_task_progress')
          .select('is_completed')
          .eq('user_id', user.id)
          .in('task_id', tasks.map(t => t.id))
        
        const completedCount = progress?.filter(p => p.is_completed).length || 0
        setTodayTasks({ total: tasks.length, completed: completedCount })
      }

      // 3. Fetch Latest Mock Score
      const { data: mocks } = await supabase
        .from('mock_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('attempt_date', { ascending: false })
        .limit(1)
      
      if (mocks && mocks.length > 0) {
        setLatestMock(mocks[0])
      }
    }
    setLoading(false)
  }

  const toggleExamSelection = (id: string) => {
    setSelectedExamIds(prev => 
      prev.includes(id) 
        ? prev.filter(examId => examId !== id) 
        : [...prev, id]
    )
  }

  const saveExamPreferences = async () => {
    if (selectedExamIds.length === 0) return // Prevent saving empty list
    setIsSavingExams(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Save as a simple comma-separated string to avoid database array errors
      const joinedString = selectedExamIds.join(',')
      await supabase.from('profiles').update({ target_exam: joinedString }).eq('id', user.id)
    }
    
    setIsSavingExams(false)
    setIsEditingExams(false)
  }

  // Dynamically build and sort the stack of selected exams
  const activeExams = UPCOMING_EXAMS
    .filter(exam => selectedExamIds.includes(exam.id))
    .map(exam => {
      const diffTime = new Date(exam.date).getTime() - new Date().getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return { ...exam, daysLeft: Math.max(0, diffDays) }
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500 font-bold animate-pulse">Booting up Command Center...</div>

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 pt-4 md:pt-8 px-4 md:px-8 pb-4">
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 pb-20 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
        
        {/* === COMBINED HEADER & MILESTONES SECTION === */}
        <div className="flex flex-col gap-5">
          
          {/* Title & Action Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1 shrink-0">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Command Center</h1>
              <p className="text-slate-500 text-sm mt-1">Welcome back, {userName}. Let's get to work.</p>
            </div>
            <button 
              onClick={() => isEditingExams ? fetchDashboardData().then(() => setIsEditingExams(false)) : setIsEditingExams(true)} 
              className="text-sm font-bold text-indigo-700 hover:text-indigo-900 transition-colors bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded-lg shrink-0"
            >
              {isEditingExams ? 'Cancel Edit' : 'Manage Goals ⚙️'}
            </button>
          </div>

          {/* Exam Banner Stack (or Editor) */}
          {isEditingExams ? (
            <div className="bg-white rounded-2xl p-6 border border-indigo-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <p className="text-sm font-bold text-slate-800 mb-4">Select all exams you are targeting this year:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {UPCOMING_EXAMS.map(exam => (
                  <label key={exam.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedExamIds.includes(exam.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-indigo-600 rounded"
                      checked={selectedExamIds.includes(exam.id)}
                      onChange={() => toggleExamSelection(exam.id)}
                    />
                    <div>
                      <p className={`text-sm font-bold ${selectedExamIds.includes(exam.id) ? 'text-indigo-900' : 'text-slate-700'}`}>{exam.name}</p>
                      <p className="text-xs font-medium text-slate-500">{new Date(exam.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </label>
                ))}
              </div>
              
              <button 
                onClick={saveExamPreferences}
                disabled={selectedExamIds.length === 0 || isSavingExams}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black py-3 rounded-xl transition-colors"
              >
                {isSavingExams ? 'Saving Preferences...' : 'Save Milestones'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeExams.map((exam, index) => (
                <div 
                  key={exam.id} 
                  className={`rounded-2xl p-4 md:px-6 flex items-center justify-between shadow-sm relative overflow-hidden ${
                    index === 0 
                      ? 'bg-gradient-to-r from-indigo-900 to-blue-800 text-white border-none' 
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="z-10 flex-1">
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${index === 0 ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {index === 0 ? 'Next Up' : 'Following'}
                    </p>
                    <h3 className={`text-lg md:text-xl font-black truncate ${index === 0 ? 'text-white' : 'text-slate-900'}`}>
                      {exam.name}
                    </h3>
                    <p className={`text-xs mt-1 ${index === 0 ? 'text-indigo-200' : 'text-slate-500'}`}>
                      {new Date(exam.date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  <div className={`z-10 backdrop-blur-md px-4 md:px-6 py-2 md:py-3 rounded-xl text-center shrink-0 border ${
                    index === 0 
                      ? 'bg-white/10 border-white/20' 
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span className={`block text-2xl md:text-3xl font-black ${index === 0 ? 'text-white' : 'text-indigo-600'}`}>
                      {exam.daysLeft}
                    </span>
                    <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${index === 0 ? 'text-indigo-200' : 'text-slate-500'}`}>
                      Days Left
                    </span>
                  </div>
                </div>
              ))}
              
              {activeExams.length === 0 && (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                  <p className="font-bold mb-2">No milestones set.</p>
                  <button onClick={() => setIsEditingExams(true)} className="text-indigo-600 text-sm font-bold hover:underline">Select your target exams</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* === REST OF THE WIDGETS === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          
          {/* Widget 1: Today's Action Plan */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="bg-amber-100 text-amber-700 p-2 rounded-lg text-xl">📝</span>
                <h3 className="font-bold text-slate-800 text-lg">Today's Action Plan</h3>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center py-4">
              {todayTasks.total === 0 ? (
                <p className="text-slate-400 text-center text-sm font-medium">No tasks assigned for today yet.</p>
              ) : (
                <div className="text-center">
                  <div className="text-5xl font-black text-slate-800 mb-2">
                    {todayTasks.completed} <span className="text-2xl text-slate-400">/ {todayTasks.total}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-6">Tasks Completed</p>
                  
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-1000 bg-amber-500" 
                      style={{ width: `${(todayTasks.completed / todayTasks.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            <Link href="/todo" className="mt-auto block w-full text-center bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 transition text-sm">
              Open To-Do List →
            </Link>
          </div>

          {/* Widget 2: Latest Performance */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-100 text-emerald-700 p-2 rounded-lg text-xl">🎯</span>
                <h3 className="font-bold text-slate-800 text-lg">Latest Mock</h3>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {!latestMock ? (
                <p className="text-slate-400 text-center text-sm font-medium">No mocks logged yet.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Exam</p>
                    <p className="font-bold text-slate-800 truncate">{latestMock.exam_name}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Score</p>
                      <p className="text-2xl font-black text-indigo-600">{latestMock.scored_marks} <span className="text-sm font-medium text-slate-400">/ {latestMock.total_marks}</span></p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Accuracy</p>
                      <p className={`text-2xl font-black ${latestMock.accuracy >= 90 ? 'text-emerald-600' : 'text-orange-500'}`}>{latestMock.accuracy}%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link href="/mocks" className="mt-6 block w-full text-center bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 transition text-sm">
              View Full Analytics →
            </Link>
          </div>

        </div>

        {/* Quick Launch Panel */}
        <div>
          <h3 className="font-bold text-slate-800 mb-4 px-1">Quick Launch</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            
            <Link href="/daily-ca" className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition text-center group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📅</div>
              <p className="font-bold text-slate-700 text-sm">Daily CA</p>
            </Link>
            
            {/* Added Daily RC Link here */}
            <Link href="/editorial" className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition text-center group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📰</div>
              <p className="font-bold text-slate-700 text-sm">Daily RC</p>
            </Link>

            <Link href="/weekly-ca" className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition text-center group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🗓️</div>
              <p className="font-bold text-slate-700 text-sm">Weekly Sets</p>
            </Link>
            
            <Link href="/computer" className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition text-center group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">💻</div>
              <p className="font-bold text-slate-700 text-sm">Computer IT</p>
            </Link>
            
            <Link href="/scores" className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-rose-400 hover:shadow-md transition text-center group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📈</div>
              <p className="font-bold text-slate-700 text-sm">Quiz Scores</p>
            </Link>

          </div>
        </div>

      </div>
    </div>
  )
}