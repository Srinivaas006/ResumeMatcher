import React, { useEffect, useRef, useState } from 'react'
import { Download, Loader2, MousePointer, Check, X, Info } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Point worker to the installed package's worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export default function PDFEditor({ pdfFile }) {
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [pdfBytes, setPdfBytes] = useState(null)
  const [textItems, setTextItems] = useState([])
  const [viewport, setViewport] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const [scale] = useState(1.5)
  const inputRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!pdfFile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const arrayBuffer = await pdfFile.arrayBuffer()
        setPdfBytes(arrayBuffer.slice(0))

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
        const doc = await loadingTask.promise
        if (cancelled) return

        const page = await doc.getPage(1)
        const vp = page.getViewport({ scale })
        setViewport(vp)

        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = vp.width
        canvas.height = vp.height
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport: vp }).promise

        // Extract text with positions
        const content = await page.getTextContent()
        const items = []
        content.items.forEach((item, idx) => {
          if (!item.str?.trim()) return
          const tx = pdfjsLib.Util.transform(vp.transform, item.transform)
          const x = tx[4]
          const y = tx[5]
          const h = Math.abs(item.transform[3]) * scale
          const w = item.width * scale
          items.push({
            index: idx,
            str: item.str,
            x,
            y: y - h,
            w: Math.max(w, 20),
            h: Math.max(h, 10),
            fontSize: Math.abs(item.transform[3]),
          })
        })
        setTextItems(items)
      } catch (e) {
        console.error('PDF load error', e)
        setError('Failed to load PDF: ' + e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [pdfFile])

  useEffect(() => {
    if (editing !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function startEdit(item) {
    setEditing(item.index)
    setEditValue(edits[item.index] ?? item.str)
  }

  function commitEdit() {
    if (editing === null) return
    const original = textItems.find(t => t.index === editing)?.str ?? ''
    if (!editValue.trim() || editValue === original) {
      const next = { ...edits }
      delete next[editing]
      setEdits(next)
    } else {
      setEdits(prev => ({ ...prev, [editing]: editValue }))
    }
    setEditing(null)
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function downloadPDF() {
    if (!pdfBytes) return
    setSaving(true)
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes.slice(0))
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const pages = pdfDoc.getPages()
      const page = pages[0]
      const { height } = page.getSize()

      for (const item of textItems) {
        const newText = edits[item.index]
        if (!newText || newText === item.str) continue

        const pdfX = item.x / scale
        const pdfY = height - ((item.y + item.h) / scale)
        const pdfW = item.w / scale
        const pdfH = item.h / scale
        const fontSize = Math.max(item.fontSize, 6)

        // Cover original
        page.drawRectangle({
          x: pdfX - 1,
          y: pdfY - 1,
          width: pdfW + 12,
          height: pdfH + 2,
          color: rgb(1, 1, 1),
        })

        // Draw new text
        page.drawText(newText, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        })
      }

      const edited = await pdfDoc.save()
      const blob = new Blob([edited], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited_${pdfFile.name}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Save error', e)
      alert('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const editCount = Object.keys(edits).length

  if (error) {
    return (
      <div className="card p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-signal-red">Failed to load PDF</p>
        <p className="text-xs text-ink-muted">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3">
        <Loader2 size={24} className="text-accent animate-spin" />
        <p className="text-sm text-ink-muted">Loading PDF for editing…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MousePointer size={14} className="text-accent" />
          <p className="text-xs text-ink-muted">Click any text to edit it inline</p>
        </div>
        <div className="flex items-center gap-3">
          {editCount > 0 && (
            <span className="text-xs font-semibold text-accent bg-accent-soft px-2 py-1 rounded-lg">
              {editCount} edit{editCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={downloadPDF}
            disabled={saving || editCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-xs font-semibold
                       rounded-xl hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {saving ? 'Saving…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 px-1">
        <Info size={12} className="text-slate-mid shrink-0" />
        <p className="text-xs text-slate-mid">
          Edited text uses Helvetica font. Original layout and positions are preserved.
        </p>
      </div>

      {/* PDF + overlays */}
      <div className="card overflow-auto">
        <div className="relative inline-block" style={{ minWidth: viewport?.width ?? 600 }}>
          <canvas ref={canvasRef} className="block" />

          {/* Overlay hit areas */}
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            {textItems.map((item) => {
              const isEdited = Boolean(edits[item.index])
              const isActive = editing === item.index

              return (
                <div
                  key={item.index}
                  style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    width: item.w + 8,
                    height: item.h + 4,
                    pointerEvents: 'auto',
                    cursor: 'text',
                  }}
                  onClick={() => !isActive && startEdit(item)}
                >
                  {isActive ? (
                    <div style={{ position: 'absolute', top: -4, left: -2, zIndex: 50, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        ref={inputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        style={{
                          fontSize: Math.max(item.fontSize * scale * 0.72, 10),
                          padding: '1px 4px',
                          border: '2px solid #6366f1',
                          borderRadius: 4,
                          outline: 'none',
                          background: 'white',
                          minWidth: Math.max(item.w, 80),
                          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                          fontFamily: 'Helvetica, Arial, sans-serif',
                        }}
                      />
                      <button onClick={e => { e.stopPropagation(); commitEdit() }}
                        style={{ width: 20, height: 20, background: '#16a34a', borderRadius: 4, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} color="white" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); cancelEdit() }}
                        style={{ width: 20, height: 20, background: '#ef4444', borderRadius: 4, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={11} color="white" />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%', height: '100%', borderRadius: 2,
                        backgroundColor: isEdited ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: isEdited ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => {
                        if (!isEdited) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)'
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = isEdited ? 'rgba(99,102,241,0.15)' : 'transparent'
                        e.currentTarget.style.borderColor = isEdited ? 'rgba(99,102,241,0.4)' : 'transparent'
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}