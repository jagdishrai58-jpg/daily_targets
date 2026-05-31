'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts'

export default function MockTrackerPage() {
  const [mocks, setMocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Analytics State
  const [chartData, setChartData] = useState<any[]>([])
  const [avgAccuracy, setAvgAccuracy] = useState(0)
  const [avgPercentile, setAvgPercentile] = useState(0)
  const [totalMocks, setTotalMocks] = useState(0)

  // Form State
  const [examName, setExamName] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [scoredMarks, setScoredMarks] = useState('')
  const [accuracy, setAccuracy] = useState('')
  const [rank, setRank] = useState('')
  const [totalCandidates, setTotalCandidates] = useState('')
  const [weakAreas, setWeakAreas] = useState('')

  useEffect(() => {
    fetchMocks()
  }, [])

  const fetchMocks = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data, error } = await supabase
        .from('mock_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('attempt_date', { ascending: false }) 
      
      if (data && data.length > 0) {
        setMocks(data)
        setTotalMocks(data.length)

        const chartTimelineData = [...data].reverse()
        let totalAcc = 0
        let totalPerc = 0

        const formattedData = chartTimelineData.map(mock => {
          const percentile = mock.total_candidates > 1 
            ? ((mock.total_candidates - mock.rank) / (mock.total_candidates - 1)) * 100 
            : 0
            
          totalAcc += Number(mock.accuracy)
          totalPerc += percentile

          return {
            name: new Date(mock.attempt_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            exam: mock.exam_name,
            Accuracy: Number(mock.accuracy),
            Percentile: Number(percentile.toFixed(1)),
          }
        })

        setChartData(formattedData)
        setAvgAccuracy(Number((totalAcc / data.length).toFixed(1)))
        setAvgPercentile(Number((totalPerc / data.length).toFixed(1)))
      } else {
        setMocks([])
        setChartData([])
        setTotalMocks(0)
        setAvgAccuracy(0)
        setAvgPercentile(0)
      }
    }
    setLoading(false)
  }

  const handleAddMock = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('Saving mock analysis...')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setMessage('Error: You must be logged in.')

    const { error } = await supabase.from('mock_tests').insert([{
      user_id: user.id,
      exam_name: examName,
      total_marks: parseFloat(totalMarks),
      scored_marks: parseFloat(scoredMarks),
      accuracy: parseFloat(accuracy),
      rank: parseInt(rank),
      total_candidates: parseInt(totalCandidates),
      weak_areas: weakAreas
    }])

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Mock analysis saved successfully!')
      setExamName(''); setTotalMarks(''); setScoredMarks(''); 
      setAccuracy(''); setRank(''); setTotalCandidates(''); setWeakAreas('');
      fetchMocks() 
      
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mock record?')) return
    await supabase.from('mock_tests').delete().eq('id', id)
    fetchMocks() 
  }

  return (
    <div className="max-w-5xl mx-auto p-4 py-8 space-y-10">
      
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-black text-slate-900">Mock Tracker 🎯</h1>
        <p className="text-slate-500 mt-2">Log scores, track your accuracy trend, and isolate weak areas.</p>
      </div>

      {/* ========================================== */}
      {/* SECTION 1: LOG NEW MOCK (TOP)              */}
      {/* ========================================== */}
      <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
        <h2 className="text-xl font-bold mb-6 text-slate-800">Log New Mock Score</h2>
        
        {message && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 text-sm rounded-lg border border-emerald-200 font-bold flex items-center">
            <span className="mr-2 text-lg">✓</span> {message}
          </div>
        )}

        <form onSubmit={handleAddMock} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Exam Name</label>
            <input type="text" placeholder="e.g., RBI Assistant Mains - Test 4" value={examName} onChange={e => setExamName(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition" required />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Scored Marks</label>
              <input type="number" step="0.25" placeholder="145.5" value={scoredMarks} onChange={e => setScoredMarks(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Marks</label>
              <input type="number" placeholder="200" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Accuracy (%)</label>
              <input type="number" step="0.1" placeholder="92.5" value={accuracy} onChange={e => setAccuracy(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition" required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Rank</label>
              <input type="number" placeholder="e.g., 3" value={rank} onChange={e => setRank(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Candidates</label>
              <input type="number" placeholder="e.g., 1966" value={totalCandidates} onChange={e => setTotalCandidates(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Weak Areas / Mistakes</label>
            <textarea 
              placeholder="What went wrong? Document your mistakes here so you don't repeat them." 
              value={weakAreas} 
              onChange={e => setWeakAreas(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-slate-50 h-20 focus:ring-2 focus:ring-indigo-500 outline-none transition"
              required
            />
          </div>

          <div className="pt-2">
            <button type="submit" className="w-full md:w-auto px-8 bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition shadow-md hover:shadow-lg">
              Save Exam Analysis
            </button>
          </div>
        </form>
      </div>

      {/* ========================================== */}
      {/* SECTION 2: CHARTS & ANALYTICS (MIDDLE)     */}
      {/* ========================================== */}
      {!loading && totalMocks > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 border-b pb-2">Performance Analytics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Mocks</h3>
              <div className="text-3xl font-black text-slate-800">{totalMocks}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Accuracy</h3>
              <div className={`text-3xl font-black ${avgAccuracy >= 90 ? 'text-green-600' : 'text-slate-800'}`}>{avgAccuracy}%</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Percentile</h3>
              <div className="text-3xl font-black text-blue-600">{avgPercentile}%</div>
            </div>
          </div>

          {/* FIX APPLIED HERE: Flex-col, hard height (h-96), and a conditional render */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-96">
              <h2 className="text-lg font-bold text-slate-800 mb-4 shrink-0">Accuracy Trend</h2>
              <div className="flex-1 w-full">
                {chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-96">
              <h2 className="text-lg font-bold text-slate-800 mb-4 shrink-0">Percentile Growth</h2>
              <div className="flex-1 w-full">
                {chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                      <defs>
                        <linearGradient id="colorPerc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="Percentile" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPerc)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SECTION 3: HISTORY LIST (BOTTOM)           */}
      {/* ========================================== */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 border-b pb-2 mb-6">Exam History</h2>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading history...</div>
        ) : mocks.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
            <p className="text-slate-500">No mock tests logged yet. Enter your first score above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mocks.map((mock) => {
              const percentage = ((mock.scored_marks / mock.total_marks) * 100).toFixed(1)
              const percentile = mock.total_candidates > 1 
                ? (((mock.total_candidates - mock.rank) / (mock.total_candidates - 1)) * 100).toFixed(2)
                : 'N/A'

              return (
                <div key={mock.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group flex flex-col hover:border-indigo-300 transition-colors">
                  <button 
                    onClick={() => handleDelete(mock.id)}
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition"
                    title="Delete Record"
                  >
                    🗑️
                  </button>
                  
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4 pr-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{mock.exam_name}</h3>
                      <p className="text-xs font-medium text-slate-400 mt-1">{new Date(mock.attempt_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <div className="text-2xl font-black text-indigo-600">{mock.scored_marks} <span className="text-sm text-slate-400 font-medium">/ {mock.total_marks}</span></div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{percentage}% Final Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-5">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Accuracy</span>
                      <span className={`text-sm font-bold ${mock.accuracy >= 90 ? 'text-green-600' : 'text-orange-600'}`}>{mock.accuracy}%</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rank</span>
                      <span className="text-sm font-bold text-slate-700">{mock.rank} <span className="text-[10px] font-normal text-slate-500">/ {mock.total_candidates}</span></span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Percentile</span>
                      <span className="text-sm font-bold text-blue-600">{percentile}%</span>
                    </div>
                  </div>

                  <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 mt-auto">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-red-800 mb-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                      Mistakes & Weak Areas
                    </span>
                    <p className="text-xs font-medium text-red-900 leading-relaxed">{mock.weak_areas}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}