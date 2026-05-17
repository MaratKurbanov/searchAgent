import { useState } from 'react'
import './BookmarksView.css'

export default function BookmarksView({ bookmarks, onToggleRead, onRemove, onClearRead }) {
  const [section, setSection] = useState('toread')

  const toRead = bookmarks.filter(b => !b.is_read)
  const read = bookmarks.filter(b => b.is_read)
  const current = section === 'toread' ? toRead : read

  function formatDate(unixTs) {
    if (!unixTs) return null
    return new Date(unixTs * 1000).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  return (
    <div className="bv-root">
      <div className="bv-header">
        <div className="bv-tabs">
          <button
            className={`bv-tab${section === 'toread' ? ' active' : ''}`}
            onClick={() => setSection('toread')}
          >
            To Read <span className="bv-count">{toRead.length}</span>
          </button>
          <button
            className={`bv-tab${section === 'read' ? ' active' : ''}`}
            onClick={() => setSection('read')}
          >
            Read <span className="bv-count">{read.length}</span>
          </button>
        </div>
        {section === 'read' && read.length > 0 && (
          <button className="bv-clear-btn" onClick={onClearRead}>
            Clear read list
          </button>
        )}
      </div>

      <div className="bv-list">
        {current.length === 0 ? (
          <div className="bv-empty">
            {section === 'toread'
              ? 'No sermons queued. Add bookmarks from the Read or Search tabs.'
              : 'No sermons marked as read yet.'}
          </div>
        ) : (
          current.map(b => (
            <div key={b.id} className={`bv-item${b.is_read ? ' bv-item--read' : ''}`}>
              <button
                className={`bv-check${b.is_read ? ' bv-check--done' : ''}`}
                onClick={() => onToggleRead(b.id)}
                title={b.is_read ? 'Mark as unread' : 'Mark as read'}
              >
                {b.is_read ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
              </button>

              <div className="bv-item-content">
                <span className="bv-title">{b.sermon_title}</span>
                <div className="bv-meta">
                  {b.sermon_url && (
                    <a
                      href={b.sermon_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bv-url"
                    >
                      {b.sermon_url}
                    </a>
                  )}
                  {!!b.is_read && !!b.read_at && (
                    <span className="bv-read-date">Read {formatDate(b.read_at)}</span>
                  )}
                </div>
              </div>

              <button
                className="bv-remove"
                onClick={() => onRemove(b.id)}
                title="Remove bookmark"
                aria-label="Remove bookmark"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
