import React from 'react'
import { ArrowRight, FileSearch, Github, Map, FileEdit, Zap } from 'lucide-react'

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Resume vs JD Match',
    desc: 'Paste a job description, get an honest score with matched and missing skills broken down.',
  },
  {
    icon: Github,
    title: 'GitHub Profile Check',
    desc: 'Real recruiter-style feedback on your repos, READMEs, and what to fix before applying.',
  },
  {
    icon: Map,
    title: 'Learning Roadmap',
    desc: 'Week-by-week plan with free resources for every skill gap found in your resume.',
  },
  {
    icon: FileEdit,
    title: 'Skill Gap Roadmap',
    desc: 'See exactly which skills are missing and get a week-by-week plan to close the gap.',
  },
]

export default function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-slate-faint overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-slate-light bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-ink tracking-tight">ResumeMatcher</span>
          </div>
          <button
            onClick={onGetStarted}
            className="text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Open App
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <div className="animate-fade-up">
          <span className="label-tag bg-accent-soft text-accent text-xs mb-5 inline-flex">
            Built for students &amp; freshers
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight leading-[1.15] mb-4">
            Know exactly why<br />your resume gets ignored.
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed mb-8 max-w-md">
            Upload your resume, paste a job description, and get a precise breakdown of what's
            working, what's missing, and what to fix — before a recruiter ever sees it.
          </p>

          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-2 px-5 py-3 bg-ink text-white text-sm font-semibold
                       rounded-2xl hover:bg-ink/90 transition-all"
          >
            Analyze my resume
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      {/* Stat strip */}
      <section className="max-w-2xl mx-auto px-6 pb-12">
        <div
          className="card p-5 flex items-center justify-between divide-x divide-slate-light animate-fade-up"
          style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
        >
          <Stat value="100%" label="Free to use" />
          <Stat value="<30s" label="Per analysis" />
          <Stat value="0" label="Sign-ups needed" />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-2xl mx-auto px-6 pb-16">
        <p className="section-title mb-4">What you get</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="card p-5 hover:border-accent/30 hover:-translate-y-0.5 transition-all duration-200 animate-fade-up"
              style={{ animationDelay: `${120 + i * 60}ms`, animationFillMode: 'backwards' }}
            >
              <div className="w-9 h-9 bg-slate-light rounded-xl flex items-center justify-center mb-3">
                <f.icon size={16} className="text-ink" />
              </div>
              <p className="text-sm font-semibold text-ink mb-1">{f.title}</p>
              <p className="text-xs text-ink-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-2xl mx-auto px-6 pb-16">
        <p className="section-title mb-4">How it works</p>
        <div className="card divide-y divide-slate-light">
          <Step
            n="01"
            title="Upload your resume"
            desc="PDF format, parsed instantly — nothing is stored."
          />
          <Step
            n="02"
            title="Paste the job description"
            desc="From LinkedIn, Naukri, or anywhere else you found it."
          />
          <Step
            n="03"
            title="Get your breakdown"
            desc="Score, gaps, ATS keywords, roadmap, interview prep — all in one place."
          />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <div
          className="card p-8 text-center bg-ink animate-fade-up"
          style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}
        >
          <p className="text-lg font-bold text-white mb-2">Stop guessing. Start fixing.</p>
          <p className="text-xs text-white/60 mb-5 max-w-sm mx-auto">
            Three minutes to see exactly what's standing between you and the interview call.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-ink text-sm font-semibold
                       rounded-2xl hover:bg-white/90 transition-all"
          >
            Get started
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      <footer className="text-center pb-10 text-xs text-slate-mid">
        Built for students, by a student.
      </footer>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div className="flex-1 text-center px-2">
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{label}</p>
    </div>
  )
}

function Step({ n, title, desc }) {
  return (
    <div className="flex items-start gap-4 p-5">
      <span className="text-xs font-bold text-slate-mid mt-0.5 shrink-0 w-6">{n}</span>
      <div>
        <p className="text-sm font-semibold text-ink mb-0.5">{title}</p>
        <p className="text-xs text-ink-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}