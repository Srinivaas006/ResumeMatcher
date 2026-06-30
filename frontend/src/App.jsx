import React, { useState } from 'react'
import { Zap, Github, FileSearch, ArrowLeft } from 'lucide-react'
import UploadForm from './components/UploadForm'
import ResultsPanel from './components/ResultsPanel'
import GitHubPanel from './components/GitHubPanel'
import LandingPage from './components/LandingPage'
import { useAnalyze } from './hooks/useAnalyze'

const MODES = [
  { key: 'resume', label: 'Resume Matcher', icon: FileSearch },
  { key: 'github', label: 'GitHub Analyzer', icon: Github },
]

export default function App() {
  const { result, loading, error, analyze, reset } = useAnalyze()
  const [mode, setMode] = useState('resume')
  const [page, setPage] = useState('home')

  function handleModeSwitch(m) {
    setMode(m)
    reset()
  }

  if (page === 'home') {
    return <LandingPage onGetStarted={() => setPage('app')} />
  }

  return (
    <div className="min-h-screen bg-slate-faint">
      <header className="border-b border-slate-light bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => setPage('home')} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-ink tracking-tight">ResumeMatcher</span>
          </button>
          <button onClick={() => setPage('home')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-mid hover:text-ink transition-colors">
            <ArrowLeft size={13} />
            Home
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex gap-1 p-1 bg-white border border-slate-light rounded-2xl mb-8 shadow-sm">
          {MODES.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => handleModeSwitch(key)}
              className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2
                ${mode === key ? 'bg-accent text-white shadow-sm' : 'text-slate-mid hover:text-ink'}`}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {mode === 'resume' && (
          <>
            {!result && !loading && (
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-ink mb-2 tracking-tight">
                  How well does your resume fit?
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Upload your resume and paste a job description. Get an instant AI-powered breakdown —
                  matched skills, gaps, ATS keywords, learning roadmap, and tailored interview prep.
                </p>
              </div>
            )}
            {error && (
              <div className="mb-6 p-4 bg-signal-red_bg border border-red-200 rounded-2xl text-sm text-signal-red">
                <strong>Error:</strong> {error}
              </div>
            )}
            {result ? (
              <ResultsPanel result={result} onReset={reset} />
            ) : (
              <div className="card p-6">
                <UploadForm onSubmit={analyze} loading={loading} />
              </div>
            )}
          </>
        )}

        {mode === 'github' && (
          <>
            {!result && (
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-ink mb-2 tracking-tight">
                  Is your GitHub recruiter-ready?
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Enter your GitHub username and get detailed feedback on your repos, README quality,
                  profile bio, and what to fix before applying for jobs.
                </p>
              </div>
            )}
            <GitHubPanel />
          </>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-slate-mid">
        Powered by Gemini · gemini-2.0-flash-lite
      </footer>
    </div>
  )
}