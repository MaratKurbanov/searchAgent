import { useState } from 'react'
import './SearchResults.css'

function parseChunk(chunk) {
  const text = chunk.text || ''
  const titleMatch = text.match(/^TITLE:\s*(.+?)(?:\s+(?:SCRIPTURE|TOPICS|SERIES|URL):)/)
  const urlMatch = text.match(/URL:\s*(https?:\/\/[^\s]+)/)
  const sepIdx = text.search(/={5,}/)
  const body = sepIdx > -1 ? text.slice(sepIdx).replace(/^=+\s*/, '').trim() : text
  const title =
    titleMatch?.[1]?.trim() ||
    chunk.item?.metadata?.title ||
    chunk.item?.key?.replace(/__chunk_\d+\.txt$/, '').replace(/-/g, ' ')
  const url = urlMatch?.[1] || chunk.item?.metadata?.url || null
  return { title, url, body, timestamp: chunk.item?.timestamp ?? null }
}

function formatDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function highlight(text, query) {
  if (!query || !text) return text
  const words = query.trim().split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return text
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  // split() with a capturing group puts matches at odd indices
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="sr-highlight">{part}</mark> : part
  )
}

export default function SearchResults({ apiUrl }) {
  const [query, setQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [total, setTotal] = useState(null)
  const [highlightOn, setHighlightOn] = useState(true)

  async function doSearch(q) {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    setTotal(null)
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-ai-search-source': 'snippet-search',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q }],
          stream: false,
          max_results: 10,
          ai_search_options: {},
        }),
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      if (data.success && data.result) {
        setResults(data.result.chunks.map(parseChunk))
        setTotal(data.result.chunks.length)
        setSearchedQuery(q)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    doSearch(query)
  }

  return (
    <div className="sr-root">
      <form className="sr-form" onSubmit={handleSubmit}>
        <div className="sr-input-wrap">
          <svg className="sr-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="sr-input"
            type="text"
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button className="sr-button" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="sr-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {total !== null && !error && (
        <div className="sr-count">{total} result{total !== 1 ? 's' : ''}</div>
      )}

      {results.length > 0 && (
        <div className="sr-list">
          {results.map((r, i) => (
            <button key={i} className="sr-card" onClick={() => setSelected(r)}>
              <div className="sr-card-title">{r.title || 'Untitled'}</div>
              {r.url && <div className="sr-card-url">{r.url}</div>}
              {r.timestamp && <div className="sr-card-date">{formatDate(r.timestamp)}</div>}
              <div className="sr-card-body">
                {highlight(
                  (r.body?.slice(0, 220) ?? '') + ((r.body?.length ?? 0) > 220 ? '…' : ''),
                  searchedQuery
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="sr-overlay" onClick={() => setSelected(null)}>
          <div className="sr-overlay-panel" onClick={e => e.stopPropagation()}>
            <div className="sr-overlay-header">
              <div>
                <h2 className="sr-overlay-title">{selected.title || 'Untitled'}</h2>
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
                {selected.timestamp && (
                  <div className="sr-overlay-date">{formatDate(selected.timestamp)}</div>
                )}
              </div>
              <div className="sr-overlay-actions">
                <button
                  className={`sr-highlight-toggle${highlightOn ? ' active' : ''}`}
                  onClick={() => setHighlightOn(h => !h)}
                  aria-label="Toggle highlight"
                  title={highlightOn ? 'Turn off highlighting' : 'Turn on highlighting'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Highlight
                </button>
                <button className="sr-overlay-close" onClick={() => setSelected(null)} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="sr-overlay-body">{highlightOn ? highlight(selected.body, searchedQuery) : selected.body}</div>
          </div>
        </div>
      )}
    </div>
  )
}
