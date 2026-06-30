import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Loader2, Info, RotateCcw } from 'lucide-react'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const PDFJS_VERSION = '3.4.120'
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`
const SCALE = 1.6

// Google Fonts TTF — picked to match common resume fonts closely
const FONT_MAP = {
  helvetica: 'https://fonts.gstatic.com/s/arial/v1/arial.ttf', // fallback below if unavailable
  arial: 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/arimo/Arimo[wght].ttf',
  times: 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/tinos/Tinos-Regular.ttf',
  calibri: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/carlito/Carlito-Regular.ttf',
  courier: 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/cousine/Cousine-Regular.ttf',
  default: 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/arimo/static/Arimo-Regular.ttf',
}

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

async function getPdfJs() {
  if (window.__pdfjsReady) return window.pdfjsLib
  await loadScript(`${PDFJS_CDN}/pdf.min.js`, 'pdfjs-lib')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`
  window.__pdfjsReady = true
  return window.pdfjsLib
}

// Guess which web font matches the PDF's embedded font name
function detectFontFamily(fontName = '') {
  const n = fontName.toLowerCase()
  if (n.includes('times') || n.includes('georgia') || n.includes('serif')) return 'Tinos, Times New Roman, serif'
  if (n.includes('courier') || n.includes('mono')) return 'Cousine, Courier New, monospace'
  if (n.includes('calibri')) return 'Carlito, Calibri, sans-serif'
  if (n.includes('arial') || n.includes('helvetica')) return 'Arimo, Arial, sans-serif'
  return 'Arimo, Arial, sans-serif'
}

function detectFontKey(fontName = '') {
  const n = fontName.toLowerCase()
  if (n.includes('times') || n.includes('georgia') || n.includes('serif')) return 'times'
  if (n.includes('courier') || n.includes('mono')) return 'courier'
  if (n.includes('calibri')) return 'calibri'
  return 'default'
}

