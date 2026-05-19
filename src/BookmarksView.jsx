import { useState, useEffect } from 'react'
import SermonOverlay from './SermonOverlay'
import { NoteIcon } from './NoteEditor'
import './BookmarksView.css'

const COLORS = [
  { key: 'red', label: 'Red' },
  { key: 'orange', label: 'Orange' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'blue', label: 'Blue' },
]

export default function BookmarksView({
  bookmarks, onToggleRead, onRemove, onClearRead,
  user, bookmarkMap, onBookmark,
  noteMap = new Map(), onSaveNote, onDeleteNote, onSaveColor,
}) {
  const [section, setSection] = useState('toread')
  const [overlaySermon, setOverlaySermon] = useState(null)
  const [pickerOpenId, setPickerOpenId] = useState(null)

  useEffect(() => {
    if (!pickerOpenId) return
    function handleClick(e) {
      if (!e.target.closest('.bv-color-picker')) setPickerOpenId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpenId])

  const toRead = bookmarks.filter(b => !b.is_read)
  const read = bookmarks.filter(b => b.is_read)
  const current = section === 'toread' ? toRead : read

  function formatDate(unixTs) {
    if (!unixTs) return null
    return new Date(unixTs * 1000).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  function openSermon(b) {
    if (b.sermon_file) {
      setOverlaySermon({ file: b.sermon_file, title: b.sermon_title, url: b.sermon_url })
    }
  }

  function handleColorSelect(b, colorKey) {
    setPickerOpenId(null)
    onSaveColor?.(b.sermon_file, b.sermon_title, colorKey)
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
          current.map(b => {
            const note = noteMap.get(b.sermon_file)
            const hasNote = note?.has_content === 1
            const noteColor = note?.color || null
            const isPickerOpen = pickerOpenId === b.id
            return (
              <div
                key={b.id}
                className={`bv-item${b.is_read ? ' bv-item--read' : ''}${noteColor ? ` bv-item--${noteColor}` : ''}`}
              >
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

                <div className="bv-item-content bv-item-content--clickable" onClick={() => openSermon(b)}>
                  <span className="bv-title">{b.sermon_title}</span>
                  {!!b.is_read && !!b.read_at && (
                    <div className="bv-meta">
                      <span className="bv-read-date">Read {formatDate(b.read_at)}</span>
                    </div>
                  )}
                </div>

                <button
                  className={`bv-note-btn${hasNote ? ' active' : ''}`}
                  onClick={() => openSermon(b)}
                  title={hasNote ? 'View note' : 'No note yet'}
                  aria-label={hasNote ? 'Has note' : 'No note'}
                >
                  <NoteIcon hasNote={hasNote} />
                </button>

                <div className="bv-color-picker">
                  <button
                    className={`bv-color-trigger${noteColor ? ` bv-color-trigger--${noteColor}` : ''}`}
                    onClick={e => { e.stopPropagation(); setPickerOpenId(isPickerOpen ? null : b.id) }}
                    title="Set color"
                    aria-label="Set item color"
                  />
                  {isPickerOpen && (
                    <div className="bv-color-swatches">
                      {COLORS.map(c => (
                        <button
                          key={c.key}
                          className={`bv-swatch bv-swatch--${c.key}${noteColor === c.key ? ' active' : ''}`}
                          onClick={e => { e.stopPropagation(); handleColorSelect(b, noteColor === c.key ? null : c.key) }}
                          title={c.label}
                        />
                      ))}
                      {noteColor && (
                        <button
                          className="bv-swatch-none"
                          onClick={e => { e.stopPropagation(); handleColorSelect(b, null) }}
                          title="Clear color"
                        >✕</button>
                      )}
                    </div>
                  )}
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
            )
          })
        )}
      </div>

      {overlaySermon && (
        <SermonOverlay
          sermon={overlaySermon}
          user={user}
          bookmarkMap={bookmarkMap}
          onBookmark={onBookmark}
          onClose={() => setOverlaySermon(null)}
          noteMap={noteMap}
          onSaveNote={onSaveNote}
          onDeleteNote={onDeleteNote}
        />
      )}
    </div>
  )
}
