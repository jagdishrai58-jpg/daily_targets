'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation' // Added proper Next.js router

// Helper to format dates safely
const formatDateToLocal = (date: Date) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}

export default function TodoPage() {
  const router = useRouter() // Initialize router
  
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Date & Calendar States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  
  // Tracker States
  const [trackerMap, setTrackerMap] = useState<Record<string, string>>({})
  const [loadingTracker, setLoadingTracker] = useState(true)
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})

  // 1. Fetch user ID on mount
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        
        if (user) {
          setUserId(user.id)
        } else {
          setErrorMessage("Session lost. Please log in again.")
          setLoadingTracker(false); setLoadingTasks(false)
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to authenticate session.")
        setLoadingTracker(false); setLoadingTasks(false)
      }
    }
    init()
  }, [])

  // 2. Fetch Consistency Tracker whenever the Calendar Month changes
  useEffect(() => {
    if (userId) fetchConsistencyTracker(userId, calendarMonth)
  }, [calendarMonth, userId])

  // 3. Fetch Tasks whenever Selected Date changes
  useEffect(() => {
    if (userId) {
      setTasks([]) // Clear old tasks for clean UI swap
      fetchTasksForDate(userId, selectedDate)
    }
  }, [selectedDate, userId])

  // --- Core Functions ---
  const fetchConsistencyTracker = async (uid: string, monthDate: Date) => {
    setLoadingTracker(true)
    try {
      const year = monthDate.getFullYear()
      const month = monthDate.getMonth()
      
      const startDate = new Date(year, month, 1)
      const endDate = new Date(year, month + 1, 0)
      
      const startStr = formatDateToLocal(startDate)
      const endStr = formatDateToLocal(endDate)
      
      const { data: allTasks } = await supabase.from('daily_tasks').select('id, task_date').gte('task_date', startStr).lte('task_date', endStr)
      const { data: allProgress } = await supabase.from('user_task_progress').select('task_id, is_completed').eq('user_id', uid)
      
      const dailyStats: Record<string, { total: number, completed: number }> = {}
      allTasks?.forEach(task => {
        if (!dailyStats[task.task_date]) dailyStats[task.task_date] = { total: 0, completed: 0 }
        dailyStats[task.task_date].total += 1
        const isDone = allProgress?.find(p => p.task_id === task.id)?.is_completed
        if (isDone) dailyStats[task.task_date].completed += 1
      })
      
      const todayStr = formatDateToLocal(new Date())
      const trackerObj: Record<string, string> = {}
      
      Object.keys(dailyStats).forEach(dateStr => {
        const stats = dailyStats[dateStr]
        if (stats.total > 0) {
          if (stats.completed === stats.total) trackerObj[dateStr] = 'hit'
          else if (stats.completed > 0) trackerObj[dateStr] = 'partial'
          else if (dateStr < todayStr) trackerObj[dateStr] = 'missed'
          else trackerObj[dateStr] = 'pending'
        }
      })
      
      setTrackerMap(trackerObj)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTracker(false)
    }
  }

  const fetchTasksForDate = async (uid: string, targetDate: Date) => {
    setLoadingTasks(true)
    try {
      const targetDateStr = formatDateToLocal(targetDate)
      
      const { data: masterTasks } = await supabase.from('daily_tasks').select('*').eq('task_date', targetDateStr).order('created_at', { ascending: true })
      const { data: userProgress } = await supabase.from('user_task_progress').select('*').eq('user_id', uid)

      const mergedTasks = (masterTasks || []).map(task => {
        const progress = userProgress?.find(p => p.task_id === task.id)
        return {
          ...task,
          progress_id: progress?.id || null,
          completed_amount: progress?.completed_amount || 0,
          is_completed: progress?.is_completed || false,
          admin_message: progress?.admin_message || null,
          student_reply: progress?.student_reply || null,
        }
      })
      setTasks(mergedTasks)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTasks(false)
    }
  }

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
    
    if (newDate.getMonth() !== calendarMonth.getMonth() || newDate.getFullYear() !== calendarMonth.getFullYear()) {
      setCalendarMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1))
    }
  }

  const changeMonth = (offset: number) => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + offset)
      return newDate
    })
  }

  const toggleTaskCompletion = async (task: any) => {
    if (!userId) return

    const newIsCompleted = !task.is_completed
    const newCompletedAmount = newIsCompleted ? task.target_amount : 0

    setTasks(prevTasks => prevTasks.map(t => 
      t.id === task.id ? { ...t, is_completed: newIsCompleted, completed_amount: newCompletedAmount } : t
    ))

    const payload = {
      user_id: userId, task_id: task.id, completed_amount: newCompletedAmount, is_completed: newIsCompleted, updated_at: new Date().toISOString()
    }
    await supabase.from('user_task_progress').upsert(payload, { onConflict: 'user_id, task_id' })
    fetchConsistencyTracker(userId, calendarMonth)
  }

  const handleSendReply = async (taskId: string) => {
    const replyText = replyInputs[taskId]
    if (!replyText?.trim() || !userId) return
    const payload = { user_id: userId, task_id: taskId, student_reply: replyText, updated_at: new Date().toISOString() }
    await supabase.from('user_task_progress').upsert(payload, { onConflict: 'user_id, task_id' })
    fetchTasksForDate(userId, selectedDate)
  }

  const pendingTasks = tasks.filter(t => !t.is_completed)
  const completedTasks = tasks.filter(t => t.is_completed)

  return (
    <div className="max-w-6xl mx-auto p-4 py-8 text-slate-800 font-sans bg-[#FAFBFF] min-h-screen rounded-2xl">
      
      {/* Header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Study To Do List 📘
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Plan your study. Stay consistent. Achieve your goals.</p>
        </div>
        <button 
          onClick={() => { if(userId) fetchTasksForDate(userId, selectedDate) }} 
          className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"
        >
          🔄 Sync Data
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-50 text-red-800 p-4 rounded-xl font-bold flex justify-between items-center shadow-sm border border-red-100 mb-6">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => router.push('/login')} className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-sm border border-red-200">Login</button>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ========================================== */}
        {/* LEFT COLUMN: TASK LISTS                    */}
        {/* ========================================== */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="flex justify-between items-center bg-white p-3 px-4 rounded-2xl border border-slate-100 shadow-sm">
            <button onClick={() => changeDate(-1)} className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition text-slate-500 font-bold text-xs flex items-center gap-1">
              <span>←</span> Prev Day
            </button>
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-800">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
            </div>
            <button onClick={() => changeDate(1)} className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition text-slate-500 font-bold text-xs flex items-center gap-1">
              Next Day <span>→</span>
            </button>
          </div>

          {loadingTasks ? (
            <div className="text-center py-20 text-indigo-400 font-medium animate-pulse">Syncing your agenda...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-indigo-100 rounded-2xl bg-white shadow-sm">
              <span className="text-4xl block mb-4">🌴</span>
              <h3 className="text-lg font-bold text-slate-700">No tasks scheduled</h3>
              <p className="text-slate-500 text-sm mt-1">Enjoy the rest or look ahead to tomorrow.</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* PENDING TASKS SECTION */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-amber-500 text-xl">☀️</span>
                  <h2 className="text-lg font-bold text-slate-800">Today's Missions</h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full ml-2">{pendingTasks.length} tasks</span>
                </div>

                <div className="space-y-3">
                  {pendingTasks.length === 0 && (
                    <div className="p-4 bg-white rounded-xl border border-slate-100 text-sm text-slate-400 text-center shadow-sm">All pending tasks completed!</div>
                  )}
                  {pendingTasks.map((task) => (
                    <div key={task.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col gap-3">
                      
                      <div className="flex items-start gap-4">
                        <button onClick={() => toggleTaskCompletion(task)} className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-indigo-400 transition-colors flex items-center justify-center shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800">{task.task_name}</h3>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Target: {task.target_amount} {task.unit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Admin Message UI (Pending) */}
                      {task.admin_message && (
                        <div className="ml-9 p-3 bg-amber-50 rounded-lg border border-amber-100 shadow-inner mt-2">
                          <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1"><span>⚠️</span> Admin Directive:</p>
                          <p className="text-sm text-amber-900">{task.admin_message}</p>
                          {task.student_reply ? (
                            <p className="text-xs text-slate-500 italic mt-2 border-t border-amber-200/50 pt-2">Your Reply: {task.student_reply}</p>
                          ) : (
                            <div className="flex gap-2 mt-3">
                              <input 
                                type="text" placeholder="Type your reply to admin..." 
                                value={replyInputs[task.id] || ''} onChange={(e) => setReplyInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                className="flex-1 text-xs p-2 border border-amber-200 rounded outline-none bg-white focus:border-amber-400 transition"
                              />
                              <button onClick={() => handleSendReply(task.id)} className="bg-amber-600 text-white px-4 text-xs font-bold rounded shadow-sm hover:bg-amber-700 transition">Send</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* COMPLETED TASKS SECTION */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-emerald-500 text-xl">✅</span>
                  <h2 className="text-lg font-bold text-slate-800">Completed</h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full ml-2">{completedTasks.length} tasks</span>
                </div>

                <div className="space-y-3">
                  {completedTasks.length === 0 && (
                    <div className="p-4 bg-white rounded-xl border border-slate-100 text-sm text-slate-400 text-center shadow-sm">No tasks completed yet.</div>
                  )}
                  {completedTasks.map((task) => (
                    <div key={task.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 transition-all opacity-70 hover:opacity-100">
                      
                      <div className="flex items-start gap-4">
                        <button onClick={() => toggleTaskCompletion(task)} className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500 border border-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-500 line-through decoration-slate-300">{task.task_name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Target: {task.target_amount} {task.unit}</p>
                        </div>
                      </div>

                      {/* Admin Message UI (NOW VISIBLE IN COMPLETED TASKS) */}
                      {task.admin_message && (
                        <div className="ml-9 p-3 bg-amber-50 rounded-lg border border-amber-100 shadow-inner mt-2 opacity-100">
                          <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1"><span>⚠️</span> Admin Directive:</p>
                          <p className="text-sm text-amber-900 font-medium">{task.admin_message}</p>
                          {task.student_reply ? (
                            <p className="text-xs text-slate-500 italic mt-2 border-t border-amber-200/50 pt-2">Your Reply: {task.student_reply}</p>
                          ) : (
                            <div className="flex gap-2 mt-3">
                              <input 
                                type="text" placeholder="Type your reply to admin..." 
                                value={replyInputs[task.id] || ''} onChange={(e) => setReplyInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                className="flex-1 text-xs p-2 border border-amber-200 rounded outline-none bg-white focus:border-amber-400 transition"
                              />
                              <button onClick={() => handleSendReply(task.id)} className="bg-amber-600 text-white px-4 text-xs font-bold rounded shadow-sm hover:bg-amber-700 transition">Send</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* RIGHT COLUMN: INTERACTIVE CALENDAR         */}
        {/* ========================================== */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative">
            
            {loadingTracker && (
              <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center rounded-2xl backdrop-blur-sm">
                <span className="text-indigo-600 font-bold text-sm animate-pulse">Syncing Tracker...</span>
              </div>
            )}

            <div className="flex justify-between items-center mb-6">
              <button onClick={() => changeMonth(-1)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-sm font-bold text-slate-800">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => changeMonth(1)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center mb-6">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{day}</div>
              ))}
              
              {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8"></div>
              ))}
              
              {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                const dateStr = formatDateToLocal(date)
                const isSelected = dateStr === formatDateToLocal(selectedDate)
                const isToday = dateStr === formatDateToLocal(new Date())
                const status = trackerMap[dateStr]
                
                let dotColor = 'bg-transparent'
                if (status === 'hit') dotColor = 'bg-[#4ADE80]'
                if (status === 'partial') dotColor = 'bg-[#FBBF24]'
                if (status === 'missed') dotColor = 'bg-[#FB7185]'
                if (status === 'pending') dotColor = 'bg-slate-200'
                
                return (
                  <button 
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`h-9 w-9 mx-auto flex flex-col items-center justify-center rounded-full transition-all relative ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span className={`text-xs font-semibold mt-0.5 ${isToday && !isSelected ? 'text-indigo-600 font-bold' : ''}`}>{day}</span>
                    <span className={`w-1 h-1 rounded-full absolute bottom-1.5 ${dotColor} ${isSelected && status ? 'ring-1 ring-white' : ''}`}></span>
                  </button>
                )
              })}
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-500 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]"></div> Completed</div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></div> Partial</div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#FB7185]"></div> Missed</div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div> Pending</div>
            </div>
            
            {formatDateToLocal(selectedDate) !== formatDateToLocal(new Date()) && (
              <button onClick={() => { setSelectedDate(new Date()); setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }} className="w-full mt-5 py-2.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors">
                Return to Today
              </button>
            )}
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
            <span className="text-6xl text-indigo-200/50 absolute -top-2 -left-2 font-serif leading-none">"</span>
            <p className="text-sm font-semibold text-slate-700 relative z-10 pt-4 leading-relaxed">
              Discipline is the bridge between goals and accomplishment.
            </p>
            <p className="text-xs text-slate-500 font-medium mt-3">— Jim Rohn</p>
          </div>

        </div>
      </div>
    </div>
  )
}