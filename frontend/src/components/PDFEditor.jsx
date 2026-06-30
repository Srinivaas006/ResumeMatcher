import React, { useEffect, useRef, useState } from 'react'
import { Download, Loader2, FileText, RotateCcw } from 'lucide-react'
import { extractEditable } from '../utils/api'

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return }
    const s = document.createElement('script')
    s.id = id; s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error('Failed to load: ' + src))
    document.head.appendChild(s)
  })
}

async function getHtml2Pdf() {
  if (window.html2pdf) return window.html2pdf
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf-lib')
  return window.html2pdf
}

export default function PDFEditor({ pdfFile }) {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [errorMsg, setErrorMsg] = useState('')
  const [lines, setLines] = useState([])
  const [originalLines, setOriginalLines] = useState([])
  const [saving, setSaving] = useState(false)
  const docRef = useRef(null)

  useEffect(() => {
    if (!pdfFile) return
    let dead = false

    async function load() {
      setStatus('loading')
      try {
        const data = await extractEditable(pdfFile)
        if (dead) return
        setLines(data.lines)
        setOriginalLines(JSON.parse(JSON.stringify(data.lines)))
        setStatus('ready')
      } catch (e) {
        if (!dead) { setErrorMsg(e.message); setStatus('error') }
      }
    }
    load()
    return () => { dead = true }
  }, [pdfFile])

  function updateLine(index, newText) {
    setLines(prev => {
      const next = [...prev]
      next[index] = { ...next[index], text: newText }
      return next
    })
  }

  function resetAll() {
    setLines(JSON.parse(JSON.stringify(originalLines)))
  }

  const hasEdits = JSON.stringify(lines) !== JSON.stringify(originalLines)

  async function downloadAsPdf() {
    setSaving(true)
    try {
      const html2pdf = await getHtml2Pdf()
      const opt = {
        margin: [15, 15, 15, 15],
        filename: `edited_${(pdfFile?.name || 'resume').replace(/\.pdf$/i, '')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }
      await html2pdf().set(opt).from(docRef.current).save()
    } catch (e) {
      alert('Failed to generate PDF: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function fontSizeFor(type) {
    if (type === 'heading') return '20px'
    if (type === 'subheading') return '14px'
    return '11.5px'
  }
  function fontWeightFor(type) {
    if (type === 'heading') return 700
    if (type === 'subheading') return 600
    return 400
  }
  function marginFor(type) {
    if (type === 'heading') return '4px 0 10px 0'
    if (type === 'subheading') return '14px 0 4px 0'
    return '3px 0'
  }

  if (status === 'error') {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-signal-red mb-1">Could not extract resume</p>
        <p className="text-xs text-ink-muted">{errorMsg}</p>
      </div>
    )
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="card p-10 flex flex-col items-center gap-3">
        <Loader2 size={22} className="text-accent animate-spin" />
        <p className="text-sm text-ink-muted">Converting your resume into an editable document…</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-accent" />
          <p className="text-xs text-ink-muted">Click anywhere below and edit like a normal document.</p>
        </div>
        <div className="flex items-center gap-2">
          {hasEdits && (
            <button onClick={resetAll}
              className="flex items-center gap-1 text-xs font-medium text-slate-mid hover:text-ink transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
          )}
          <button onClick={downloadAsPdf} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-xs font-semibold rounded-xl
                       hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {saving ? 'Generating…' : 'Download as PDF'}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-mid px-1">
        Your resume content is reflowed into a clean, editable document. Layout is simplified for reliable editing — no overlapping text, no broken fonts.
      </p>

      {/* Editable Document */}
      <div className="card overflow-auto p-0 bg-slate-light">
        <div className="flex justify-center py-6">
          <div
            ref={docRef}
            style={{
              width: '210mm',
              minHeight: '297mm',
              background: '#ffffff',
              padding: '20mm 18mm',
              boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              color: '#1a1a1a',
            }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={e => updateLine(i, e.currentTarget.textContent)}
                style={{
                  fontSize: fontSizeFor(line.type),
                  fontWeight: fontWeightFor(line.type),
                  margin: marginFor(line.type),
                  lineHeight: 1.5,
                  outline: 'none',
                  borderRadius: 3,
                  padding: '1px 3px',
                  minHeight: '1.4em',
                  transition: 'background 0.1s',
                }}
                onFocus={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
                onBlur={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}