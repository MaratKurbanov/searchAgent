import { useState, useEffect, useMemo } from 'react'
import '@cloudflare/ai-search-snippet'
import Settings from './Settings'
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('search')

  const [user, setUser] = useState(null)
  const [userLoading, setUserLoading] = useState(true)
  const [bookmarks, setBookmarks] = useState([])

  const bookmarkMap = useMemo(
    () => new Map(bookmarks.map(b => [b.sermon_file, b])),
    [bookmarks]
  )

  useEffect(() => {
    if (localStorage.getItem(SIGNED_IN_KEY)) {
      signIn()
    } else {
      setUserLoading(false)
    }
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

  return (
    <div className="app-container">
      <Settings
        matchThreshold={matchThreshold}
        setMatchThreshold={setMatchThreshold}
        maxResults={maxResults}
        setMaxResults={setMaxResults}
        contextExpansion={contextExpansion}
        setContextExpansion={setContextExpansion}
        rewriteQuery={rewriteQuery}
        setRewriteQuery={setRewriteQuery}
        reRankResults={reRankResults}
        setReRankResults={setReRankResults}
        isOpen={settingsOpen}
      />

      <main className="main-content">
        {SITE_NAME && <h1 className="site-name">{SITE_NAME}</h1>}

        <button
          className="settings-toggle"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title={settingsOpen ? 'Hide settings' : 'Show settings'}
        >
          {settingsOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.12-2.12l4.24-4.24M19.78 19.78l-4.24-4.24m-2.12-2.12l-4.24-4.24M19.78 4.22l-4.24 4.24m-2.12 2.12l-4.24 4.24"></path>
            </svg>
          )}
        </button>

        {/* User area — top right */}
        <div className="user-area">
          {!userLoading && (
            !user ? (
              <button className="user-btn" onClick={signIn} title="Sign in to use bookmarks">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Sign In
              </button>
            ) : (
              <div className="user-signed-in">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="user-email-display" title={user.email}>
                  {user.email.split('@')[0]}
                </span>
                <button className="user-signout" onClick={signOut} title="Sign out">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )
          )}
        </div>

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
          {user && (
            <button
              className={`tab-button${activeTab === 'bookmarks' ? ' active' : ''}`}
              onClick={() => setActiveTab('bookmarks')}
            >
              Bookmarks
            </button>
          )}
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
          />
        </div>

        {user && (
          <div className="bookmarks-wrapper" hidden={activeTab !== 'bookmarks'}>
            <BookmarksView
              bookmarks={bookmarks}
              onToggleRead={toggleRead}
              onRemove={id => {
                fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
                setBookmarks(prev => prev.filter(b => b.id !== id))
              }}
              onClearRead={clearRead}
            />
          </div>
        )}

        {user?.role === 'admin' && (user?.email === ADMIN_EMAIL || IS_LOCALHOST) && (
          <div className="admin-wrapper" hidden={activeTab !== 'admin'}>
            <AdminView />
          </div>
        )}
      </main>
    </div>
  )
}
