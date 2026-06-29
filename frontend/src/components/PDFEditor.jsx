import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Loader2, MousePointer, Check, X } from 'lucide-react'

// Load pdfjs from CDN to avoid build issues
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'

async function loadPdfJs() {
  if (window._pdfjs) return window._pdfjs
  const mod = await import(/* @vite-ignore */ PDFJS_CDN)
  mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
  window._pdfjs = mod
  return mod
}

export default function PDFEditor({ pdfFile }) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [pdfDoc, setPdfDoc] = useState(null)        // pdfjs doc
  const [pdfBytes, setPdfBytes] = useState(null)    // raw ArrayBuffer
  const [textItems, setTextItems] = useState([])    // [{str, x, y, w, h, fontSize, pageIndex}]
  const [viewport, setViewport] = useState(null)
  const [editing, setEditing] = useState(null)      // index of item being edited
  const [editValue, setEditValue] = useState('')
  const [edits, setEdits] = useState({})            // { index: newText }
  const [saving, setSaving] = useState(false)
  const [scale] = useState(1.5)
  const inputRef = useRef(null)

  // Load PDF and render page
  useEffect(() => {
    if (!pdfFile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const arrayBuffer = await pdfFile.arrayBuffer()
        setPdfBytes(arrayBuffer.slice(0))

        const pdfjsLib = await loadPdfJs()
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) })
        const doc = await loadingTask.promise
        if (cancelled) return
        setPdfDoc(doc)

        // Render page 1
        const page = await doc.getPage(1)
        const vp = page.getViewport({ scale })
        setViewport(vp)

        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = vp.width
        canvas.height = vp.height
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport: vp }).promise

        // Extract text items with positions
        const content = await page.getTextContent()
        const items = []
        content.items.forEach((item, idx) => {
          if (!item.str || !item.str.trim()) return
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
            pageIndex: 0,
          })
        })
        setTextItems(items)
      } catch (e) {
        console.error('PDF load error', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [pdfFile, scale])

  // Focus input when editing starts
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
    if (editValue.trim() === '') {
      // empty — revert
      const next = { ...edits }
      delete next[editing]
      setEdits(next)
    } else if (editValue !== original) {
      setEdits(prev => ({ ...prev, [editing]: editValue }))
    }
    setEditing(null)
  }

  function cancelEdit() {
    setEditing(null)
  }

  // Download edited PDF using pdf-lib
  async function downloadPDF() {
    if (!pdfBytes) return
    setSaving(true)
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')

      const pdfDocLib = await PDFDocument.load(pdfBytes.slice(0))
      const helvetica = await pdfDocLib.embedFont(StandardFonts.Helvetica)
      const pages = pdfDocLib.getPages()
      const page = pages[0]
      const { height } = page.getSize()

      // For each edit, draw a white box over original text then draw new text
      for (const item of textItems) {
        const newText = edits[item.index]
        if (!newText || newText === item.str) continue

        // Convert pdfjs coordinates back to pdf-lib coordinates
        // pdfjs y is from top, pdf-lib y is from bottom
        const pdfX = item.x / scale
        const pdfY = height - ((item.y + item.h) / scale)
        const pdfW = item.w / scale
        const pdfH = item.h / scale
        const fontSize = Math.max(item.fontSize, 6)

        // White rectangle to cover original text
        page.drawRectangle({
          x: pdfX - 1,
          y: pdfY - 1,
          width: pdfW + 10,
          height: pdfH + 2,
          color: rgb(1, 1, 1),
        })

        // Draw new text
        page.drawText(newText, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
          maxWidth: pdfW + 50,
        })
      }

      const editedBytes = await pdfDocLib.save()
      const blob = new Blob([editedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited_${pdfFile.name}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF save error', e)
      alert('Failed to save PDF: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const editCount = Object.keys(edits).length

  if (loading) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3">
        <Loader2 size={24} className="text-accent animate-spin" />
        <p className="text-sm text-ink-muted">Loading your PDF for editing…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MousePointer size={14} className="text-accent" />
          <p className="text-xs text-ink-muted">
            Click any text in the PDF to edit it
          </p>
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
            {saving
              ? <Loader2 size={13} className="animate-spin" />
              : <Download size={13} />
            }
            {saving ? 'Saving…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* PDF Canvas + Overlay */}
      <div className="card overflow-auto">
        <div
          className="relative inline-block"
          style={{ minWidth: viewport?.width ?? 600 }}
        >
          {/* Rendered PDF */}
          <canvas ref={canvasRef} className="block" />

          {/* Clickable text overlays */}
          <div
            ref={overlayRef}
            className="absolute inset-0"
            style={{ pointerEvents: 'none' }}
          >
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
                    boxSizing: 'border-box',
                  }}
                  onClick={() => !isActive && startEdit(item)}
                >
                  {isActive ? (
                    <div className="flex items-center gap-1" style={{ position: 'absolute', top: -2, left: -2, zIndex: 50 }}>
                      <input
                        ref={inputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        style={{
                          fontSize: item.fontSize * scale * 0.75,
                          padding: '1px 4px',
                          border: '2px solid #6366f1',
                          borderRadius: 4,
                          outline: 'none',
                          background: 'white',
                          minWidth: Math.max(item.w, 60),
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); commitEdit() }}
                        className="w-5 h-5 bg-green-500 rounded flex items-center justify-center"
                      >
                        <Check size={10} className="text-white" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); cancelEdit() }}
                        className="w-5 h-5 bg-red-400 rounded flex items-center justify-center"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 2,
                        backgroundColor: isEdited ? 'rgba(99,102,241,0.12)' : 'transparent',
                        border: isEdited ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => {
                        if (!isEdited) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)'
                        e.currentTarget.style.border = '1px solid rgba(99,102,241,0.4)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = isEdited ? 'rgba(99,102,241,0.12)' : 'transparent'
                        e.currentTarget.style.border = isEdited ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent'
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-muted text-center">
        Edited text uses Helvetica font. Original layout and structure is fully preserved.
      </p>
    </div>
  )
}