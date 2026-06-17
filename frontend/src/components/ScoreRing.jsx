import React from 'react'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function scoreColor(score) {
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#d97706'
  return '#dc2626'
}

function verdictStyle(verdict) {
  const map = {
    'Strong Match': 'bg-signal-green_bg text-signal-green',
    'Good Match': 'bg-signal-green_bg text-signal-green',
    'Partial Match': 'bg-signal-amber_bg text-signal-amber',
    'Weak Match': 'bg-signal-red_bg text-signal-red',
  }
  return map[verdict] || 'bg-slate-light text-ink-muted'
}

export default function ScoreRing({ score, verdict }) {
  const progress = (score / 100) * CIRCUMFERENCE
  const color = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={RADIUS}
            fill="none"
            stroke="#efefed"
            strokeWidth="10"
          />
          <circle
            cx="60" cy="60" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE - progress}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-ink" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-slate-mid font-medium">/100</span>
        </div>
      </div>
      <span className={`label-tag text-sm font-semibold px-3 py-1.5 ${verdictStyle(verdict)}`}>
        {verdict}
      </span>
    </div>
  )
}
