import { useState, useEffect, useRef, useCallback } from 'react'
import './ChatView.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cv_conversations'
const SUMMARIZE_AFTER = 14   // total messages before triggering summary
const KEEP_RECENT    = 8     // messages kept verbatim after summarization

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadConvs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveConvs(convs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs)) } catch {}
}

function newConv() {
  return { id: crypto.randomUUID(), title: 'New Chat', messages: [], summary: null, createdAt: Date.now(), updatedAt: Date.now() }
}
function newMsg(role, content = '') {
  return { id: crypto.randomUUID(), role, content, timestamp: Date.now() }
}

// ─── Sidebar date grouping ────────────────────────────────────────────────────

function groupByDate(convs) {
  const now = new Date()
  const todayMs    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterMs   = todayMs - 86400000
  const groups     = {}
  ;[...convs]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach(c => {
      const label = c.updatedAt >= todayMs   ? 'Today'
                  : c.updatedAt >= yesterMs  ? 'Yesterday'
                  : new Date(c.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      ;(groups[label] = groups[label] || []).push(c)
    })
  return groups
}

// ─── SSE chunk parser ─────────────────────────────────────────────────────────

function parseChunk(line) {
  if (!line.startsWith('data:')) return null
  const raw = line.slice(5).trim()
  if (raw === '[DONE]') return null
  try {
    const j = JSON.parse(raw)
    return j.choices?.[0]?.delta?.content   // OpenAI format
        ?? j.response                        // CF format
        ?? null
  } catch { return null }
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="cv-typing" aria-label="Thinking">
      <span className="cv-dot" /><span className="cv-dot" /><span className="cv-dot" />
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatView({ apiUrl, matchThreshold, maxResults, contextExpansion, rewriteQuery, reRankResults }) {
  const [convs,       setConvs]       = useState(loadConvs)
  const [activeId,    setActiveId]    = useState(null)
  const [streaming,   setStreaming]   = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [input,       setInput]       = useState('')
  const [error,       setError]       = useState(null)

  const apiUrlRef   = useRef(apiUrl)
  const settingsRef = useRef({})
  const abortRef    = useRef(null)
  const textareaRef = useRef(null)
  const bottomRef   = useRef(null)

  useEffect(() => { apiUrlRef.current = apiUrl }, [apiUrl])
  useEffect(() => {
    settingsRef.current = { matchThreshold, maxResults, contextExpansion, rewriteQuery, reRankResults }
  }, [matchThreshold, maxResults, contextExpansion, rewriteQuery, reRankResults])

  // Scroll to bottom on new messages / streaming updates
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) })

  const activeConv = convs.find(c => c.id === activeId) ?? null
  const messages   = activeConv?.messages ?? []
  const grouped    = groupByDate(convs)

  // ── Auto-resize textarea ────────────────────────────────────────────────────

  function handleInputChange(e) {
    setInput(e.target.value)
    const ta = textareaRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px' }
  }

  // ── Conversation management ─────────────────────────────────────────────────

  function startNew() {
    const c = newConv()
    setConvs(prev => { const u = [c, ...prev]; saveConvs(u); return u })
    setActiveId(c.id)
    setSidebarOpen(false)
    setError(null)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function selectConv(id) {
    setActiveId(id)
    setSidebarOpen(false)
    setError(null)
  }

  function deleteConv(e, id) {
    e.stopPropagation()
    setConvs(prev => { const u = prev.filter(c => c.id !== id); saveConvs(u); return u })
    if (activeId === id) setActiveId(null)
  }

  // ── Summarization ───────────────────────────────────────────────────────────

  async function summarize(msgs) {
    const transcript = msgs.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
    try {
      const res = await fetch(`${apiUrlRef.current.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-ai-search-source': 'snippet-chat-completions' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Summarize this conversation in 3–5 sentences, preserving all key facts and context:\n\n${transcript}` }],
          stream: false, max_results: 1,
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data?.choices?.[0]?.message?.content?.trim() ?? null
    } catch { return null }
  }

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    const query = text.trim()
    if (!query || streaming || !activeId) return

    setError(null)
    setStreaming(true)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Work from a fresh load so we never read stale state in the async body
    let allConvs = loadConvs()
    let conv     = allConvs.find(c => c.id === activeId)
    if (!conv) { setStreaming(false); return }

    // Add user message and empty AI placeholder
    const userMsg = newMsg('user', query)
    const aiMsg   = newMsg('assistant', '')
    conv = { ...conv, messages: [...conv.messages, userMsg, aiMsg], updatedAt: Date.now() }

    // Auto-title from first user message
    if (conv.messages.filter(m => m.role === 'user').length === 1) {
      conv.title = query.length > 55 ? query.slice(0, 52) + '…' : query
    }

    allConvs = allConvs.map(c => c.id === conv.id ? conv : c)
    setConvs(allConvs); saveConvs(allConvs)

    // ── Summarize if needed ──────────────────────────────────────────────────
    let summary = conv.summary
    if (conv.messages.length > SUMMARIZE_AFTER && !summary) {
      // Summarize everything except the last KEEP_RECENT + the two we just added
      const cutoff   = conv.messages.length - KEEP_RECENT - 2
      const toSumm   = conv.messages.slice(0, cutoff)
      if (toSumm.length > 0) {
        const newSummary = await summarize(toSumm)
        if (newSummary) {
          summary      = newSummary
          conv.summary = summary
          conv.messages = conv.messages.slice(-(KEEP_RECENT + 2))
          allConvs = loadConvs().map(c => c.id === conv.id ? conv : c)
          setConvs(allConvs); saveConvs(allConvs)
        }
      }
    }

    // ── Build API messages ───────────────────────────────────────────────────
    // All messages except the empty AI placeholder we just added
    const history = conv.messages.filter(m => m.id !== aiMsg.id).map(m => ({ role: m.role, content: m.content }))
    const apiMessages = summary
      ? [
          { role: 'user',      content: `Summary of our earlier conversation:\n${summary}` },
          { role: 'assistant', content: 'Got it, I\'ll keep that context in mind.' },
          ...history,
        ]
      : history

    // ── Fetch ────────────────────────────────────────────────────────────────
    const s   = settingsRef.current
    const url = `${apiUrlRef.current.replace(/\/$/, '')}/chat/completions`
    const body = JSON.stringify({
      messages: apiMessages,
      stream: true,
      max_results: s.maxResults ?? 10,
      ai_search_options: {
        match_threshold:  s.matchThreshold,
        context_expansion: s.contextExpansion,
        rewrite_query:    s.rewriteQuery,
        re_rank_results:  s.reRankResults,
      },
    })

    const controller = new AbortController()
    abortRef.current = controller
    let fullContent  = ''

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-ai-search-source': 'snippet-chat-completions' },
        body,
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Stream via SSE
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const chunk = parseChunk(line.trim())
          if (chunk) {
            fullContent += chunk
            setConvs(prev => prev.map(c => c.id !== activeId ? c : {
              ...c, messages: c.messages.map(m => m.id === aiMsg.id ? { ...m, content: fullContent } : m)
            }))
          }
        }
      }

      // Non-streaming fallback
      if (!fullContent) {
        const r2 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-ai-search-source': 'snippet-chat-completions' },
          body: JSON.stringify({ ...JSON.parse(body), stream: false }),
        })
        if (r2.ok) {
          const d = await r2.json()
          fullContent = d?.choices?.[0]?.message?.content ?? ''
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Something went wrong')
    }

    // Persist final state
    setConvs(prev => {
      const final = prev.map(c => c.id !== activeId ? c : {
        ...c,
        updatedAt: Date.now(),
        messages: c.messages.map(m => m.id === aiMsg.id ? { ...m, content: fullContent } : m),
      })
      saveConvs(final)
      return final
    })

    abortRef.current = null
    setStreaming(false)
  }, [activeId, streaming])

  function handleStop() { abortRef.current?.abort() }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="cv-root">

      {/* Mobile backdrop */}
      {sidebarOpen && <div className="cv-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden />}

      {/* ── Sidebar ── */}
      <aside className={`cv-sidebar${sidebarOpen ? ' cv-sidebar--open' : ''}`}>
        <div className="cv-sidebar-header">
          <button className="cv-new-btn" onClick={startNew}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New Chat
          </button>
        </div>

        <nav className="cv-conv-list">
          {convs.length === 0 && <p className="cv-list-empty">No conversations yet</p>}
          {Object.entries(grouped).map(([label, list]) => (
            <div key={label}>
              <div className="cv-date-label">{label}</div>
              {list.map(c => (
                <div
                  key={c.id}
                  className={`cv-conv-item${c.id === activeId ? ' active' : ''}`}
                  onClick={() => selectConv(c.id)}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && selectConv(c.id)}
                >
                  <span className="cv-conv-title">{c.title}</span>
                  <button className="cv-conv-del" onClick={e => deleteConv(e, c.id)} aria-label="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="cv-main">

        {/* Header */}
        <div className="cv-header">
          <button className="cv-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          <span className="cv-header-title">{activeConv?.title ?? 'Chat'}</span>
        </div>

        {/* Messages */}
        <div className="cv-messages">
          {!activeConv ? (
            <div className="cv-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <p>Select a conversation or start a new one</p>
              <button className="cv-new-btn" onClick={startNew}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                New Chat
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="cv-empty"><p>Send a message to begin</p></div>
          ) : (
            <>
              {activeConv.summary && (
                <div className="cv-memory-pill">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                  Memory active — earlier messages summarized
                </div>
              )}
              {messages.map((m, i) => {
                const isLastAi = m.role === 'assistant' && i === messages.length - 1
                const showTyping = isLastAi && streaming && m.content === ''
                return (
                  <div key={m.id} className={`cv-bubble cv-bubble--${m.role}`}>
                    {showTyping ? <TypingDots /> : <span className="cv-bubble-text">{m.content}</span>}
                  </div>
                )
              })}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="cv-error">
            {error}
            <button className="cv-error-dismiss" onClick={() => setError(null)} aria-label="Dismiss">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {/* Input */}
        <div className="cv-input-row">
          <textarea
            ref={textareaRef}
            className="cv-textarea"
            rows={1}
            placeholder={activeConv ? 'Message… (Enter to send)' : 'Start a new chat first'}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!activeConv || streaming}
          />
          {streaming ? (
            <button className="cv-send-btn cv-stop-btn" onClick={handleStop} aria-label="Stop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            </button>
          ) : (
            <button className="cv-send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || !activeConv} aria-label="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
