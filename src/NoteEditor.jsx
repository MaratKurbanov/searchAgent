import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import './NoteEditor.css'

export function NoteIcon({ hasNote }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24"
      fill={hasNote ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

export default function NoteEditor({ sermon, onSave, onDelete, onClose }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const isDirtyRef = useRef(false)
  const onSaveRef = useRef(onSave)
  const onDeleteRef = useRef(onDelete)
  const sermonRef = useRef(sermon)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  useEffect(() => { sermonRef.current = sermon }, [sermon])

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: () => { isDirtyRef.current = true },
    editorProps: {
      attributes: {
        class: 'ne-prosemirror',
        'data-placeholder': 'Write your notes here…',
      },
    },
  })

  useEffect(() => {
    if (!sermon?.file || !editor) return
    setLoading(true)
    isDirtyRef.current = false
    fetch(`/api/notes/${encodeURIComponent(sermon.file)}`)
      .then(r => r.ok ? r.json() : null)
      .then(note => {
        editor.commands.setContent(note?.content || '')
        setLastSaved(note?.updated_at || null)
        isDirtyRef.current = false
      })
      .catch(() => editor.commands.setContent(''))
      .finally(() => setLoading(false))
  }, [sermon?.file, editor])

  const isEmpty = useCallback(() => {
    if (!editor) return true
    const html = editor.getHTML()
    return html === '<p></p>' || html === '' || editor.isEmpty
  }, [editor])

  const performSave = useCallback(async () => {
    if (!editor) return
    // If content is empty and note exists, delete instead of saving an empty note
    if (isEmpty() && lastSaved !== null) {
      await onDeleteRef.current?.(sermonRef.current.file)
      isDirtyRef.current = false
      setLastSaved(null)
      return
    }
    if (isEmpty()) return  // nothing to save
    setSaving(true)
    const content = editor.getHTML()
    await onSaveRef.current(sermonRef.current.file, sermonRef.current.title, content)
    isDirtyRef.current = false
    setLastSaved(Math.floor(Date.now() / 1000))
    setSaving(false)
  }, [editor, isEmpty, lastSaved])

  // Autosave every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current) performSave()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [performSave])

  async function handleDelete() {
    await onDeleteRef.current?.(sermonRef.current.file)
    editor?.commands.setContent('')
    isDirtyRef.current = false
    setLastSaved(null)
    onClose()
  }

  async function handleClose() {
    if (isDirtyRef.current) await performSave()
    onClose()
  }

  function formatTime(ts) {
    if (!ts) return null
    return new Date(ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  const ToolBtn = ({ onClick, active, title, children }) => (
    <button
      className={`ne-tool${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
      type="button"
      onMouseDown={e => e.preventDefault()}
    >{children}</button>
  )

  return (
    <div className="ne-root" onClick={e => e.stopPropagation()}>
      <div className="ne-header">
        <span className="ne-header-title">Notes</span>
        <div className="ne-header-actions">
          {saving && <span className="ne-status">Saving…</span>}
          {!saving && lastSaved && <span className="ne-status">Saved {formatTime(lastSaved)}</span>}
          {lastSaved !== null && (
            <button className="ne-delete-btn" onClick={handleDelete} type="button" aria-label="Delete note" title="Delete note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
          <button className="ne-save-btn" onClick={performSave} disabled={saving} type="button">
            Save
          </button>
          <button className="ne-close-btn" onClick={handleClose} type="button" aria-label="Close notes">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="ne-toolbar">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive('bold')} title="Bold"><b>B</b></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive('italic')} title="Italic"><i>I</i></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()}
          active={editor?.isActive('strike')} title="Strikethrough"><s>S</s></ToolBtn>
        <span className="ne-tool-sep" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor?.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor?.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolBtn>
        <span className="ne-tool-sep" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive('bulletList')} title="Bullet list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/>
            <line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive('orderedList')} title="Ordered list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/>
            <line x1="10" y1="18" x2="21" y2="18"/>
            <text x="1" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1.</text>
            <text x="1" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2.</text>
            <text x="1" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3.</text>
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          active={editor?.isActive('blockquote')} title="Blockquote">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
          </svg>
        </ToolBtn>
        <span className="ne-tool-sep" />
        <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
          </svg>
        </ToolBtn>
      </div>

      <div className="ne-editor-wrap">
        {loading
          ? <span className="ne-loading">Loading…</span>
          : <EditorContent editor={editor} />
        }
      </div>
    </div>
  )
}
