import { useState, useEffect, useMemo } from 'react'
import './SermonList.css'

function parseBody(text) {
  const sepIdx = text.search(/={5,}/)
  return sepIdx > -1 ? text.slice(sepIdx).replace(/^=+\s*/, '').trim() : text
}

export default function SermonList() {
  const [sermons, setSermons] = useState([])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)  // { file, title, url }
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/assets/sermons-manifest.json')
      .then(r => r.json())
      .then(setSermons)
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    if (!filter.trim()) return sermons
    const q = filter.toLowerCase()
    return sermons.filter(s => s.title.toLowerCase().includes(q))
  }, [sermons, filter])

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
  }

  return (
    <div className="sl-root">
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

      <div className="sl-count">{filtered.length} of {sermons.length} sermons</div>

      <div className="sl-list">
        {filtered.map(s => (
          <button key={s.file} className="sl-card" onClick={() => openSermon(s)}>
            <span className="sl-card-title">{s.title}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="sr-overlay" onClick={close}>
          <div className="sr-overlay-panel sl-panel" onClick={e => e.stopPropagation()}>
            <div className="sr-overlay-header">
              <div className="sl-overlay-meta">
                <h2 className="sr-overlay-title">{selected.title}</h2>
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
                <button className="sr-overlay-close" onClick={close} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="sr-overlay-body sl-body">
              {loading ? <span className="sl-loading">Loading…</span> : content}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
