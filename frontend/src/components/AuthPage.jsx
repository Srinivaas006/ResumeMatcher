import React, { useState } from 'react'
import { Zap, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { login, signup } from '../lib/auth'

export default function AuthPage({ onAuth, onBack }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (!name.trim()) { setError('Name is required'); setLoading(false); return }
        await signup(email, name.trim(), password)
      }
      onAuth()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-faint flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-mid hover:text-ink transition-colors mb-4 mx-auto">
              ← Back to Home
            </button>
          )}
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">ResumeMatcher</h1>
          <p className="text-sm text-ink-muted mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex gap-1 p-1 bg-slate-faint border border-slate-light rounded-xl mb-6">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all
                  ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-slate-mid hover:text-ink'}`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-signal-red_bg border border-red-200 rounded-xl text-xs text-signal-red">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mid" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-light rounded-xl bg-white
                               focus:outline-none focus:ring-2 focus:ring-accent text-ink placeholder:text-slate-mid"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mid" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-light rounded-xl bg-white
                             focus:outline-none focus:ring-2 focus:ring-accent text-ink placeholder:text-slate-mid"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-mid" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-light rounded-xl bg-white
                             focus:outline-none focus:ring-2 focus:ring-accent text-ink placeholder:text-slate-mid"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-mid hover:text-ink"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-accent
                         hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-mid mt-4">
          Your resume data is private and only visible to you.
        </p>
      </div>
    </div>
  )
}