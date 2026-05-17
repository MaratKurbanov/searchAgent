import { useState, useEffect, useMemo, useRef } from 'react'
import './SermonList.css'

function parseBody(text) {
  const sepIdx = text.search(/={5,}/)
  return sepIdx > -1 ? text.slice(sepIdx).replace(/^=+\s*/, '').trim() : text
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function SermonList({ user, bookmarkMap = new Map(), onBookmark }) {
  const [sermons, setSermons] = useState([])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [fontSize, setFontSize] = useState(15)

  // Sort & filter state
  const [sortBy, setSortBy] = useState('default')        // 'default' | 'bookmarked'
  const [selectedTopics, setSelectedTopics] = useState(new Set())
  const [topicPanelOpen, setTopicPanelOpen] = useState(false)
  const topicPanelRef = useRef(null)

  const FONT_MIN = 10
  const FONT_MAX = 75
  const FONT_STEP = 5

  useEffect(() => {
    fetch('/assets/sermons-manifest.json')
      .then(r => r.json())
      .then(setSermons)
      .catch(() => {})
  }, [])

  // Close topic panel on outside click
  useEffect(() => {
    if (!topicPanelOpen) return
    function handleClick(e) {
      if (topicPanelRef.current && !topicPanelRef.current.contains(e.target)) {
        setTopicPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [topicPanelOpen])

  // All topics that appear in at least one sermon
  const allTopics = useMemo(() => {
    const set = new Set()
    sermons.forEach(s => (s.topicList || []).forEach(t => set.add(t)))
    return [...set].sort()
  }, [sermons])

  function toggleTopic(topic) {
    setSelectedTopics(prev => {
      const next = new Set(prev)
      next.has(topic) ? next.delete(topic) : next.add(topic)
      return next
    })
  }

  function clearFilters() {
    setSelectedTopics(new Set())
    setSortBy('default')
    setFilter('')
  }

  const hasActiveFilters = filter.trim() || selectedTopics.size > 0 || sortBy !== 'default'

  const filtered = useMemo(() => {
    let items = sermons

    // Text filter
    if (filter.trim()) {
      const normalize = str => str.replace(/[''ʼ]/g, "'").toLowerCase()
      const q = normalize(filter)
      items = items.filter(s => normalize(s.title).includes(q))
    }

    // Topic filter (OR — show sermons that have any selected topic)
    if (selectedTopics.size > 0) {
      items = items.filter(s =>
        (s.topicList || []).some(t => selectedTopics.has(t))
      )
    }

    // Sort
    if (sortBy === 'bookmarked') {
      items = [...items].sort((a, b) => {
        const aHas = bookmarkMap.has(a.file) ? 1 : 0
        const bHas = bookmarkMap.has(b.file) ? 1 : 0
        return bHas - aHas
      })
    }

    return items
  }, [sermons, filter, selectedTopics, sortBy, bookmarkMap])

  async function openSermon(sermon) {
    setSelected(sermon)
    setContent('')
    setLoading(true)
    try {
      const r = await fetch(`/assets/full-sermons/${sermon.file}`)
      const text = await r.text()
      setContent(parseBody(text))
    } finally {
      setLoading(false)
    }
  }

  function close() {
    setSelected(null)
    setContent('')
    setFullscreen(false)
    setFontSize(15)
  }

  return (
    <div className="sl-root">
      {/* Search + controls row */}
      <div className="sl-search-wrap">
        <svg className="sl-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="sl-input"
          type="text"
          placeholder="Filter sermons…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        {filter && (
          <button className="sl-clear" onClick={() => setFilter('')} aria-label="Clear filter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Sort + topic filter controls */}
      <div className="sl-controls">
        <button
          className={`sl-ctrl-btn${sortBy === 'bookmarked' ? ' active' : ''}`}
          onClick={() => setSortBy(s => s === 'bookmarked' ? 'default' : 'bookmarked')}
          title={sortBy === 'bookmarked' ? 'Remove bookmark sort' : 'Sort bookmarked first'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill={sortBy === 'bookmarked' ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          Bookmarked first
        </button>

        <div className="sl-topics-wrap" ref={topicPanelRef}>
          <button
            className={`sl-ctrl-btn${topicPanelOpen || selectedTopics.size > 0 ? ' active' : ''}`}
            onClick={() => setTopicPanelOpen(o => !o)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            Topics{selectedTopics.size > 0 ? ` (${selectedTopics.size})` : ''}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: topicPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {topicPanelOpen && (
            <div className="sl-topic-panel">
              <div className="sl-topic-grid">
                {allTopics.map(topic => (
                  <button
                    key={topic}
                    className={`sl-topic-pill${selectedTopics.has(topic) ? ' active' : ''}`}
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button className="sl-ctrl-btn sl-clear-all" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>

      {/* Active topic chips */}
      {selectedTopics.size > 0 && (
        <div className="sl-active-topics">
          {[...selectedTopics].map(t => (
            <span key={t} className="sl-topic-chip">
              {t}
              <button onClick={() => toggleTopic(t)} aria-label={`Remove ${t} filter`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="sl-count">{filtered.length} of {sermons.length} sermons</div>

      <div className="sl-list">
        {filtered.map(s => {
          const bookmarked = bookmarkMap.has(s.file)
          return (
            <div
              key={s.file}
              className="sl-card"
              onClick={() => openSermon(s)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && openSermon(s)}
            >
              <div className="sl-card-main">
                <span className="sl-card-title">{s.title}</span>
                {s.scripture && <span className="sl-card-scripture">{s.scripture}</span>}
              </div>
              {user && (
                <button
                  className={`sl-bookmark-btn${bookmarked ? ' active' : ''}`}
                  onClick={e => { e.stopPropagation(); onBookmark?.(s.file, s.title, s.url) }}
                  aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark sermon'}
                  title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                >
                  <BookmarkIcon filled={bookmarked} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {selected && (
        <div className={`sr-overlay${fullscreen ? ' sr-overlay--fullscreen' : ''}`} onClick={close}>
          <div className={`sr-overlay-panel sl-panel${fullscreen ? ' fullscreen' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="sr-overlay-header">
              <div className="sl-overlay-meta">
                <h2 className="sr-overlay-title">{selected.title}</h2>
                {selected.scripture && <div className="sl-overlay-scripture">{selected.scripture}</div>}
                {selected.url && (
                  <a
                    className="sr-overlay-url"
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                  >
                    {selected.url}
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
                    className={`sl-bookmark-btn${bookmarkMap.has(selected.file) ? ' active' : ''}`}
                    onClick={() => onBookmark?.(selected.file, selected.title, selected.url)}
                    aria-label={bookmarkMap.has(selected.file) ? 'Remove bookmark' : 'Add bookmark'}
                    title={bookmarkMap.has(selected.file) ? 'Remove bookmark' : 'Add bookmark'}
                  >
                    <BookmarkIcon filled={bookmarkMap.has(selected.file)} />
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
                  <button className="sr-overlay-close" onClick={close} aria-label="Close">
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
      )}
    </div>
  )
}
