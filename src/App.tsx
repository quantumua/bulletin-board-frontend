import { useEffect, useState } from 'react'
import AdForm from './AdForm'
import AuthBar from './AuthBar'
import AuthForm from './AuthForm'
import Dialog from './Dialog'
import { ApiError, createAd, listAds, updateAd, type Ad, type AdInput } from './api'
import { canEdit } from './permissions'
import { useAuth } from './useAuth'
import UsersList from './UsersList'

// Only one dialog is open at a time
type DialogState = 'new' | 'login' | { editId: number } | null

export default function App() {
  const { user, sessionExpired, expireSession } = useAuth()
  const [ads, setAds] = useState<Ad[]>([])
  const [dialog, setDialog] = useState<DialogState>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<'ads' | 'users'>('ads')

  // Logout or an expired session returns to Ads, so the next login starts there
  if (!user && tab !== 'ads') setTab('ads')
  // Without a session only the login dialog makes sense; once logged in it is done
  if (!user && dialog !== null && dialog !== 'login') setDialog(null)
  if (user && dialog === 'login') setDialog(null)

  useEffect(() => {
    listAds()
      .then(setAds)
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  const editingAd = typeof dialog === 'object' && dialog !== null ? ads.find((ad) => ad.id === dialog.editId) : undefined
  const closeDialog = () => setDialog(null)

  // A 401 on a write means the session is gone: go back to anonymous but keep the form text
  function handleWriteError(e: unknown): never {
    if (e instanceof ApiError && e.status === 401) {
      expireSession()
    }
    throw e
  }

  async function handleCreate(input: AdInput) {
    const created = await createAd(input).catch(handleWriteError)
    setAds((current) => [created, ...current])
    setDialog(null)
  }

  async function handleUpdate(id: number, input: AdInput) {
    const updated = await updateAd(id, input).catch(handleWriteError)
    setAds((current) => current.map((ad) => (ad.id === id ? updated : ad)))
    setDialog(null)
  }

  return (
    <main>
      <header className="app-header">
        <h1>Bulletin Board</h1>

        {user && (
          <nav className="tabs">
            <button type="button" className={tab === 'ads' ? 'tab active' : 'tab'} onClick={() => setTab('ads')}>
              Ads
            </button>
            <button type="button" className={tab === 'users' ? 'tab active' : 'tab'} onClick={() => setTab('users')}>
              Users
            </button>
          </nav>
        )}

        <div className="header-actions">
          <button type="button" onClick={() => setDialog(user ? 'new' : 'login')}>
            + New ad
          </button>
          <AuthBar onLogin={() => setDialog('login')} />
        </div>
      </header>

      {!user && sessionExpired && <p className="error">Your session has ended. Please log in again.</p>}

      {user && tab === 'users' && <UsersList onUnauthorized={expireSession} />}

      {tab === 'ads' && (
        <section>
          <h2>Ads</h2>
          {loadError && <p className="error">Could not load ads: {loadError}</p>}
          {!loadError && ads.length === 0 && <p className="muted">No ads yet.</p>}
          <ul className="ad-list">
            {ads.map((ad) => (
              <li key={ad.id} className="ad-card">
                <h3>{ad.title}</h3>
                <p className="description">{ad.description}</p>
                <div className="meta">
                  <span className="muted">
                    {ad.author ? `By ${ad.author} · ` : ''}Updated {new Date(ad.updatedAt).toLocaleString()}
                  </span>
                  {canEdit(ad, user) && (
                    <button type="button" className="secondary" onClick={() => setDialog({ editId: ad.id })}>
                      Edit
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Always mounted, even when anonymous, so a draft survives closing and an expired session */}
      <Dialog open={dialog === 'new'} onClose={closeDialog} label="New ad">
        <h2>New ad</h2>
        <AdForm onSubmit={handleCreate} onCancel={closeDialog} />
      </Dialog>

      {/* Mounted only while editing, so every open starts from the stored ad and close discards changes */}
      <Dialog open={editingAd !== undefined} onClose={closeDialog} label="Edit ad">
        {editingAd && (
          <>
            <h2>Edit ad</h2>
            <AdForm
              key={editingAd.id}
              ad={editingAd}
              onSubmit={(input) => handleUpdate(editingAd.id, input)}
              onCancel={closeDialog}
            />
          </>
        )}
      </Dialog>

      <Dialog open={dialog === 'login'} onClose={closeDialog} label="Account">
        {dialog === 'login' && <AuthForm />}
      </Dialog>
    </main>
  )
}
