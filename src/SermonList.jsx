import { useState, useEffect, useMemo, useRef } from 'react'
import SermonOverlay, { BookmarkIcon } from './SermonOverlay'
import './SermonList.css'

export default function SermonList({ user, bookmarkMap = new Map(), onBookmark }) {
  const [sermons, setSermons] = useState([])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)

  // Sort & filter state
  const [sortBy, setSortBy] = useState('default')        // 'default' | 'bookmarked'
  const [selectedTopics, setSelectedTopics] = useState(new Set())
  const [topicPanelOpen, setTopicPanelOpen] = useState(false)
  const [topicSearch, setTopicSearch] = useState('')
  const topicPanelRef = useRef(null)

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
        setTopicSearch('')
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
          onChange={e => setFilter(e.target.value.trimStart())}
          onBlur={e => setFilter(e.target.value.trim())}
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
              <div className="sl-topic-search">
                <input
                  className="sl-topic-search-input"
                  type="text"
                  placeholder="Search topics…"
                  value={topicSearch}
                  onChange={e => setTopicSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="sl-topic-grid">
                {allTopics
                  .filter(t => t.toLowerCase().includes(topicSearch.toLowerCase()))
                  .map(topic => (
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
              onClick={() => setSelected(s)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setSelected(s)}
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
        <SermonOverlay
          sermon={selected}
          user={user}
          bookmarkMap={bookmarkMap}
          onBookmark={onBookmark}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
