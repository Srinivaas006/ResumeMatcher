import React, { useEffect, useState } from 'react'
import { Clock, Trash2, ChevronRight, TrendingUp, TrendingDown, Minus, AlertCircle, Loader2 } from 'lucide-react'
import { fetchHistory, fetchHistoryItem, deleteHistoryItem } from '../lib/auth'

function ScoreBadge({ score }) {
  const color =
    score >= 75 ? 'text-signal-green bg-signal-green_bg' :
    score >= 50 ? 'text-signal-amber bg-signal-amber_bg' :
    'text-signal-red bg-signal-red_bg'
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>
      {score}
    </span>
  )
}

function TrendIcon({ current, previous }) {
  if (previous == null) return null
  const diff = current - previous
  if (diff > 0) return <TrendingUp size={14} className="text-signal-green" />
  if (diff < 0) return <TrendingDown size={14} className="text-signal-red" />
  return <Minus size={14} className="text-slate-mid" />
}

export default function Dashboard({ onLoadAnalysis }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingItem, setLoadingItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)

  useEffect(() => {
    fetchHistory()
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleOpen(id) {
    setLoadingItem(id)
    try {
      const detail = await fetchHistoryItem(id)
      onLoadAnalysis(detail)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingItem(null)
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    setDeletingItem(id)
    try {
      await deleteHistoryItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingItem(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-mid text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-signal-red_bg border border-red-200 rounded-2xl text-sm text-signal-red">
        <AlertCircle size={14} />
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock size={32} className="text-slate-light mx-auto mb-3" />
        <p className="text-sm font-semibold text-ink mb-1">No analyses yet</p>
        <p className="text-xs text-slate-mid">Run your first resume analysis and it'll appear here.</p>
      </div>
    )
  }

  const scores = items.map(i => i.score)
  const best = Math.max(...scores)
  const latest = scores[0]
  const previous = scores[1] ?? null
  const trend = previous != null ? latest - previous : null

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-ink">{latest}</p>
          <p className="text-xs text-slate-mid mt-0.5">Latest Score</p>
          {trend != null && (
            <p className={`text-xs font-semibold mt-1 ${trend > 0 ? 'text-signal-green' : trend < 0 ? 'text-signal-red' : 'text-slate-mid'}`}>
              {trend > 0 ? `+${trend}` : trend} vs last
            </p>
          )}
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-ink">{best}</p>
          <p className="text-xs text-slate-mid mt-0.5">Best Score</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-ink">{items.length}</p>
          <p className="text-xs text-slate-mid mt-0.5">Analyses</p>
        </div>
      </div>

      {trend != null && (
        <div className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2
          ${trend > 0 ? 'bg-signal-green_bg text-signal-green' :
            trend < 0 ? 'bg-signal-red_bg text-signal-red' :
            'bg-slate-faint text-slate-mid'}`}>
          <TrendIcon current={latest} previous={previous} />
          {trend > 0
            ? `You improved by ${trend} points since your last analysis. Keep going!`
            : trend < 0
            ? `Your score dropped by ${Math.abs(trend)} points. Try tailoring your resume more.`
            : `Same score as last time. Try adding more keywords from the JD.`}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => handleOpen(item.id)}
            className="card p-4 flex items-center gap-3 cursor-pointer hover:border-accent transition-colors"
          >
            <ScoreBadge score={item.score} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{item.job_title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-mid">
                  {new Date(item.analyzed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <span className="text-slate-light">·</span>
                <p className="text-xs text-slate-mid">{item.verdict}</p>
                {idx > 0 && (
                  <>
                    <span className="text-slate-light">·</span>
                    <TrendIcon current={item.score} previous={items[idx - 1]?.score} />
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => handleDelete(e, item.id)}
                disabled={deletingItem === item.id}
                className="p-1.5 rounded-lg hover:bg-signal-red_bg text-slate-mid hover:text-signal-red transition-colors"
              >
                {deletingItem === item.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />}
              </button>
              {loadingItem === item.id
                ? <Loader2 size={14} className="animate-spin text-accent" />
                : <ChevronRight size={14} className="text-slate-mid" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}