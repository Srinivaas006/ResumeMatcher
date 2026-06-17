import React from 'react'
import { Zap } from 'lucide-react'
import UploadForm from './components/UploadForm'
import ResultsPanel from './components/ResultsPanel'
import { useAnalyze } from './hooks/useAnalyze'

export default function App() {
  const { result, loading, error, analyze, reset } = useAnalyze()

  return (
    <div className="min-h-screen bg-slate-faint">
      {/* Top bar */}
      <header className="border-b border-slate-light bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-ink tracking-tight">MatchIQ</span>
          </div>
          <span className="text-xs text-slate-mid font-medium">Resume × JD Analyzer</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {!result && !loading && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink mb-2 tracking-tight">
              How well does your resume fit?
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              Upload your resume and paste a job description. Get an instant AI-powered breakdown —
              matched skills, gaps, ATS keywords, and tailored interview prep.
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
      </main>

      <footer className="text-center py-8 text-xs text-slate-mid">
        Powered by Groq · llama3-70b
      </footer>
    </div>
  )
}
