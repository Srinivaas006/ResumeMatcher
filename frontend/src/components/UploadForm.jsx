import React, { useState, useRef } from 'react'
import { Upload, FileText, X, Loader2 } from 'lucide-react'

export default function UploadForm({ onSubmit, loading }) {
  const [resume, setResume] = useState(null)
  const [jd, setJd] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  function handleFile(file) {
    if (!file) return
    if (!['application/pdf', 'text/plain'].includes(file.type)) {
      alert('Only PDF or .txt files are supported.')
      return
    }
    setResume(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!resume || !jd.trim()) return
    onSubmit(resume, jd)
  }

  const canSubmit = resume && jd.trim().length > 50 && !loading

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Resume Upload */}
      <div>
        <p className="section-title">Resume</p>
        {resume ? (
          <div className="flex items-center gap-3 p-4 card">
            <FileText size={20} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{resume.name}</p>
              <p className="text-xs text-slate-mid">{(resume.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={() => setResume(null)}
              className="p-1.5 rounded-lg hover:bg-slate-light transition-colors"
            >
              <X size={14} className="text-slate-mid" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
              ${dragOver
                ? 'border-accent bg-accent-soft'
                : 'border-slate-mid hover:border-accent hover:bg-accent-soft'
              }
            `}
          >
            <Upload size={22} className="mx-auto mb-2 text-slate-mid" />
            <p className="text-sm text-ink font-medium">Drop your resume here</p>
            <p className="text-xs text-slate-mid mt-1">PDF or TXT · up to 5 MB</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* JD Input */}
      <div>
        <p className="section-title">Job Description</p>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the full job description here — the more detail, the better the analysis."
          rows={8}
          className="w-full p-4 text-sm text-ink bg-white border border-slate-light rounded-2xl resize-none
                     placeholder:text-slate-mid focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                     transition-all font-sans leading-relaxed"
        />
        <p className="text-xs text-slate-mid mt-1.5 text-right">{jd.length} chars</p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3.5 px-6 rounded-2xl font-semibold text-sm text-white bg-accent
                   hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Analyzing…
          </>
        ) : (
          'Analyze Match'
        )}
      </button>
    </form>
  )
}
