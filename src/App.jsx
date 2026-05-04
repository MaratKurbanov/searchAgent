import { useState } from 'react'
import '@cloudflare/ai-search-snippet'
import Settings from './Settings'
import ChatPageWrapper from './ChatPageWrapper'
import './App.css'

const API_URL = window.API_URL || import.meta.env.VITE_API_URL

export default function App() {
  const [matchThreshold, setMatchThreshold] = useState(0.3)
  const [maxResults, setMaxResults] = useState(10)
  const [contextExpansion, setContextExpansion] = useState(0)
  const [rewriteQuery, setRewriteQuery] = useState(true)
  const [reRankResults, setReRankResults] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app-container">
      {/* Settings Panel */}
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

      {/* Main Content */}
      <main className="main-content">
        {/* Toggle Settings Button */}
        <button
          className="settings-toggle"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title={settingsOpen ? 'Hide settings' : 'Show settings'}
        >
          {settingsOpen ? (
            // Icon for when settings are open (arrow left to close)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          ) : (
            // Icon for when settings are closed (gears icon)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.12-2.12l4.24-4.24M19.78 19.78l-4.24-4.24m-2.12-2.12l-4.24-4.24M19.78 4.22l-4.24 4.24m-2.12 2.12l-4.24 4.24"></path>
            </svg>
          )}
        </button>

        <div className="chat-wrapper">
          <ChatPageWrapper
            apiUrl={API_URL}
            matchThreshold={matchThreshold}
            maxResults={maxResults}
            contextExpansion={contextExpansion}
            rewriteQuery={rewriteQuery}
            reRankResults={reRankResults}
          />
        </div>
      </main>
    </div>
  )
}
