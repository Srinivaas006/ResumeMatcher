import React, { useEffect, useRef, useState } from 'react'
import { Download, Loader2, MousePointer, Check, X, Info } from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const PDFJS_VERSION = '3.4.120'
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return }
    const s = document.createElement('script')
    s.id = id
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function getPdfJs() {
  if (window.__pdfjs_ready) return window.pdfjsLib
  await loadScript(`${PDFJS_CDN}/pdf.min.js`, 'pdfjs-lib')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`
  window.__pdfjs_ready = true
  return window.pdfjsLib
}

export default function PDFEditor({ pdfFile }) {
  const canvasRef = useRef(null)
  const inputRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('')
  const [pdfBytes, setPdfBytes] = useState(null)
  const [textItems, setTextItems] = useState([])
  const [canvasW, setCanvasW] = useState(0)
  const [canvasH, setCanvasH] = useState(0)
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const SCALE = 1.5

  useEffect(() => {
    if (!pdfFile) return
    let dead = false

    ;(async () => {
      setStatus('loading')
      setEdits({})
      try {
        const buf = await pdfFile.arrayBuffer()
        if (dead) return
        setPdfBytes(buf.slice(0))

        const pdfjs = await getPdfJs()
        if (dead) return

        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
        if (dead) return

        const page = await doc.getPage(1)
        const vp = page.getViewport({ scale: SCALE })

        const canvas = canvasRef.current
        canvas.width = vp.width
        canvas.height = vp.height
        setCanvasW(vp.width)
        setCanvasH(vp.height)

        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        if (dead) return

        // Extract text positions
        const { items } = await page.getTextContent()
        const parsed = []
        items.forEach((item, i) => {
          if (!item.str?.trim()) return
          const t = pdfjs.Util.transform(vp.transform, item.transform)
          const x = t[4]
          const y = t[5]
          const fh = Math.abs(item.transform[3]) * SCALE
          const fw = item.width * SCALE
          parsed.push({
            idx: i,
            str: item.str,
            x,
            y: y - fh,
            w: Math.max(fw, 16),
            h: Math.max(fh, 8),
            fs: Math.abs(item.transform[3]),
          })
        })
        setTextItems(parsed)
        setStatus('ready')
      } catch (e) {
        if (!dead) { setErrorMsg(e.message); setStatus('error') }
      }
    })()

    return () => { dead = true }
  }, [pdfFile])

  useEffect(() => {
    if (editing !== null) setTimeout(() => inputRef.current?.focus(), 30)
  }, [editing])

  function startEdit(item) {
    setEditing(item.idx)
    setEditValue(edits[item.idx] ?? item.str)
  }

  function commit() {
    if (editing === null) return
    const orig = textItems.find(t => t.idx === editing)?.str ?? ''
    if (editValue.trim() && editValue !== orig) {
      setEdits(p => ({ ...p, [editing]: editValue }))
    } else {
      const n = { ...edits }; delete n[editing]; setEdits(n)
    }
    setEditing(null)
  }

  function cancel() { setEditing(null) }

  async function download() {
    if (!pdfBytes) return
    setSaving(true)
    try {
      const doc = await PDFDocument.load(pdfBytes.slice(0))
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const page = doc.getPages()[0]
      const { height: ph } = page.getSize()

      for (const item of textItems) {
        const txt = edits[item.idx]
        if (!txt || txt === item.str) continue
        const px = item.x / SCALE
        const py = ph - ((item.y + item.h) / SCALE)
        const fs = Math.max(item.fs, 6)
        // white box over original
        page.drawRectangle({ x: px - 1, y: py - 1, width: item.w / SCALE + 10, height: item.h / SCALE + 2, color: rgb(1, 1, 1) })
        // new text
        page.drawText(txt, { x: px, y: py, size: fs, font, color: rgb(0, 0, 0) })
      }

      const bytes = await doc.save()
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `edited_${pdfFile.name}` })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) { alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  const editCount = Object.keys(edits).length

  if (status === 'error') return (
    <div className="card p-8 text-center">
      <p className="text-sm font-semibold text-signal-red mb-1">Could not load PDF</p>
      <p className="text-xs text-ink-muted">{errorMsg}</p>
    </div>
  )

  if (status === 'loading') return (
    <div className="card p-10 flex flex-col items-center gap-3">
      <Loader2 size={22} className="text-accent animate-spin" />
      <p className="text-sm text-ink-muted">Rendering PDF…</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MousePointer size={13} className="text-accent" />
          <p className="text-xs text-ink-muted">Click any text to edit · Enter to save · Esc to cancel</p>
        </div>
        <div className="flex items-center gap-2">
          {editCount > 0 && (
            <span className="text-xs font-bold text-accent bg-accent-soft px-2.5 py-1 rounded-lg">
              {editCount} edit{editCount !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={download} disabled={saving || editCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-xs font-semibold rounded-xl
                       hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {saving ? 'Saving…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-1">
        <Info size={11} className="text-slate-mid shrink-0" />
        <p className="text-xs text-slate-mid">Original layout preserved. Edited text uses Helvetica font.</p>
      </div>

      {/* PDF with overlay */}
      <div className="card overflow-auto p-0">
        <div className="relative" style={{ width: canvasW, height: canvasH, minWidth: canvasW }}>
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, display: 'block' }} />

          {textItems.map(item => {
            const active = editing === item.idx
            const edited = Boolean(edits[item.idx])
            return (
              <div key={item.idx} onClick={() => !active && startEdit(item)}
                style={{
                  position: 'absolute', left: item.x - 1, top: item.y - 1,
                  width: item.w + 4, height: item.h + 2,
                  cursor: 'text', zIndex: active ? 50 : 5,
                }}>
                {active ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, position: 'absolute', top: 0, left: 0, zIndex: 100, whiteSpace: 'nowrap' }}>
                    <input ref={inputRef} value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') cancel() }}
                      onBlur={commit}
                      style={{
                        height: Math.max(item.h + 6, 24),
                        width: Math.max(item.w + 60, 140),
                        fontSize: Math.max(item.fs * 0.95, 10),
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        padding: '0 6px',
                        border: '2.5px solid #6366f1',
                        borderRadius: 5,
                        outline: 'none',
                        background: '#fff',
                        color: '#111',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
                      }} />
                    <button onMouseDown={e => { e.preventDefault(); commit() }}
                      style={{ width: 24, height: 24, background: '#16a34a', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={13} color="white" strokeWidth={3} />
                    </button>
                    <button onMouseDown={e => { e.preventDefault(); cancel() }}
                      style={{ width: 24, height: 24, background: '#ef4444', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={13} color="white" strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <div style={{
                    width: '100%', height: '100%', borderRadius: 2,
                    background: edited ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: `1px solid ${edited ? 'rgba(99,102,241,0.45)' : 'transparent'}`,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = edited ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = edited ? 'rgba(99,102,241,0.15)' : 'transparent'; e.currentTarget.style.borderColor = edited ? 'rgba(99,102,241,0.45)' : 'transparent' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}