export default function PDFEditor({ pdfFile }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pdfBytes, setPdfBytes] = useState(null)
  const [textItems, setTextItems] = useState([])
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const spanRefs = useRef({})

  const renderPdf = useCallback(async (buf) => {
    setStatus('loading')
    setEdits({})
    spanRefs.current = {}
    try {
      const pdfjs = await getPdfJs()
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
      const page = await doc.getPage(1)
      const vp = page.getViewport({ scale: SCALE })

      const container = containerRef.current
      if (!container) throw new Error('Container not ready')
      const oldCanvas = container.querySelector('canvas')
      if (oldCanvas) container.removeChild(oldCanvas)

      const canvas = document.createElement('canvas')
      canvas.width = vp.width
      canvas.height = vp.height
      canvas.style.position = 'absolute'
      canvas.style.top = '0'
      canvas.style.left = '0'
      canvas.style.pointerEvents = 'none'
      container.appendChild(canvas)
      setCanvasSize({ w: vp.width, h: vp.height })

      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise

      // Get font info per fontName used in this page
      const { items, styles } = await page.getTextContent()
      const parsed = []
      items.forEach((item, i) => {
        if (!item.str || !item.str.trim()) return
        const t = pdfjs.Util.transform(vp.transform, item.transform)
        const x = t[4]
        const y = t[5]
        const fh = Math.abs(item.transform[3]) * SCALE
        const fw = item.width * SCALE
        const styleInfo = styles[item.fontName] || {}
        const family = detectFontFamily(styleInfo.fontFamily || item.fontName)
        const fontKey = detectFontKey(styleInfo.fontFamily || item.fontName)

        parsed.push({
          idx: i,
          str: item.str,
          x, y: y - fh,
          w: Math.max(fw, 16),
          h: Math.max(fh, 8),
          fs: Math.abs(item.transform[3]),
          family,
          fontKey,
        })
      })
      setTextItems(parsed)
      setStatus('ready')
    } catch (e) {
      console.error('PDF render error:', e)
      setErrorMsg(e.message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!pdfFile) return
    let dead = false
    pdfFile.arrayBuffer().then(buf => {
      if (dead) return
      setPdfBytes(buf.slice(0))
      renderPdf(buf)
    }).catch(e => {
      if (!dead) { setErrorMsg(e.message); setStatus('error') }
    })
    return () => { dead = true }
  }, [pdfFile])

  function handleInput(item, e) {
    const newText = e.currentTarget.textContent
    if (newText === item.str) {
      setEdits(prev => {
        const n = { ...prev }; delete n[item.idx]; return n
      })
    } else {
      setEdits(prev => ({ ...prev, [item.idx]: newText }))
    }
  }

  function resetAll() {
    setEdits({})
    Object.entries(spanRefs.current).forEach(([idx, el]) => {
      const item = textItems.find(t => t.idx === Number(idx))
      if (el && item) el.textContent = item.str
    })
  }

  // Cache loaded font bytes so we don't refetch per edit
  const fontBytesCache = useRef({})
  async function getFontBytes(key) {
    if (fontBytesCache.current[key]) return fontBytesCache.current[key]
    const url = FONT_MAP[key] || FONT_MAP.default
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('font fetch failed')
      const buf = await res.arrayBuffer()
      fontBytesCache.current[key] = buf
      return buf
    } catch (e) {
      // fallback to default font
      if (key !== 'default') return getFontBytes('default')
      throw e
    }
  }

  async function download() {
    if (!pdfBytes) return
    setSaving(true)
    try {
      const doc = await PDFDocument.load(pdfBytes.slice(0))
      doc.registerFontkit(fontkit)

      // Preload needed fonts based on which keys are used in edited items
      const neededKeys = new Set(
        textItems.filter(t => edits[t.idx]).map(t => t.fontKey)
      )
      const embeddedFonts = {}
      for (const key of neededKeys) {
        try {
          const bytes = await getFontBytes(key)
          embeddedFonts[key] = await doc.embedFont(bytes, { subset: true })
        } catch {
          // skip — will fallback to default below
        }
      }
      // Ensure a default fallback font is embedded
      if (!embeddedFonts.default && neededKeys.size > 0) {
        try {
          const bytes = await getFontBytes('default')
          embeddedFonts.default = await doc.embedFont(bytes, { subset: true })
        } catch {}
      }

      const page = doc.getPages()[0]
      const { height: ph } = page.getSize()

      for (const item of textItems) {
        const txt = edits[item.idx]
        if (!txt || txt === item.str) continue

        const px = item.x / SCALE
        const py = ph - ((item.y + item.h) / SCALE)
        const fs = Math.max(item.fs, 6)
        const font = embeddedFonts[item.fontKey] || embeddedFonts.default

        // Cover original text
        page.drawRectangle({
          x: px - 1, y: py - 1,
          width: Math.max(item.w / SCALE, font ? font.widthOfTextAtSize(txt, fs) : item.w / SCALE) + 12,
          height: item.h / SCALE + 2,
          color: rgb(1, 1, 1),
        })

        // Draw new text with matched font
        if (font) {
          page.drawText(txt, { x: px, y: py, size: fs, font, color: rgb(0, 0, 0) })
        } else {
          page.drawText(txt, { x: px, y: py, size: fs, color: rgb(0, 0, 0) })
        }
      }

      const bytes = await doc.save()
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `edited_${pdfFile.name}` })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download error:', e)
      alert('Failed to save PDF: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const editCount = Object.keys(edits).length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Click directly on any text and start typing — edits show instantly.</span>
        </div>
        <div className="flex items-center gap-2">
          {editCount > 0 && (
            <>
              <span className="text-xs font-bold text-accent bg-accent-soft px-2.5 py-1 rounded-lg">
                {editCount} edit{editCount !== 1 ? 's' : ''}
              </span>
              <button onClick={resetAll}
                className="flex items-center gap-1 text-xs font-medium text-slate-mid hover:text-ink transition-colors">
                <RotateCcw size={12} /> Reset
              </button>
            </>
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
        <p className="text-xs text-slate-mid">Font is auto-matched to your resume's original typeface. Layout is fully preserved.</p>
      </div>

      {/* PDF area */}
      <div className="card overflow-auto p-0">
        {status === 'error' && (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-signal-red mb-1">Could not load PDF</p>
            <p className="text-xs text-ink-muted">{errorMsg}</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="p-10 flex flex-col items-center gap-3">
            <Loader2 size={22} className="text-accent animate-spin" />
            <p className="text-sm text-ink-muted">Rendering PDF…</p>
          </div>
        )}

        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: canvasSize.w || '100%',
            height: canvasSize.h || 0,
            display: status === 'ready' ? 'block' : 'none',
          }}
        >
          {status === 'ready' && textItems.map(item => {
            const isEdited = Boolean(edits[item.idx])
            return (
              <div
                key={item.idx}
                ref={el => { if (el) spanRefs.current[item.idx] = el }}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={e => handleInput(item, e)}
                style={{
                  position: 'absolute',
                  left: item.x,
                  top: item.y,
                  minWidth: item.w,
                  minHeight: item.h,
                  maxWidth: Math.max(item.w * 3, 300),
                  fontSize: item.fs * SCALE * 0.97,
                  lineHeight: `${item.h}px`,
                  fontFamily: item.family,
                  color: 'rgba(0,0,0,0)',  // invisible by default — canvas shows original text
                  caretColor: '#000',
                  whiteSpace: 'pre',
                  outline: 'none',
                  cursor: 'text',
                  padding: 0,
                  border: isEdited ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                  borderRadius: 2,
                  background: isEdited ? 'rgba(99,102,241,0.12)' : 'transparent',
                  zIndex: isEdited ? 20 : 10,
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onFocus={e => {
                  // Once focused, make text visible (covering canvas) so user can see what they type
                  e.currentTarget.style.color = '#000'
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)'
                  e.currentTarget.style.zIndex = 30
                }}
                onBlur={e => {
                  const stillEdited = e.currentTarget.textContent !== item.str
                  e.currentTarget.style.color = stillEdited ? '#000' : 'rgba(0,0,0,0)'
                  e.currentTarget.style.background = stillEdited ? 'rgba(99,102,241,0.12)' : 'transparent'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.zIndex = stillEdited ? 20 : 10
                }}
              >
                {item.str}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}