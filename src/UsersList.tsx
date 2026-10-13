import { useEffect, useRef, useState } from 'react'
import { ApiError, listUsers, type ListedUser } from './api'

export default function UsersList({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [users, setUsers] = useState<ListedUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Keep the latest callback without refetching when its identity changes
  const onUnauthorizedRef = useRef(onUnauthorized)
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized
  })

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then((result) => {
        if (!cancelled) setUsers(result)
      })
      .catch((e: Error) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) onUnauthorizedRef.current()
        else setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section>
      <h2>Users</h2>
      {error && <p className="error">Could not load users: {error}</p>}
      {!error && users === null && <p className="muted">Loading users…</p>}
      {users && (
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.id} className="user-row">
              <strong>{user.username}</strong>
              <span className="muted">Joined {new Date(user.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
