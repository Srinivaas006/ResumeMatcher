import React, { useState } from 'react'
import { CheckCircle2, XCircle, TrendingUp, AlertTriangle, Lightbulb, Tag, MessageSquare, RotateCcw } from 'lucide-react'
import ScoreRing from './ScoreRing'
import RoadmapPanel from './RoadmapPanel'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'skills', label: 'Skills' },
  { key: 'roadmap', label: '🗺 Roadmap' },
  { key: 'improvements', label: 'Resume Fix' },
  { key: 'interview', label: 'Interview' },
]

function importanceBadge(imp) {
  const map = {
    Critical: 'bg-signal-red_bg text-signal-red',
    High: 'bg-signal-amber_bg text-signal-amber',
    Medium: 'bg-accent-soft text-accent',
  }
  return map[imp] || 'bg-slate-light text-ink-muted'
}

export default function ResultsPanel({ result, onReset }) {
  const [tab, setTab] = useState('overview')
  const missingSkillNames = (result.missing_skills || []).map(s => s.skill)

  return (
    <div className="animate-fade-up space-y-6">
      <div className="card p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreRing score={result.overall_score} verdict={result.verdict} />
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-bold text-ink mb-2">Analysis Complete</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{result.summary}</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-light rounded-2xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all whitespace-nowrap
              ${tab === t.key ? 'bg-white text-ink shadow-sm' : 'text-slate-mid hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-up">
        {tab === 'overview' && <OverviewTab result={result} />}
        {tab === 'skills' && <SkillsTab result={result} />}
        {tab === 'roadmap' && (
          missingSkillNames.length > 0
            ? <RoadmapPanel missingSkills={missingSkillNames} context={result.verdict} />
            : <div className="card p-6 text-center text-sm text-ink-muted">No missing skills found 🎉</div>
        )}
        {tab === 'improvements' && <ImprovementsTab result={result} />}
        {tab === 'interview' && <InterviewTab result={result} />}
      </div>

      <button onClick={onReset}
        className="w-full py-3 text-sm text-slate-mid hover:text-ink font-medium flex items-center justify-center gap-2 transition-colors">
        <RotateCcw size={14} /> Analyze another resume
      </button>
    </div>
  )
}

function OverviewTab({ result }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="section-title flex items-center gap-2"><TrendingUp size={12} /> Strengths</p>
        <div className="space-y-3">
          {result.strengths.map((s, i) => (
            <div key={i} className="flex gap-3">
              <CheckCircle2 size={16} className="text-signal-green mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink">{s.title}</p>
                <p className="text-xs text-ink-muted mt-0.5">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <p className="section-title flex items-center gap-2"><AlertTriangle size={12} /> Gaps</p>
        <div className="space-y-3">
          {result.gaps.map((g, i) => (
            <div key={i} className="flex gap-3">
              <XCircle size={16} className="text-signal-red mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink">{g.title}</p>
                <p className="text-xs text-ink-muted mt-0.5">{g.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {result.ats_keywords_missing?.length > 0 && (
        <div className="card p-5">
          <p className="section-title flex items-center gap-2"><Tag size={12} /> ATS Keywords Missing</p>
          <div className="flex flex-wrap gap-2">
            {result.ats_keywords_missing.map((kw, i) => (
              <span key={i} className="label-tag bg-signal-red_bg text-signal-red font-mono text-xs">{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SkillsTab({ result }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="section-title flex items-center gap-2"><CheckCircle2 size={12} /> Matched Skills</p>
        <div className="space-y-2.5">
          {result.matched_skills.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-slate-light last:border-0">
              <span className="text-sm font-semibold text-ink">{s.skill}</span>
              <span className="text-xs text-ink-muted text-right max-w-[60%]">{s.context}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <p className="section-title flex items-center gap-2"><XCircle size={12} /> Missing Skills</p>
        <div className="space-y-3">
          {result.missing_skills.map((s, i) => (
            <div key={i} className="p-3 bg-slate-faint rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-ink">{s.skill}</span>
                <span className={`label-tag text-xs ${importanceBadge(s.importance)}`}>{s.importance}</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">{s.suggestion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ImprovementsTab({ result }) {
  return (
    <div className="card p-5 space-y-4">
      <p className="section-title flex items-center gap-2"><Lightbulb size={12} /> Suggested Improvements</p>
      {result.resume_improvements.map((item, i) => (
        <div key={i} className="p-4 bg-slate-faint rounded-xl space-y-2">
          <span className="label-tag bg-accent-soft text-accent text-xs">{item.section}</span>
          {item.current && (
            <div>
              <p className="text-xs font-semibold text-slate-mid uppercase tracking-wider mb-1">Current</p>
              <p className="text-xs text-ink-muted font-mono bg-white border border-slate-light rounded-lg p-2 leading-relaxed">{item.current}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-signal-green uppercase tracking-wider mb-1">Suggestion</p>
            <p className="text-xs text-ink leading-relaxed">{item.suggestion}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function InterviewTab({ result }) {
  return (
    <div className="card p-5 space-y-4">
      <p className="section-title flex items-center gap-2"><MessageSquare size={12} /> Likely Interview Questions</p>
      {result.interview_prep.map((item, i) => (
        <div key={i} className="p-4 bg-slate-faint rounded-xl space-y-2">
          <p className="text-sm font-semibold text-ink">Q{i + 1}. {item.question}</p>
          <p className="text-xs text-ink-muted leading-relaxed">{item.tip}</p>
        </div>
      ))}
    </div>
  )
}