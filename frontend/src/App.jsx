import React, { useState, useEffect } from 'react'
import { Zap, Github, FileSearch, ArrowLeft, Clock, LogOut, User } from 'lucide-react'
import UploadForm from './components/UploadForm'
import ResultsPanel from './components/ResultsPanel'
import GitHubPanel from './components/GitHubPanel'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import Dashboard from './components/Dashboard'
import { useAnalyze } from './hooks/useAnalyze'
import { isLoggedIn, getUser, logout, saveAnalysis } from './lib/auth'

const MODES = [
  { key: 'resume', label: 'Resume Matcher', icon: FileSearch },
  { key: 'github', label: 'GitHub Analyzer', icon: Github },
  { key: 'history', label: 'My History', icon: Clock },
]

export default function App() {
  const { result, loading, error, analyze, reset, resumeFile } = useAnalyze()
  const [mode, setMode] = useState('resume')
  const [page, setPage] = useState('home')
  const [user, setUser] = useState(getUser())
  const [savedId, setSavedId] = useState(null)

  useEffect(() => {
    if (result && isLoggedIn()) {
      const jdEl = document.querySelector('textarea[data-jd]')
      const jd = jdEl?.value || ''
      saveAnalysis({
        jobTitle: extractTitle(result) || 'Untitled Role',
        jobDescription: jd,
        resumeText: '',
        score: result.overall_score,
        verdict: result.verdict,
        resultJson: result,
      }).then(saved => { if (saved) setSavedId(saved.id) })
    }
  }, [result])

  function extractTitle(r) {
    const summary = r?.summary || ''
    const match = summary.match(/(?:role|position|job)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+?)(?:\s+at|\.|,|$)/i)
    return match?.[1]?.trim() || r?.verdict || 'Analysis'
  }

  function handleModeSwitch(m) {
    setMode(m)
    reset()
    setSavedId(null)
  }

  function handleAuth() {
    setUser(getUser())
    setPage('app')
  }

  function handleLogout() {
    logout()
    setUser(null)
    setPage('home')
    reset()
  }

  function handleLoadFromHistory(detail) {
    try {
      const parsed = JSON.parse(detail.result_json)
      setMode('resume')
    } catch (e) {}
    setMode('resume')
  }

  if (page === 'home') {
    return <LandingPage onGetStarted={() => setPage(isLoggedIn() ? 'app' : 'auth')} />
  }

  if (page === 'auth') {
    return <AuthPage onAuth={handleAuth} />
  }

  return (
    <div className="min-h-screen bg-slate-faint">
      <header className="border-b border-slate-light bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setPage('home')}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-ink tracking-tight">ResumeMatcher</span>
          </button>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-mid">
                <User size={12} />
                {user.name}
              </span>
            )}
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-mid hover:text-ink transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            ) : (
              <button
                onClick={() => setPage('auth')}
                className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex gap-1 p-1 bg-white border border-slate-light rounded-2xl mb-8 shadow-sm
                        overflow-x-auto no-scrollbar">
          {MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleModeSwitch(key)}
              className={`flex-1 shrink-0 whitespace-nowrap py-2.5 px-4 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2
                ${mode === key ? 'bg-accent text-white shadow-sm' : 'text-slate-mid hover:text-ink'}`}
            >
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
              <>
                {savedId && isLoggedIn() && (
                  <div className="mb-4 p-3 bg-signal-green_bg border border-green-200 rounded-xl text-xs text-signal-green font-medium">
                    ✓ Analysis saved to your history
                  </div>
                )}
                <ResultsPanel result={result} onReset={() => { reset(); setSavedId(null) }} resumeFile={resumeFile} />
              </>
            ) : (
              <div className="card p-6">
                <UploadForm onSubmit={analyze} loading={loading} />
              </div>
            )}
          </>
        )}

        {mode === 'github' && (
          <>
            {(
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

        {mode === 'history' && (
          <>
            {!isLoggedIn() ? (
              <div className="text-center py-16">
                <Clock size={32} className="text-slate-light mx-auto mb-3" />
                <p className="text-sm font-semibold text-ink mb-2">Sign in to see your history</p>
                <p className="text-xs text-slate-mid mb-4">Your analyses are saved automatically when you're logged in.</p>
                <button
                  onClick={() => setPage('auth')}
                  className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-xl hover:bg-accent-hover transition-colors"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-ink mb-1 tracking-tight">Your History</h1>
                  <p className="text-sm text-ink-muted">Track your progress over time. Scores save automatically.</p>
                </div>
                <Dashboard onLoadAnalysis={handleLoadFromHistory} />
              </>
            )}
          </>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-slate-mid">
        Powered by Gemini · gemini-2.0-flash-lite
      </footer>
    </div>
  )
}