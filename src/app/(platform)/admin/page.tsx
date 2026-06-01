'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AdminTab = 'users' | 'monitor' | 'tasks' | 'quizzes' | 'rc'

type Profile = {
  id: string
  email?: string | null
  full_name?: string | null
  role?: string | null
  created_at?: string | null
  is_active?: boolean | null
}

type DailyTask = {
  id: string
  task_name: string
  target_amount: number
  unit: string
  task_date: string
  created_at?: string | null
}

type TaskProgress = {
  id: string
  user_id: string
  task_id: string
  completed_amount?: number | null
  is_completed?: boolean | null
  admin_message?: string | null
  student_reply?: string | null
  updated_at?: string | null
}

type ProgressWithTask = TaskProgress & {
  daily_tasks?: Pick<DailyTask, 'task_name' | 'target_amount' | 'unit' | 'task_date'> | null
}

type MockRecord = {
  id: string
  user_id: string
  exam_name: string
  scored_marks: number
  total_marks: number
  accuracy: number
  rank: number
  total_candidates: number
  weak_areas?: string | null
  attempt_date?: string | null
}

type Quiz = {
  id: string
  title: string
  quiz_type: string
  publish_date: string
}

type Question = {
  id: string
  quiz_id: string
}

type QuizResult = {
  id: string
  user_id: string
  quiz_id: string
  score: number
  total_questions: number
  created_at?: string | null
  quizzes?: Pick<Quiz, 'title' | 'quiz_type'> | null
}

type TaskDraft = {
  name: string
  unit: string
}

type BulkQuestion = {
  question_text: string
  options: string[]
  correct_option: number
}

// NEW: Type for listing RCs in the Library
type EditorialMeta = {
  id: string
  title: string
  publish_date: string
}

