import { useState, useEffect, useMemo } from 'react'
import '@cloudflare/ai-search-snippet'
import ChatPageWrapper from './ChatPageWrapper'
import SearchBarWrapper from './SearchBarWrapper'
import SermonList from './SermonList'
import BookmarksView from './BookmarksView'
import AdminView from './AdminView'
import './App.css'

const API_URL = window.API_URL || import.meta.env.VITE_API_URL
const SITE_NAME = window.SITE_NAME || import.meta.env.VITE_SITE_NAME || ''
const SIGNED_IN_KEY = `bm_signed_in_${location.hostname}`
const IS_LOCALHOST = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
const ADMIN_EMAIL = 'maratkurbanov@gmail.com'

export default function App() {
  const [matchThreshold, setMatchThreshold] = useState(0.3)
  const [maxResults, setMaxResults] = useState(10)
  const [contextExpansion, setContextExpansion] = useState(0)
  const [rewriteQuery, setRewriteQuery] = useState(true)
  const [reRankResults, setReRankResults] = useState(false)
  const [activeTab, setActiveTab] = useState('search')

  const [user, setUser] = useState(null)
  const [userLoading, setUserLoading] = useState(true)
  const [bookmarks, setBookmarks] = useState([])
  const [notes, setNotes] = useState([])

  const bookmarkMap = useMemo(
    () => new Map(bookmarks.map(b => [b.sermon_file, b])),
    [bookmarks]
  )

  const noteMap = useMemo(
    () => new Map(notes.map(n => [n.sermon_slug, n])),
    [notes]
  )

  useEffect(() => {
    signIn()
  }, [])

  async function signIn() {
    setUserLoading(true)
    try {
      const res = await fetch('/api/me')
      if (!res.ok) throw new Error('Auth failed')
      const userData = await res.json()
      setUser(userData)
      localStorage.setItem(SIGNED_IN_KEY, '1')
      const bmRes = await fetch('/api/bookmarks')
      if (bmRes.ok) setBookmarks(await bmRes.json())
      const noteRes = await fetch('/api/notes')
      if (noteRes.ok) setNotes(await noteRes.json())
    } catch {
      localStorage.removeItem(SIGNED_IN_KEY)
    } finally {
      setUserLoading(false)
    }
  }

  function signOut() {
    localStorage.removeItem(SIGNED_IN_KEY)
    setUser(null)
    setBookmarks([])
    if (activeTab === 'bookmarks' || activeTab === 'admin') setActiveTab('search')
  }

  async function toggleBookmark(sermon_file, sermon_title, sermon_url) {
    const existing = bookmarkMap.get(sermon_file)
    if (existing) {
      await fetch(`/api/bookmarks/${existing.id}`, { method: 'DELETE' })
      setBookmarks(prev => prev.filter(b => b.id !== existing.id))
    } else {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sermon_file, sermon_title, sermon_url }),
      })
      if (res.ok) {
        const bm = await res.json()
        setBookmarks(prev => [bm, ...prev])
      }
    }
  }

  async function toggleRead(bookmarkId) {
    const res = await fetch(`/api/bookmarks/${bookmarkId}`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await res.json()
      setBookmarks(prev => prev.map(b => b.id === bookmarkId ? { ...b, ...updated } : b))
    }
  }

  async function clearRead() {
    await fetch('/api/bookmarks/clear-read', { method: 'POST' })
    setBookmarks(prev => prev.filter(b => !b.is_read))
  }

  async function saveNote(sermon_slug, sermon_title, content) {
    const res = await fetch(`/api/notes/${encodeURIComponent(sermon_slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, sermon_title }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes(prev => {
        const exists = prev.find(n => n.sermon_slug === sermon_slug)
        return exists
          ? prev.map(n => n.sermon_slug === sermon_slug ? { ...n, ...note } : n)
          : [note, ...prev]
      })
    }
  }

  async function deleteNote(sermon_slug) {
    await fetch(`/api/notes/${encodeURIComponent(sermon_slug)}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.sermon_slug !== sermon_slug))
  }

  return (
    <div className="app-container">
      <main className="main-content">
        {SITE_NAME && <h1 className="site-name">{SITE_NAME}</h1>}

        <div className="tab-bar">
          <button
            className={`tab-button${activeTab === 'search' ? ' active' : ''}`}
            onClick={() => setActiveTab('search')}
          >Search</button>
          <button
            className={`tab-button${activeTab === 'chat' ? ' active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >Chat</button>
          <button
            className={`tab-button${activeTab === 'read' ? ' active' : ''}`}
            onClick={() => setActiveTab('read')}
          >Sermons</button>
          <button
            className={`tab-button${activeTab === 'bookmarks' ? ' active' : ''}`}
            onClick={() => setActiveTab('bookmarks')}
          >
            Bookmarks
          </button>
          {user?.role === 'admin' && (user?.email === ADMIN_EMAIL || IS_LOCALHOST) && (
            <button
              className={`tab-button tab-button--icon${activeTab === 'admin' ? ' active' : ''}`}
              onClick={() => setActiveTab('admin')}
              title="Admin panel"
              aria-label="Admin panel"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </button>
          )}
        </div>

        <div className="search-bar-wrapper" hidden={activeTab !== 'search'}>
          <SearchBarWrapper
            apiUrl={API_URL}
            user={user}
            bookmarkMap={bookmarkMap}
            onBookmark={toggleBookmark}
          />
        </div>

        <div className="chat-wrapper" hidden={activeTab !== 'chat'}>
          <ChatPageWrapper
            apiUrl={API_URL}
            matchThreshold={matchThreshold}
            maxResults={maxResults}
            contextExpansion={contextExpansion}
            rewriteQuery={rewriteQuery}
            reRankResults={reRankResults}
          />
        </div>

        <div className="read-wrapper" hidden={activeTab !== 'read'}>
          <SermonList
            user={user}
            bookmarkMap={bookmarkMap}
            onBookmark={toggleBookmark}
            noteMap={noteMap}
            onSaveNote={saveNote}
            onDeleteNote={deleteNote}
          />
        </div>

        <div className="bookmarks-wrapper" hidden={activeTab !== 'bookmarks'}>
          <BookmarksView
            bookmarks={bookmarks}
            onToggleRead={toggleRead}
            onRemove={id => {
              fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
              setBookmarks(prev => prev.filter(b => b.id !== id))
            }}
            onClearRead={clearRead}
            user={user}
            bookmarkMap={bookmarkMap}
            onBookmark={toggleBookmark}
            noteMap={noteMap}
            onSaveNote={saveNote}
            onDeleteNote={deleteNote}
          />
        </div>

        {user?.role === 'admin' && (user?.email === ADMIN_EMAIL || IS_LOCALHOST) && (
          <div className="admin-wrapper" hidden={activeTab !== 'admin'}>
            <AdminView
              matchThreshold={matchThreshold} setMatchThreshold={setMatchThreshold}
              maxResults={maxResults} setMaxResults={setMaxResults}
              contextExpansion={contextExpansion} setContextExpansion={setContextExpansion}
              rewriteQuery={rewriteQuery} setRewriteQuery={setRewriteQuery}
              reRankResults={reRankResults} setReRankResults={setReRankResults}
            />
          </div>
        )}
      </main>
    </div>
  )
}
