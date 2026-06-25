import React, { useState } from 'react'
import { Github, Loader2, Star, AlertTriangle, CheckCircle2, Zap, BookOpen } from 'lucide-react'
import { analyzeGitHub } from '../utils/api'

function gradeColor(grade) {
  const map = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626' }
  return map[grade] || '#64748b'
}

function priorityBadge(p) {
  const map = {
    High: 'bg-signal-red_bg text-signal-red',
    Medium: 'bg-signal-amber_bg text-signal-amber',
    Low: 'bg-accent-soft text-accent',
  }
  return map[p] || 'bg-slate-light text-ink-muted'
}

export default function GitHubPanel() {
  const [username, setUsername] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleAnalyze() {
    if (!username.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await analyzeGitHub(username.trim(), targetRole.trim())
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!result && !loading) {
    return (
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-light rounded-2xl flex items-center justify-center">
            <Github size={20} className="text-ink" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">GitHub Profile Analyzer</p>
            <p className="text-xs text-ink-muted">Get recruiter-ready feedback on your GitHub</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="section-title mb-1.5">GitHub Username</p>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. Srinivaas006"
              className="w-full p-3 text-sm text-ink bg-white border border-slate-light rounded-2xl
                         placeholder:text-slate-mid focus:outline-none focus:ring-2 focus:ring-accent
                         focus:border-transparent transition-all"
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            />
          </div>
          <div>
            <p className="section-title mb-1.5">Target Role <span className="text-slate-mid font-normal">(optional)</span></p>
            <input
              type="text"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              placeholder="e.g. Full Stack Developer, Backend Engineer"
              className="w-full p-3 text-sm text-ink bg-white border border-slate-light rounded-2xl
                         placeholder:text-slate-mid focus:outline-none focus:ring-2 focus:ring-accent
                         focus:border-transparent transition-all"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-signal-red p-3 bg-signal-red_bg rounded-xl">{error}</p>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!username.trim()}
          className="w-full py-3 rounded-2xl bg-ink text-white text-sm font-semibold
                     hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all flex items-center justify-center gap-2"
        >
          <Github size={15} />
          Analyze GitHub Profile
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card p-8 flex flex-col items-center gap-3">
        <Loader2 size={24} className="text-accent animate-spin" />
        <p className="text-sm text-ink-muted">Fetching and analyzing your GitHub profile…</p>
      </div>
    )
  }

  const color = gradeColor(result.grade)

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Score Header */}
      <div className="card p-5 flex items-center gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0"
          style={{ backgroundColor: color + '15', border: `2px solid ${color}30` }}
        >
          <span className="text-2xl font-bold" style={{ color }}>{result.grade}</span>
          <span className="text-xs font-medium" style={{ color }}>{result.overall_score}/100</span>
        </div>
        <div>
          <p className="text-sm font-bold text-ink">@{username}</p>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">{result.summary}</p>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 gap-4">
        <div className="card p-5">
          <p className="section-title flex items-center gap-2 mb-3">
            <CheckCircle2 size={12} /> Profile Strengths
          </p>
          <div className="space-y-3">
            {result.profile_strengths.map((s, i) => (
              <div key={i} className="flex gap-3">
                <Star size={14} className="text-signal-green mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-ink">{s.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="section-title flex items-center gap-2 mb-3">
            <AlertTriangle size={12} /> Weaknesses
          </p>
          <div className="space-y-3">
            {result.profile_weaknesses.map((w, i) => (
              <div key={i} className="flex gap-3">
                <AlertTriangle size={14} className="text-signal-amber mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-ink">{w.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{w.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* README Quality */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="section-title flex items-center gap-2">
            <BookOpen size={12} /> README Quality
          </p>
          <span className={`label-tag text-xs ${
            result.readme_quality === 'Excellent' ? 'bg-signal-green_bg text-signal-green' :
            result.readme_quality === 'Good' ? 'bg-accent-soft text-accent' :
            result.readme_quality === 'Basic' ? 'bg-signal-amber_bg text-signal-amber' :
            'bg-signal-red_bg text-signal-red'
          }`}>
            {result.readme_quality}
          </span>
        </div>
        <div className="space-y-1.5">
          {result.readme_tips.map((tip, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-accent font-bold text-xs mt-0.5 shrink-0">→</span>
              <p className="text-xs text-ink-muted">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Repos */}
      {result.top_repos?.length > 0 && (
        <div className="card p-5">
          <p className="section-title flex items-center gap-2 mb-3">
            <Github size={12} /> Top Repos Feedback
          </p>
          <div className="space-y-3">
            {result.top_repos.map((repo, i) => (
              <div key={i} className="p-3 bg-slate-faint rounded-xl">
                <p className="text-xs font-bold text-ink font-mono mb-1">{repo.name}</p>
                <p className="text-xs text-ink-muted mb-1.5">{repo.why}</p>
                <div className="flex gap-2">
                  <span className="text-accent font-bold text-xs shrink-0">Fix:</span>
                  <p className="text-xs text-ink">{repo.improvement}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      <div className="card p-5">
        <p className="section-title flex items-center gap-2 mb-3">
          <Zap size={12} /> Action Items
        </p>
        <div className="space-y-3">
          {result.action_items.map((item, i) => (
            <div key={i} className="flex gap-3 p-3 bg-slate-faint rounded-xl">
              <span className={`label-tag text-xs shrink-0 h-fit ${priorityBadge(item.priority)}`}>
                {item.priority}
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">{item.action}</p>
                <p className="text-xs text-ink-muted mt-0.5">{item.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bio Suggestion */}
      {result.bio_suggestion && (
        <div className="card p-5">
          <p className="section-title mb-2">✨ Suggested Bio</p>
          <p className="text-xs text-ink leading-relaxed p-3 bg-accent-soft rounded-xl border border-accent/20">
            {result.bio_suggestion}
          </p>
        </div>
      )}

      {/* Pinned Repos */}
      {result.pinned_repos_suggestion && (
        <div className="card p-5">
          <p className="section-title mb-2">📌 Pinned Repos Strategy</p>
          <p className="text-xs text-ink-muted leading-relaxed">{result.pinned_repos_suggestion}</p>
        </div>
      )}

      <button
        onClick={() => { setResult(null); setUsername(''); setTargetRole('') }}
        className="w-full py-3 text-sm text-slate-mid hover:text-ink font-medium
                   flex items-center justify-center gap-2 transition-colors"
      >
        Analyze another profile
      </button>
    </div>
  )
}