const formatDateToLocal = (date: Date) => {
  const istString = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  const istDate = new Date(istString)
  const year = istDate.getFullYear()
  const month = String(istDate.getMonth() + 1).padStart(2, '0')
  const day = String(istDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available'
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getErrorMessage = (err: unknown) => (
  err instanceof Error ? err.message : 'Something went wrong.'
)

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingStudent, setLoadingStudent] = useState(false)
  const [loadingQuizzes, setLoadingQuizzes] = useState(true)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [allProgress, setAllProgress] = useState<TaskProgress[]>([])
  const [allMocks, setAllMocks] = useState<MockRecord[]>([])
  const [allQuizResults, setAllQuizResults] = useState<QuizResult[]>([])

  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null)
  const [studentProgress, setStudentProgress] = useState<ProgressWithTask[]>([])
  const [studentMocks, setStudentMocks] = useState<MockRecord[]>([])
  const [studentQuizzes, setStudentQuizzes] = useState<QuizResult[]>([])
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})

  const [monitorDate, setMonitorDate] = useState(formatDateToLocal(new Date()))
  const [monitorTasks, setMonitorTasks] = useState<DailyTask[]>([])
  const [monitorProgress, setMonitorProgress] = useState<TaskProgress[]>([])

  const [activeTasks, setActiveTasks] = useState<DailyTask[]>([])
  
  const [taskDate, setTaskDate] = useState(formatDateToLocal(new Date()))
  
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const istString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    const istDate = new Date(istString)
    return new Date(istDate.getFullYear(), istDate.getMonth(), 1)
  })
  
  const [taskList, setTaskList] = useState<TaskDraft[]>([{ name: '', unit: 'slots' }])

  const [quizId, setQuizId] = useState('')
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([])
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [quizFilter, setQuizFilter] = useState<'all' | 'daily' | 'weekly' | 'computer'>('all')
  const [title, setTitle] = useState('')
  const [type, setType] = useState('daily')
  const [date, setDate] = useState(formatDateToLocal(new Date()))
  const [bulkJSON, setBulkJSON] = useState('')
  const [qText, setQText] = useState('')
  const [optA, setOptA] = useState('')
  const [optB, setOptB] = useState('')
  const [optC, setOptC] = useState('')
  const [optD, setOptD] = useState('')
  const [optE, setOptE] = useState('')
  const [correctIdx, setCorrectIdx] = useState('0')

  // RC Manager State
  const [rcDate, setRcDate] = useState(formatDateToLocal(new Date()))
  const [rcTitle, setRcTitle] = useState('')
  const [rcJson, setRcJson] = useState('')
  const [rcStatus, setRcStatus] = useState<{ type: 'success' | 'error' | '', msg: string }>({ type: '', msg: '' })
  
  // NEW: RC Library State
  const [allEditorials, setAllEditorials] = useState<EditorialMeta[]>([])
  const [loadingEditorials, setLoadingEditorials] = useState(true)

  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [profilesRes, tasksRes, progressRes, mocksRes, quizResultsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase
          .from('daily_tasks')
          .select('*')
          .order('task_date', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(120),
        supabase.from('user_task_progress').select('*'),
        supabase.from('mock_tests').select('*'),
        supabase.from('quiz_results').select('*'),
      ])

      if (profilesRes.error) throw profilesRes.error
      if (tasksRes.error) throw tasksRes.error
      if (progressRes.error) throw progressRes.error
      if (mocksRes.error) throw mocksRes.error
      if (quizResultsRes.error) throw quizResultsRes.error

      setProfiles((profilesRes.data || []) as Profile[])
      setActiveTasks((tasksRes.data || []) as DailyTask[])
      setAllProgress((progressRes.data || []) as TaskProgress[])
      setAllMocks((mocksRes.data || []) as MockRecord[])
      setAllQuizResults((quizResultsRes.data || []) as QuizResult[])
    } catch (err) {
      setMessage(`Admin data failed to load: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMonitorData = useCallback(async () => {
    try {
      const { data: tasks, error: taskError } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('task_date', monitorDate)
        .order('created_at', { ascending: true })

      if (taskError) throw taskError

      const taskRows = (tasks || []) as DailyTask[]
      setMonitorTasks(taskRows)

      if (taskRows.length === 0) {
        setMonitorProgress([])
        return
      }

      const { data: progress, error: progressError } = await supabase
        .from('user_task_progress')
        .select('*')
        .in('task_id', taskRows.map(task => task.id))

      if (progressError) throw progressError
      setMonitorProgress((progress || []) as TaskProgress[])
    } catch (err) {
      setMessage(`To-do monitor failed to load: ${getErrorMessage(err)}`)
    }
  }, [monitorDate])

  const fetchQuizzes = useCallback(async () => {
    setLoadingQuizzes(true)
    try {
      const [quizzesRes, questionsRes, resultsRes] = await Promise.all([
        supabase.from('quizzes').select('*').order('publish_date', { ascending: false }),
        supabase.from('questions').select('id, quiz_id'),
        supabase.from('quiz_results').select('*'),
      ])

      if (quizzesRes.error) throw quizzesRes.error
      if (questionsRes.error) throw questionsRes.error
      if (resultsRes.error) throw resultsRes.error

      setAllQuizzes((quizzesRes.data || []) as Quiz[])
      setAllQuestions((questionsRes.data || []) as Question[])
      setAllQuizResults((resultsRes.data || []) as QuizResult[])
    } catch (err) {
      setMessage(`Quiz data failed to load: ${getErrorMessage(err)}`)
    } finally {
      setLoadingQuizzes(false)
    }
  }, [])

  // NEW: Fetch Editorials for Library
  const fetchEditorialsList = useCallback(async () => {
    setLoadingEditorials(true)
    try {
      const { data, error } = await supabase
        .from('editorials')
        .select('id, title, publish_date')
        .order('publish_date', { ascending: false })

      if (error) throw error
      setAllEditorials(data || [])
    } catch (err) {
      setMessage(`Failed to load RCs: ${getErrorMessage(err)}`)
    } finally {
      setLoadingEditorials(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchInitialData()
      fetchQuizzes()
      fetchEditorialsList() // Fetch RCs on load
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchInitialData, fetchQuizzes, fetchEditorialsList])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchMonitorData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchMonitorData])

  const userStats = useMemo(() => {
    const stats: Record<string, { progressRows: number, completedRows: number, mocks: number, quizResults: number }> = {}

    profiles.forEach(profile => {
      stats[profile.id] = { progressRows: 0, completedRows: 0, mocks: 0, quizResults: 0 }
    })

    allProgress.forEach(progress => {
      if (!stats[progress.user_id]) stats[progress.user_id] = { progressRows: 0, completedRows: 0, mocks: 0, quizResults: 0 }
      stats[progress.user_id].progressRows += 1
      if (progress.is_completed) stats[progress.user_id].completedRows += 1
    })

    allMocks.forEach(mock => {
      if (!stats[mock.user_id]) stats[mock.user_id] = { progressRows: 0, completedRows: 0, mocks: 0, quizResults: 0 }
      stats[mock.user_id].mocks += 1
    })

    allQuizResults.forEach(result => {
      if (!stats[result.user_id]) stats[result.user_id] = { progressRows: 0, completedRows: 0, mocks: 0, quizResults: 0 }
      stats[result.user_id].quizResults += 1
    })

    return stats
  }, [allMocks, allProgress, allQuizResults, profiles])

  const monitorProgressMap = useMemo(() => {
    const map = new Map<string, TaskProgress>()
    monitorProgress.forEach(progress => {
      map.set(`${progress.user_id}:${progress.task_id}`, progress)
    })
    return map
  }, [monitorProgress])

  const groupedTasks = useMemo(() => {
    return activeTasks.reduce<Record<string, DailyTask[]>>((groups, task) => {
      if (!groups[task.task_date]) groups[task.task_date] = []
      groups[task.task_date].push(task)
      return groups
    }, {})
  }, [activeTasks])

  const filteredQuizzes = useMemo(() => {
    return quizFilter === 'all'
      ? allQuizzes
      : allQuizzes.filter(quiz => quiz.quiz_type === quizFilter)
  }, [allQuizzes, quizFilter])

  const getQuizStats = (quiz: Quiz) => {
    const questionCount = allQuestions.filter(question => question.quiz_id === quiz.id).length
    const attempts = allQuizResults.filter(result => result.quiz_id === quiz.id)
    const avgScore = attempts.length
      ? Math.round(attempts.reduce((sum, result) => {
        const pct = result.total_questions ? (result.score / result.total_questions) * 100 : 0
        return sum + pct
      }, 0) / attempts.length)
      : 0

    return { questionCount, attemptCount: attempts.length, avgScore }
  }

  const loadStudentData = async (student: Profile) => {
    setLoadingStudent(true)
    setSelectedStudent(student)
    try {
      const [progressRes, mocksRes, quizzesRes] = await Promise.all([
        supabase
          .from('user_task_progress')
          .select('*, daily_tasks(task_name, target_amount, unit, task_date)')
          .eq('user_id', student.id)
          .order('updated_at', { ascending: false })
          .limit(50),
        supabase
          .from('mock_tests')
          .select('*')
          .eq('user_id', student.id)
          .order('attempt_date', { ascending: false })
          .limit(25),
        supabase
          .from('quiz_results')
          .select('*, quizzes(title, quiz_type)')
          .eq('user_id', student.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      if (progressRes.error) throw progressRes.error
      if (mocksRes.error) throw mocksRes.error
      if (quizzesRes.error) throw quizzesRes.error

      setStudentProgress((progressRes.data || []) as ProgressWithTask[])
      setStudentMocks((mocksRes.data || []) as MockRecord[])
      setStudentQuizzes((quizzesRes.data || []) as QuizResult[])
    } catch (err) {
      setMessage(`Student detail failed to load: ${getErrorMessage(err)}`)
    } finally {
      setLoadingStudent(false)
    }
  }

  const handleSendMessage = async (progressId: string) => {
    const adminMessage = noteInputs[progressId]?.trim()
    if (!adminMessage || !selectedStudent) return

    const { error } = await supabase
      .from('user_task_progress')
      .update({ admin_message: adminMessage })
      .eq('id', progressId)

    if (error) {
      setMessage(`Message failed: ${error.message}`)
      return
    }

    setNoteInputs(prev => ({ ...prev, [progressId]: '' }))
    setMessage('Message sent to student to-do list.')
    loadStudentData(selectedStudent)
  }

  const toggleUserAccess = async (e: React.MouseEvent, userId: string, currentStatus: boolean | null | undefined) => {
    e.stopPropagation() 
    const newStatus = !currentStatus
    
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_active: newStatus } : p))
    
    const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', userId)
    if (error) {
      setMessage(`Failed to update access: ${error.message}`)
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_active: currentStatus } : p))
    } else {
      setMessage(`User access ${newStatus ? 'GRANTED' : 'REVOKED'}.`)
    }
  }

  const handleAddTaskRow = () => {
    setTaskList(prev => [...prev, { name: '', unit: 'slots' }])
  }

  const handleRemoveTaskRow = (index: number) => {
    setTaskList(prev => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleTaskChange = (index: number, field: keyof TaskDraft, value: string) => {
    setTaskList(prev => prev.map((task, currentIndex) => (
      currentIndex === index ? { ...task, [field]: value } : task
    )))
  }

  const handleBroadcastList = async (e: React.FormEvent) => {
    e.preventDefault()
    const validTasks = taskList.filter(task => task.name.trim() !== '')
    if (validTasks.length === 0) {
      setMessage('Please enter at least one valid task.')
      return
    }

    const payload = validTasks.map(task => ({
      task_name: task.name,
      target_amount: 1, 
      unit: task.unit,
      task_date: taskDate,
    }))

    const { error } = await supabase.from('daily_tasks').insert(payload)

    if (error) {
      setMessage(`Task broadcast failed: ${error.message}`)
      return
    }

    setMessage(`Broadcasted ${validTasks.length} tasks for ${formatDate(taskDate)}.`)
    setTaskList([{ name: '', unit: 'slots' }])
    fetchInitialData()
    if (taskDate === monitorDate) fetchMonitorData()
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task from the agenda?')) return
    const { error } = await supabase.from('daily_tasks').delete().eq('id', taskId)

    if (error) {
      setMessage(`Task deletion failed: ${error.message}`)
      return
    }

    setMessage('Task deleted.')
    fetchInitialData()
    fetchMonitorData()
  }

  const changeAdminMonth = (offset: number) => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + offset)
      return newDate
    })
  }

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('Creating quiz...')

    const { data, error } = await supabase
      .from('quizzes')
      .insert([{ title, quiz_type: type, publish_date: date }])
      .select()

    if (error) {
      setMessage(`Quiz creation failed: ${error.message}`)
      return
    }

    const createdQuiz = data?.[0] as Quiz | undefined
    if (createdQuiz) {
      setQuizId(createdQuiz.id)
      setMessage('Quiz created. You can add questions now.')
      setTitle('')
      fetchQuizzes()
    }
  }

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm('Delete this quiz, its questions, and all user results?')) return

    try {
      const { error: resultsError } = await supabase.from('quiz_results').delete().eq('quiz_id', id)
      if (resultsError) throw resultsError

      const { error: questionsError } = await supabase.from('questions').delete().eq('quiz_id', id)
      if (questionsError) throw questionsError

      const { data: deletedQuiz, error: quizError } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', id)
        .select('id')

      if (quizError) throw quizError
      if (!deletedQuiz?.length) throw new Error('Supabase did not delete the quiz row. Check the quizzes DELETE policy.')

      if (quizId === id) setQuizId('')
      setMessage('Quiz deleted.')
      fetchQuizzes()
    } catch (err) {
      setMessage(`Quiz deletion failed: ${getErrorMessage(err)}`)
    }
  }

  // NEW: Handle Delete RC
  const handleDeleteRC = async (id: string) => {
    if (!confirm('Delete this Reading Comprehension passage? This will also delete any student scores associated with it.')) return

    try {
      // Due to our 'on delete cascade' setup, deleting the editorial automatically deletes the editorial_results!
      const { error } = await supabase
        .from('editorials')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMessage('Reading Comprehension deleted.')
      fetchEditorialsList()
    } catch (err) {
      setMessage(`RC deletion failed: ${getErrorMessage(err)}`)
    }
  }

  const handleBulkUpload = async () => {
    if (!quizId) {
      setMessage('Create or select a quiz first.')
      return
    }

    try {
      const questionsArray = JSON.parse(bulkJSON) as BulkQuestion[]
      const formatted = questionsArray.map(question => ({
        quiz_id: quizId,
        question_text: question.question_text,
        options: question.options,
        correct_option: question.correct_option,
      }))

      const { error } = await supabase.from('questions').insert(formatted)
      if (error) throw error

      setMessage(`Added ${formatted.length} questions.`)
      setBulkJSON('')
      fetchQuizzes()
    } catch (err) {
      setMessage(`Bulk upload failed: ${getErrorMessage(err)}`)
    }
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quizId) {
      setMessage('Create or select a quiz first.')
      return
    }

    const { error } = await supabase.from('questions').insert([{
      quiz_id: quizId,
      question_text: qText,
      options: [optA, optB, optC, optD, optE],
      correct_option: parseInt(correctIdx, 10),
    }])

    if (error) {
      setMessage(`Question save failed: ${error.message}`)
      return
    }

    setMessage('Question added.')
    setQText('')
    setOptA('')
    setOptB('')
    setOptC('')
    setOptD('')
    setOptE('')
    fetchQuizzes()
  }

  const handleUploadRC = async () => {
    try {
      setRcStatus({ type: '', msg: 'Uploading...' })
      
      if (!rcDate || !rcTitle || !rcJson) {
        throw new Error('Please fill in the Date, Title, and JSON fields.')
      }

      let parsedContent;
      try {
        parsedContent = JSON.parse(rcJson)
      } catch (e) {
        throw new Error('Invalid JSON format. Please check for missing quotes or brackets.')
      }

      if (!parsedContent.passage || !parsedContent.questions) {
        throw new Error('JSON is missing the "passage" or "questions" arrays.')
      }

      const { error } = await supabase
        .from('editorials')
        .insert({
          publish_date: rcDate,
          title: rcTitle,
          content: parsedContent
        })

      if (error) throw error

      setRcStatus({ type: 'success', msg: 'Reading Comprehension successfully uploaded!' })
      
      setRcDate(formatDateToLocal(new Date()))
      setRcTitle('')
      setRcJson('')
      
      // Fetch updated list so it appears in the Library panel instantly!
      fetchEditorialsList()
      
    } catch (err: any) {
      setRcStatus({ type: 'error', msg: err.message })
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 py-8">
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Command</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Monitor students, manage agendas, and control quiz content.</p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-lg bg-slate-100 p-1.5">
          {[
            ['users', 'Users'],
            ['monitor', 'To-Do Monitor'],
            ['tasks', 'Manage To-Dos'],
            ['quizzes', 'Quiz Manager'],
            ['rc', 'RC Manager'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as AdminTab)}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-800">
          {message}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Users</h2>
                <p className="text-xs font-medium text-slate-500">{profiles.length} profiles found</p>
              </div>
              {loading && <span className="text-xs font-bold text-slate-400">Loading...</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">User ID</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3">All-Time To-Do</th>
                    <th className="px-5 py-3">Mocks</th>
                    <th className="px-5 py-3">Quizzes</th>
                    <th className="px-5 py-3">Access</th>
                    <th className="px-5 py-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.map(profile => {
                    const stats = userStats[profile.id] || { progressRows: 0, completedRows: 0, mocks: 0, quizResults: 0 }
                    
                    const totalTasksAssigned = activeTasks.length
                    const completionPct = totalTasksAssigned ? Math.round((stats.completedRows / totalTasksAssigned) * 100) : 0

                    return (
                      <tr
                        key={profile.id}
                        onClick={() => loadStudentData(profile)}
                        className={`cursor-pointer hover:bg-indigo-50/60 ${selectedStudent?.id === profile.id ? 'bg-indigo-50' : 'bg-white'}`}
                      >
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">{profile.full_name || 'Unnamed student'}</p>
                          <p className="text-xs text-slate-500">{profile.email || 'No email in profile'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{profile.id}</code>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{formatDate(profile.created_at)}</td>
                        <td className="px-5 py-4">
                          <span className={`font-black ${completionPct >= 80 ? 'text-emerald-600' : completionPct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {completionPct}%
                          </span>
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-700">{stats.mocks}</td>
                        <td className="px-5 py-4 font-bold text-slate-700">{stats.quizResults}</td>
                        <td className="px-5 py-4">
                          <button 
                            onClick={(e) => toggleUserAccess(e, profile.id, profile.is_active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${profile.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${profile.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-600">
                            {profile.role || 'student'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <StudentDetailPanel
            loading={loadingStudent}
            selectedStudent={selectedStudent}
            studentProgress={studentProgress}
            studentMocks={studentMocks}
            studentQuizzes={studentQuizzes}
            noteInputs={noteInputs}
            setNoteInputs={setNoteInputs}
            handleSendMessage={handleSendMessage}
          />
        </div>
      )}

      {activeTab === 'monitor' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Daily To-Do Completion</h2>
              <p className="text-sm text-slate-500">View whether each student completed each assigned task.</p>
            </div>
            <input
              type="date"
              value={monitorDate}
              onChange={event => setMonitorDate(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {monitorTasks.length === 0 ? (
              <div className="p-12 text-center text-sm font-medium text-slate-400">No tasks assigned for {formatDate(monitorDate)}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-50 px-5 py-3">Student</th>
                      {monitorTasks.map(task => (
                        <th key={task.id} className="px-4 py-3">
                          <p className="max-w-36 truncate text-slate-700">{task.task_name}</p>
                          <p className="font-medium normal-case text-slate-400">{task.unit}</p>
                        </th>
                      ))}
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profiles.map(profile => {
                      const completedCount = monitorTasks.filter(task => monitorProgressMap.get(`${profile.id}:${task.id}`)?.is_completed).length
                      const dailyPct = Math.round((completedCount / monitorTasks.length) * 100)

                      return (
                        <tr key={profile.id} className="hover:bg-slate-50">
                          <td className="sticky left-0 z-10 bg-white px-5 py-4">
                            <button onClick={() => loadStudentData(profile)} className="text-left">
                              <p className="font-bold text-slate-900">{profile.full_name || 'Unnamed student'}</p>
                              <p className="text-xs text-slate-500">{profile.email}</p>
                            </button>
                          </td>
                          {monitorTasks.map(task => {
                            const progress = monitorProgressMap.get(`${profile.id}:${task.id}`)
                            const done = Boolean(progress?.is_completed)

                            return (
                              <td key={task.id} className="px-4 py-4">
                                <span className={`rounded-md px-2 py-1 text-xs font-black ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {done ? 'Done' : 'Pending'}
                                </span>
                              </td>
                            )
                          })}
                          <td className="px-4 py-4">
                            <span className={`font-black ${dailyPct === 100 ? 'text-emerald-600' : dailyPct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {dailyPct}%
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
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-black text-slate-900 uppercase tracking-wider">Select Date</h2>
              
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => changeAdminMonth(-1)} type="button" className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h3 className="text-sm font-bold text-slate-800">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => changeAdminMonth(1)} type="button" className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              
              <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="text-[10px] font-bold text-slate-400 uppercase">{day}</div>
                ))}
                
                {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8"></div>
                ))}
                
                {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                  const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                  const dateStr = formatDateToLocal(date)
                  const isSelected = dateStr === taskDate
                  
                  const hasTasks = !!groupedTasks[dateStr]
                  
                  return (
                    <button 
                      key={day}
                      type="button"
                      onClick={() => setTaskDate(dateStr)}
                      className={`h-8 w-8 mx-auto flex flex-col items-center justify-center rounded-full text-xs font-semibold relative transition-colors ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      {day}
                      {hasTasks && !isSelected && <span className="w-1 h-1 rounded-full bg-indigo-400 absolute bottom-1"></span>}
                      {hasTasks && isSelected && <span className="w-1 h-1 rounded-full bg-white absolute bottom-1"></span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            
            <div className="rounded-lg border border-indigo-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Build Daily Agenda</h2>
                  <p className="text-sm text-slate-500">Drafting tasks for: <span className="font-bold text-indigo-600">{formatDate(taskDate)}</span></p>
                </div>
                
                <input 
                  type="date" 
                  value={taskDate} 
                  onChange={(e) => {
                    setTaskDate(e.target.value)
                    const d = new Date(e.target.value)
                    if (!isNaN(d.getTime())) setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1))
                  }} 
                  className="rounded-lg border border-indigo-200 bg-white p-2 text-sm font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>

              <form onSubmit={handleBroadcastList}>
                <div className="mb-6 space-y-3">
                  {taskList.map((task, index) => (
                    <div key={index} className="grid grid-cols-[36px_minmax(0,1fr)_110px_36px] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-indigo-300 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-100 text-xs font-black text-indigo-700">{index + 1}</div>
                      
                      <input type="text" placeholder="Task details" value={task.name} onChange={event => handleTaskChange(index, 'name', event.target.value)} className="min-w-0 rounded-md border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:border-indigo-500" />
                      
                      <select value={task.unit} onChange={event => handleTaskChange(index, 'unit', event.target.value)} className="rounded-md border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:border-indigo-500">
                        <option value="slots">Slots</option>
                        <option value="mocks">Mocks</option>
                        <option value="questions">Questions</option>
                        <option value="pages">Pages</option>
                      </select>
                      
                      <button type="button" onClick={() => handleRemoveTaskRow(index)} disabled={taskList.length === 1} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors">
                        X
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={handleAddTaskRow} className="flex-1 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 py-3 text-sm font-black text-indigo-700 hover:bg-indigo-100 transition-colors">Add Task Block</button>
                  <button type="submit" className="flex-1 rounded-lg bg-indigo-600 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700 transition-colors">Broadcast Agenda</button>
                </div>
              </form>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 border-b border-slate-100 pb-3 text-lg font-black text-slate-900">
                Scheduled for {formatDate(taskDate)}
              </h2>
              
              <div className="space-y-3">
                {(!groupedTasks[taskDate] || groupedTasks[taskDate].length === 0) ? (
                  <p className="py-8 text-center text-sm text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">No tasks scheduled for this date.</p>
                ) : (
                  groupedTasks[taskDate].map((task, index) => (
                    <div key={task.id} className="group relative flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-white transition-colors">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-50 text-[10px] font-bold text-indigo-700">{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{task.task_name}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-400">{task.unit}</p>
                      </div>
                      <button onClick={() => handleDeleteTask(task.id)} className="rounded-md bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm">
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-black text-slate-900">Create Quiz</h2>
              <form onSubmit={handleCreateQuiz} className="space-y-4">
                <input type="text" placeholder="Quiz title" value={title} onChange={event => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" required />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <select value={type} onChange={event => setType(event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                    <option value="daily">Daily CA</option>
                    <option value="weekly">Weekly CA</option>
                    <option value="computer">Computer</option>
                  </select>
                  <input type="date" value={date} onChange={event => setDate(event.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm sm:col-span-2" required />
                </div>
                <button type="submit" className="w-full rounded-lg bg-slate-900 py-3 text-sm font-black text-white hover:bg-slate-800">Create Quiz Instance</button>
              </form>
            </div>

            {quizId && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm">
                  <h2 className="mb-3 text-lg font-black text-emerald-950">Bulk JSON Upload</h2>
                  <textarea value={bulkJSON} onChange={event => setBulkJSON(event.target.value)} className="mb-4 h-56 w-full rounded-lg border border-emerald-200 bg-white p-3 font-mono text-xs" placeholder="Paste question JSON array" />
                  <button onClick={handleBulkUpload} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-700">Upload Questions</button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 text-lg font-black text-slate-900">Add Question Manually</h2>
                  <form onSubmit={handleAddQuestion} className="space-y-2">
                    <textarea placeholder="Question text" value={qText} onChange={event => setQText(event.target.value)} className="h-20 w-full rounded-lg border border-slate-200 p-2 text-sm" required />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Option A" value={optA} onChange={event => setOptA(event.target.value)} className="rounded-md border border-slate-200 p-2 text-xs" required />
                      <input type="text" placeholder="Option B" value={optB} onChange={event => setOptB(event.target.value)} className="rounded-md border border-slate-200 p-2 text-xs" required />
                      <input type="text" placeholder="Option C" value={optC} onChange={event => setOptC(event.target.value)} className="rounded-md border border-slate-200 p-2 text-xs" required />
                      <input type="text" placeholder="Option D" value={optD} onChange={event => setOptD(event.target.value)} className="rounded-md border border-slate-200 p-2 text-xs" required />
                    </div>
                    <input type="text" placeholder="Option E" value={optE} onChange={event => setOptE(event.target.value)} className="w-full rounded-md border border-blue-200 bg-blue-50 p-2 text-xs" required />
                    <select value={correctIdx} onChange={event => setCorrectIdx(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm">
                      <option value="0">Correct: A</option>
                      <option value="1">Correct: B</option>
                      <option value="2">Correct: C</option>
                      <option value="3">Correct: D</option>
                      <option value="4">Correct: E</option>
                    </select>
                    <button type="submit" className="mt-2 w-full rounded-lg bg-slate-800 py-2.5 text-sm font-black text-white hover:bg-slate-700">Save Question</button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-[820px] overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">Quiz Library</h2>
              <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-bold">
                {['all', 'daily', 'weekly', 'computer'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setQuizFilter(filter as typeof quizFilter)}
                    className={`rounded-md px-2 py-1.5 capitalize ${quizFilter === filter ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {loadingQuizzes ? (
              <div className="py-10 text-center text-sm text-slate-400">Loading quizzes...</div>
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {filteredQuizzes.map(quiz => {
                  const stats = getQuizStats(quiz)

                  return (
                    <div key={quiz.id} className={`rounded-lg border p-3 ${quizId === quiz.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <button onClick={() => setQuizId(quiz.id)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-black text-slate-900">{quiz.title}</p>
                          <p className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase text-slate-500">
                            <span className="rounded bg-white px-1.5 py-0.5">{quiz.quiz_type}</span>
                            <span>{formatDate(quiz.publish_date)}</span>
                          </p>
                        </button>
                        <button onClick={() => handleDeleteQuiz(quiz.id)} className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100">Delete</button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md bg-white p-2">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Questions</p>
                          <p className="font-black text-slate-800">{stats.questionCount}</p>
                        </div>
                        <div className="rounded-md bg-white p-2">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Attempts</p>
                          <p className="font-black text-slate-800">{stats.attemptCount}</p>
                        </div>
                        <div className="rounded-md bg-white p-2">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Avg</p>
                          <p className="font-black text-indigo-700">{stats.avgScore}%</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW: RC Manager updated with Library Panel */}
      {activeTab === 'rc' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* LEFT: Upload Form */}
          <div className="space-y-6 lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 lg:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Upload Reading Comprehension</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Publish Date</label>
                    <input 
                      type="date" 
                      value={rcDate}
                      onChange={(e) => setRcDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Editorial Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Language Decorum..."
                      value={rcTitle}
                      onChange={(e) => setRcTitle(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                    <span>Passage & Questions (JSON Format)</span>
                    <span className="text-xs font-normal text-slate-400">Must include "passage" and "questions"</span>
                  </label>
                  <textarea 
                    value={rcJson}
                    onChange={(e) => setRcJson(e.target.value)}
                    placeholder='{&#10;  "passage": ["Paragraph 1", "Paragraph 2"],&#10;  "questions": [ { "id": 1, "text": "...", "options": [...], "correctAnswerIndex": 0, "explanation": "..." } ]&#10;}'
                    className="w-full h-96 p-4 bg-slate-900 text-green-400 font-mono text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    spellCheck="false"
                  />
                </div>

                {rcStatus.msg && (
                  <div className={`p-4 rounded-lg text-sm font-bold ${
                    rcStatus.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
                    rcStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}>
                    {rcStatus.msg}
                  </div>
                )}

                <button 
                  onClick={handleUploadRC}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-lg transition-colors shadow-sm"
                >
                  Upload Editorial RC
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: RC Library Panel */}
          <div className="max-h-[820px] overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
            <div className="mb-4 border-b border-slate-100 pb-3 shrink-0">
              <h2 className="text-lg font-black text-slate-900">RC Library</h2>
            </div>

            {loadingEditorials ? (
              <div className="py-10 text-center text-sm text-slate-400 font-bold">Loading Library...</div>
            ) : allEditorials.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">No RCs uploaded yet.</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {allEditorials.map(ed => (
                  <div key={ed.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 line-clamp-2 leading-snug">{ed.title}</p>
                      <p className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase text-slate-500">
                        <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5">{formatDate(ed.publish_date)}</span>
                      </p>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-200 mt-1">
                      <button 
                        onClick={() => handleDeleteRC(ed.id)} 
                        className="rounded-md bg-white border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                      >
                        Delete RC
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function StudentDetailPanel({
  loading,
  selectedStudent,
  studentProgress,
  studentMocks,
  studentQuizzes,
  noteInputs,
  setNoteInputs,
  handleSendMessage,
}: {
  loading: boolean
  selectedStudent: Profile | null
  studentProgress: ProgressWithTask[]
  studentMocks: MockRecord[]
  studentQuizzes: QuizResult[]
  noteInputs: Record<string, string>
  setNoteInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>
  handleSendMessage: (progressId: string) => void
}) {
  if (!selectedStudent) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-medium text-slate-400">
        Select a user to view profile, tasks, mocks, and quiz details.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400 shadow-sm">
        Loading student detail...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Student Detail</p>
        <h2 className="mt-1 text-2xl font-black">{selectedStudent.full_name || 'Unnamed student'}</h2>
        <p className="text-sm text-slate-300">{selectedStudent.email || 'No email in profile'}</p>
        <code className="mt-3 block rounded-md bg-white/10 p-2 text-xs text-slate-200">{selectedStudent.id}</code>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-black text-slate-900">To-Do History</h3>
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {studentProgress.length === 0 ? (
            <p className="text-sm text-slate-400">No to-do progress recorded.</p>
          ) : studentProgress.map(progress => (
            <div key={progress.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{progress.daily_tasks?.task_name || 'Task'}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(progress.daily_tasks?.task_date)} · {progress.completed_amount || 0}/{progress.daily_tasks?.target_amount || 0} {progress.daily_tasks?.unit || ''}
                  </p>
                </div>
                <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${progress.is_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {progress.is_completed ? 'Done' : 'Pending'}
                </span>
              </div>

              {progress.student_reply && (
                <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">Reply: {progress.student_reply}</p>
              )}

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Send note"
                  value={noteInputs[progress.id] || ''}
                  onChange={event => setNoteInputs(prev => ({ ...prev, [progress.id]: event.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white p-2 text-xs"
                />
                <button onClick={() => handleSendMessage(progress.id)} className="rounded-md bg-slate-800 px-3 text-xs font-bold text-white hover:bg-slate-700">Send</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-black text-slate-900">Mock Tests</h3>
        <div className="space-y-2">
          {studentMocks.length === 0 ? (
            <p className="text-sm text-slate-400">No mocks logged.</p>
          ) : studentMocks.slice(0, 5).map(mock => (
            <div key={mock.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-indigo-50 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-indigo-950">{mock.exam_name}</p>
                <p className="text-xs text-indigo-700">{formatDate(mock.attempt_date)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-indigo-700">{mock.scored_marks}/{mock.total_marks}</p>
                <p className="text-xs font-bold text-slate-500">{mock.accuracy}% acc</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-black text-slate-900">Quiz Attempts</h3>
        <div className="space-y-2">
          {studentQuizzes.length === 0 ? (
            <p className="text-sm text-slate-400">No quiz attempts recorded.</p>
          ) : studentQuizzes.slice(0, 6).map(result => {
            const pct = result.total_questions ? Math.round((result.score / result.total_questions) * 100) : 0

            return (
              <div key={result.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{result.quizzes?.title || 'Quiz'}</p>
                  <p className="text-xs capitalize text-slate-500">{result.quizzes?.quiz_type || 'quiz'} · {formatDate(result.created_at)}</p>
                </div>
                <p className="font-black text-blue-700">{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}