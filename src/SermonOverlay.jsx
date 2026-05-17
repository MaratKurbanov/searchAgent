import { useState, useEffect } from 'react'
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

export default function SermonOverlay({ sermon, user, bookmarkMap = new Map(), onBookmark, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [fontSize, setFontSize] = useState(15)

  const FONT_MIN = 10
  const FONT_MAX = 75
  const FONT_STEP = 5

  useEffect(() => {
    setContent('')
    setLoading(true)
    fetch(`/assets/full-sermons/${sermon.file}`)
      .then(r => r.text())
      .then(text => setContent(parseBody(text)))
      .finally(() => setLoading(false))
  }, [sermon.file])

  const bookmarked = bookmarkMap.has(sermon.file)

  return (
    <div className={`sr-overlay${fullscreen ? ' sr-overlay--fullscreen' : ''}`} onClick={onClose}>
      <div className={`sr-overlay-panel sl-panel${fullscreen ? ' fullscreen' : ''}`} onClick={e => e.stopPropagation()}>
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
    </div>
  )
}
