import React, { useState } from 'react'
import { BookOpen, ExternalLink, ChevronDown, ChevronUp, Loader2, Map, Lightbulb } from 'lucide-react'
import { fetchRoadmap } from '../utils/api'

const TYPE_COLORS = {
  YouTube: 'bg-red-50 text-red-600',
  Docs: 'bg-blue-50 text-blue-600',
  Course: 'bg-purple-50 text-purple-600',
  Article: 'bg-green-50 text-green-600',
  Practice: 'bg-orange-50 text-orange-600',
}

export default function RoadmapPanel({ missingSkills, context }) {
  const [roadmap, setRoadmap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [openWeeks, setOpenWeeks] = useState({})

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRoadmap(missingSkills, context)
      setRoadmap(data)
      // Open first week by default
      setOpenWeeks({ 1: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleWeek(week) {
    setOpenWeeks(prev => ({ ...prev, [week]: !prev[week] }))
  }

  if (!roadmap && !loading) {
    return (
      <div className="card p-6 text-center space-y-3">
        <div className="w-10 h-10 bg-accent-soft rounded-2xl flex items-center justify-center mx-auto">
          <Map size={20} className="text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Learning Roadmap</p>
          <p className="text-xs text-ink-muted mt-1">
            Get a week-by-week plan with free resources to learn your {missingSkills.length} missing skill{missingSkills.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {missingSkills.slice(0, 6).map((s, i) => (
            <span key={i} className="label-tag bg-signal-red_bg text-signal-red text-xs">{s}</span>
          ))}
          {missingSkills.length > 6 && (
            <span className="label-tag bg-slate-light text-ink-muted text-xs">+{missingSkills.length - 6} more</span>
          )}
        </div>
        {error && (
          <p className="text-xs text-signal-red">{error}</p>
        )}
        <button
          onClick={generate}
          className="w-full py-3 rounded-2xl bg-accent text-white text-sm font-semibold
                     hover:bg-accent-hover transition-all flex items-center justify-center gap-2"
        >
          <BookOpen size={15} />
          Generate My Roadmap
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card p-8 flex flex-col items-center gap-3">
        <Loader2 size={24} className="text-accent animate-spin" />
        <p className="text-sm text-ink-muted">Building your personalized roadmap…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-ink">{roadmap.goal_summary}</p>
            <p className="text-xs text-ink-muted mt-1">{roadmap.total_weeks} weeks · Learn at your own pace</p>
          </div>
          <span className="label-tag bg-accent-soft text-accent text-xs shrink-0">
            {roadmap.total_weeks}w plan
          </span>
        </div>
      </div>

      {/* Weeks */}
      {roadmap.weeks.map((week) => (
        <div key={week.week} className="card overflow-hidden">
          <button
            onClick={() => toggleWeek(week.week)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-faint transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent-soft flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-accent">W{week.week}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{week.focus}</p>
                <p className="text-xs text-ink-muted">{week.daily_hours}h/day · {week.resources.length} resources</p>
              </div>
            </div>
            {openWeeks[week.week]
              ? <ChevronUp size={16} className="text-slate-mid shrink-0" />
              : <ChevronDown size={16} className="text-slate-mid shrink-0" />
            }
          </button>

          {openWeeks[week.week] && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-light">
              {/* Topics */}
              <div className="pt-3">
                <p className="text-xs font-semibold text-slate-mid uppercase tracking-wider mb-2">Topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {week.topics.map((t, i) => (
                    <span key={i} className="label-tag bg-slate-light text-ink text-xs">{t}</span>
                  ))}
                </div>
              </div>

              {/* Resources */}
              <div>
                <p className="text-xs font-semibold text-slate-mid uppercase tracking-wider mb-2">Resources</p>
                <div className="space-y-2">
                  {week.resources.map((r, i) => (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 bg-slate-faint rounded-xl hover:bg-slate-light transition-colors group"
                    >
                      <span className={`label-tag text-xs shrink-0 ${TYPE_COLORS[r.type] || 'bg-slate-light text-ink-muted'}`}>
                        {r.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink group-hover:text-accent transition-colors truncate">
                          {r.title}
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{r.description}</p>
                      </div>
                      <ExternalLink size={12} className="text-slate-mid shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Milestone */}
              <div className="p-3 bg-signal-green_bg rounded-xl">
                <p className="text-xs font-semibold text-signal-green mb-0.5">Week {week.week} Milestone</p>
                <p className="text-xs text-ink leading-relaxed">{week.milestone}</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Tips */}
      {roadmap.tips?.length > 0 && (
        <div className="card p-5">
          <p className="section-title flex items-center gap-2 mb-3">
            <Lightbulb size={12} /> Pro Tips
          </p>
          <div className="space-y-2">
            {roadmap.tips.map((tip, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-accent font-bold text-xs mt-0.5 shrink-0">→</span>
                <p className="text-xs text-ink-muted leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}