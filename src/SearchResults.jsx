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
  const sd = chunk.scoring_details ?? null
  const file = chunk.item?.key
    ? chunk.item.key.replace(/__chunk_\d+\.txt$/, '').replace(/\.txt$/, '') + '.txt'
    : null
  return { title, url, body, file, timestamp: chunk.item?.timestamp ?? null, score: chunk.score ?? null, scoringDetails: sd }
}

function formatScore(r) {
  if (!r.score && !r.scoringDetails) return null
  const parts = []
  if (r.score != null) parts.push(r.score.toFixed(3))
  const sd = r.scoringDetails
  if (sd) {
    if (sd.vector_score != null) parts.push(`v:${sd.vector_score.toFixed(3)}`)
    if (sd.keyword_score != null) parts.push(`k:${sd.keyword_score.toFixed(1)}`)
    if (sd.fusion_method) parts.push(sd.fusion_method)
  }
  return parts.join(' · ')
}

function highlight(text, query, exact = false) {
  if (!query || !text) return text
  let re
  if (exact) {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(`\\b(${escaped})\\b`, 'gi')
  } else {
    const words = query.trim().split(/\s+/).filter(w => w.length > 1)
    if (words.length === 0) return text
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  }
  const parts = text.split(re)
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="sr-highlight">{part}</mark> : part
  )
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function SearchResults({ apiUrl, user, bookmarkMap, onBookmark }) {
  const [query, setQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [total, setTotal] = useState(null)
  const [highlightOn, setHighlightOn] = useState(true)
  const [exactMatch, setExactMatch] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  async function doSearch(q) {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    setTotal(null)
    try {
      const searchUrl = `${apiUrl.replace(/\/$/, '')}/search`
      const body = { messages: [{ role: 'user', content: q }], stream: false, max_results: 10, ai_search_options: {} }
      console.log('[Search → AI Search] url:', searchUrl, '| body:', JSON.stringify(body))
      const res = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-ai-search-source': 'snippet-search' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      console.log('[Search ← AI Search] response:', JSON.stringify(data))
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

      {error && <div className="sr-error"><strong>Error:</strong> {error}</div>}

      {total !== null && !error && (
        <div className="sr-count">{total} result{total !== 1 ? 's' : ''}</div>
      )}

      {results.length > 0 && (
        <div className="sr-list">
          {results.map((r, i) => {
            const bookmarked = r.file && bookmarkMap?.has(r.file)
            return (
              <div
                key={i}
                className="sr-card"
                onClick={() => setSelected(r)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelected(r)}
              >
                <div className="sr-card-title-row">
                  <span className="sr-card-title">{r.title || 'Untitled'}</span>
                  <div className="sr-card-right">
                    {formatScore(r) && <span className="sr-score-badge">{formatScore(r)}</span>}
                    {user && r.file && (
                      <button
                        className={`sr-bookmark-btn${bookmarked ? ' active' : ''}`}
                        onClick={e => { e.stopPropagation(); onBookmark?.(r.file, r.title || 'Untitled', r.url) }}
                        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark sermon'}
                        title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                      >
                        <BookmarkIcon filled={bookmarked} />
                      </button>
                    )}
                  </div>
                </div>
                {r.url && <div className="sr-card-url">{r.url}</div>}
                <div className="sr-card-body">
                  {highlight(
                    (r.body?.slice(0, 220) ?? '') + ((r.body?.length ?? 0) > 220 ? '…' : ''),
                    searchedQuery, exactMatch
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <div className={`sr-overlay${fullscreen ? ' sr-overlay--fullscreen' : ''}`} onClick={() => { setSelected(null); setFullscreen(false) }}>
          <div className={`sr-overlay-panel${fullscreen ? ' fullscreen' : ''}`} onClick={e => e.stopPropagation()}>
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
                    {/^https:\/\/gospelinlife\.com\/sermon\//.test(selected.url) && (
                      <span className="sr-overlay-audio-icon" title="Audio sermon" aria-label="Audio sermon">🔊 </span>
                    )}
                    {selected.url}
                  </a>
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
                <button
                  className={`sr-highlight-toggle${exactMatch ? ' active' : ''}`}
                  onClick={() => setExactMatch(e => !e)}
                  disabled={!highlightOn}
                  aria-label="Toggle exact match"
                  title={exactMatch ? 'Switch to word highlighting' : 'Highlight exact phrase only'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 21l1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
                  </svg>
                  Exact
                </button>
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
                  <button className="sr-overlay-close" onClick={() => { setSelected(null); setFullscreen(false) }} aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="sr-overlay-body">{highlightOn ? highlight(selected.body, searchedQuery, exactMatch) : selected.body}</div>
          </div>
        </div>
      )}
    </div>
  )
}
