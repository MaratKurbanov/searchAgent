import { useState, useEffect, useRef } from 'react'
import NoteEditor, { NoteIcon } from './NoteEditor'
import './SermonList.css'

function parseBody(text) {
  const sepIdx = text.search(/={5,}/)
  return sepIdx > -1 ? text.slice(sepIdx).replace(/^=+\s*/, '').trim() : text
}

export function BookmarkIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function SermonOverlay({
  sermon, user, bookmarkMap = new Map(), onBookmark, onClose,
  noteMap = new Map(), onSaveNote, onDeleteNote,
}) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [fontSize, setFontSize] = useState(15)
  const [noteOpen, setNoteOpen] = useState(false)
  const [splitRatio, setSplitRatio] = useState(50)
  const panelRef = useRef(null)
  const dragStart = useRef(null)
  const [readerDark, setReaderDark] = useState(() => {
    try { return localStorage.getItem('readerDark') === '1' } catch { return false }
  })

  const FONT_MIN = 10
  const FONT_MAX = 75
  const FONT_STEP = 5

  useEffect(() => {
    setContent('')
    setLoading(true)
    fetch(`/assets/full-sermons/${sermon.file}`)
      .then(r => r.text())
      .then(text => setContent(parseBody(text)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sermon.file])

  const bookmarked = bookmarkMap.has(sermon.file)
  const hasNote = noteMap.has(sermon.file)

  function toggleDark() {
    setReaderDark(d => {
      const next = !d
      try { localStorage.setItem('readerDark', next ? '1' : '0') } catch {}
      return next
    })
  }

  function onDividerMouseDown(e) {
    e.preventDefault()
    const panelRect = panelRef.current.getBoundingClientRect()
    dragStart.current = { startX: e.clientX, startRatio: splitRatio, panelWidth: panelRect.width }

    function onMouseMove(ev) {
      const { startX, startRatio, panelWidth } = dragStart.current
      const deltaPercent = ((ev.clientX - startX) / panelWidth) * 100
      setSplitRatio(Math.max(30, Math.min(70, startRatio + deltaPercent)))
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      dragStart.current = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const panelClasses = [
    'sr-overlay-panel sl-panel',
    fullscreen ? 'fullscreen' : '',
    readerDark ? 'reader-dark' : '',
    noteOpen ? 'sr-overlay-panel--split' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={`sr-overlay${fullscreen ? ' sr-overlay--fullscreen' : ''}`} onClick={onClose}>
      <div className={panelClasses} ref={panelRef} onClick={e => e.stopPropagation()}>

        {/* Sermon column */}
        <div
          className="sr-sermon-half"
          style={noteOpen ? { flex: `0 0 ${splitRatio}%` } : undefined}
        >
          <div className="sr-overlay-header">
            <div className="sl-overlay-meta">
              <h2 className="sr-overlay-title">{sermon.title}</h2>
              {sermon.scripture && <div className="sl-overlay-scripture">{sermon.scripture}</div>}
              {sermon.url && (
                <a
                  className="sr-overlay-url"
                  href={sermon.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                >
                  {/^https:\/\/gospelinlife\.com\/sermon\//.test(sermon.url) && (
                    <span className="sr-overlay-audio-icon" title="Audio sermon" aria-label="Audio sermon">🔊 </span>
                  )}
                  {sermon.url}
                </a>
              )}
            </div>
            <div className="sr-overlay-actions">
              <div className="sl-font-controls">
                <button
                  className="sl-font-btn"
                  onClick={() => setFontSize(s => Math.max(FONT_MIN, s - FONT_STEP))}
                  disabled={fontSize <= FONT_MIN}
                  aria-label="Decrease font size"
                  title="Decrease font size"
                >A−</button>
                <span className="sl-font-size">{fontSize}px</span>
                <button
                  className="sl-font-btn"
                  onClick={() => setFontSize(s => Math.min(FONT_MAX, s + FONT_STEP))}
                  disabled={fontSize >= FONT_MAX}
                  aria-label="Increase font size"
                  title="Increase font size"
                >A+</button>
              </div>

              {/* Day / Night toggle */}
              <button
                className={`sr-overlay-close${readerDark ? ' active' : ''}`}
                onClick={toggleDark}
                aria-label={readerDark ? 'Switch to day mode' : 'Switch to night mode'}
                title={readerDark ? 'Day mode' : 'Night mode'}
              >
                {readerDark ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>

              {user && (
                <button
                  className={`sl-bookmark-btn sl-bookmark-btn--overlay${bookmarked ? ' active' : ''}`}
                  onClick={() => onBookmark?.(sermon.file, sermon.title, sermon.url)}
                  aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                  title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                >
                  <BookmarkIcon filled={bookmarked} />
                </button>
              )}

              {user && (
                <button
                  className={`sl-note-btn${hasNote || noteOpen ? ' active' : ''}`}
                  onClick={() => setNoteOpen(o => !o)}
                  aria-label={noteOpen ? 'Close notes' : 'Open notes'}
                  title={noteOpen ? 'Close notes' : hasNote ? 'Edit note' : 'Add note'}
                >
                  <NoteIcon hasNote={hasNote} />
                </button>
              )}

              <div className="sr-icon-group">
                <button
                  className="sr-overlay-close"
                  onClick={() => setFullscreen(f => !f)}
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                    </svg>
                  )}
                </button>
                <button className="sr-overlay-close" onClick={onClose} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="sr-overlay-body sl-body" style={{ fontSize: `${fontSize}px` }}>
            {loading ? <span className="sl-loading">Loading…</span> : content}
          </div>
        </div>

        {/* Draggable divider */}
        {noteOpen && <div className="sr-split-divider" onMouseDown={onDividerMouseDown} />}

        {/* Note editor */}
        {noteOpen && (
          <NoteEditor
            sermon={sermon}
            onSave={onSaveNote}
            onDelete={onDeleteNote}
            onClose={() => setNoteOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
