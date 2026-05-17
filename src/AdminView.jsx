import { useState, useEffect } from 'react'
import './AdminView.css'

export default function AdminView() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userBookmarks, setUserBookmarks] = useState([])
  const [loadingBm, setLoadingBm] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error(await res.text())
      setUsers(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function changeRole(email, role) {
    await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setUsers(prev => prev.map(u => u.email === email ? { ...u, role } : u))
  }

  async function deleteUser(email) {
    if (!confirm(`Delete user ${email}? This also removes all their bookmarks.`)) return
    await fetch(`/api/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' })
    setUsers(prev => prev.filter(u => u.email !== email))
    if (selectedUser?.email === email) setSelectedUser(null)
  }

  async function viewBookmarks(user) {
    setSelectedUser(user)
    setLoadingBm(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}`)
      setUserBookmarks(await res.json())
    } finally {
      setLoadingBm(false)
    }
  }

  function formatDate(unixTs) {
    if (!unixTs) return '—'
    return new Date(unixTs * 1000).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  if (loading) return <div className="av-state">Loading users…</div>
  if (error) return <div className="av-state av-state--error">Error: {error}</div>

  return (
    <div className="av-root">
      <div className="av-header">
        <h2 className="av-title">User Management</h2>
        <button className="av-refresh" onClick={loadUsers}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="av-table-wrap">
        <table className="av-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Bookmarks</th>
              <th>Read</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan="7" className="av-state">No users yet.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.email}>
                  <td className="av-email">{u.email}</td>
                  <td className="av-name">{u.full_name || <span className="av-none">—</span>}</td>
                  <td>
                    <select
                      className="av-role-select"
                      value={u.role}
                      onChange={e => changeRole(u.email, e.target.value)}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="av-num">{u.bookmark_count}</td>
                  <td className="av-num">{u.read_count}</td>
                  <td className="av-date">{formatDate(u.created_at)}</td>
                  <td className="av-actions">
                    <button className="av-btn av-btn--view" onClick={() => viewBookmarks(u)}>
                      Bookmarks
                    </button>
                    <button className="av-btn av-btn--del" onClick={() => deleteUser(u.email)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <div className="av-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()}>
            <div className="av-modal-header">
              <h3 className="av-modal-title">Bookmarks — {selectedUser.email}</h3>
              <button className="av-modal-close" onClick={() => setSelectedUser(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="av-modal-body">
              {loadingBm ? (
                <div className="av-state">Loading…</div>
              ) : userBookmarks.length === 0 ? (
                <div className="av-state">No bookmarks.</div>
              ) : (
                <table className="av-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Added</th>
                      <th>Read on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userBookmarks.map(b => (
                      <tr key={b.id}>
                        <td>
                          {b.sermon_url
                            ? <a href={b.sermon_url} target="_blank" rel="noopener noreferrer" className="av-link">{b.sermon_title}</a>
                            : b.sermon_title}
                        </td>
                        <td>
                          <span className={`av-status ${b.is_read ? 'av-status--read' : 'av-status--unread'}`}>
                            {b.is_read ? 'Read' : 'Unread'}
                          </span>
                        </td>
                        <td className="av-date">{formatDate(b.created_at)}</td>
                        <td className="av-date">{b.read_at ? formatDate(b.read_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
