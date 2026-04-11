import { useState } from 'react'
import '@cloudflare/ai-search-snippet'
import Settings from './Settings'
import './App.css'

const API_URL = 'https://daf1d29e-1140-4bbf-8f0b-0d6a6d980b32.search.ai.cloudflare.com/'

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
            // Icon for when settings are open (close/hide)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          ) : (
            // Icon for when settings are closed (open/show)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          )}
        </button>

        <div className="chat-wrapper">
          {/* @ts-ignore */}
          <chat-page-snippet
            api-url={API_URL}
            theme="auto"
            data-match-threshold={matchThreshold}
            data-max-results={maxResults}
            data-context-expansion={contextExpansion}
            data-rewrite-query={rewriteQuery}
            data-re-rank-results={reRankResults}
          />
        </div>
      </main>
    </div>
  )
}
