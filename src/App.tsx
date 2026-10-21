import { useEffect, useState } from 'react'
import AdForm from './AdForm'
import { createAd, listAds, updateAd, type Ad, type AdInput } from './api'
import AuthPanels from './auth/AuthPanels'
import { useCurrentUser } from './auth/CurrentUserContext'

export default function App() {
  const { user, sessionEnded, sessionVersion } = useCurrentUser()
  const [ads, setAds] = useState<Ad[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Forms stay open after the session ends so typed input survives until the user logs in again (FR3.4).
  // The UI rules are convenience only; the backend refuses every write it does not allow (NFR5).
  const canWrite = user !== null || sessionEnded

  // Loads on mount, in parallel with /auth/me, and again after log-in and log-out so `ownedByMe` is current
  useEffect(() => {
    let active = true
    listAds()
      .then((loaded) => {
        if (!active) return
        setAds(loaded)
        setLoadError(null)
      })
      .catch((e: Error) => {
        if (active) setLoadError(e.message)
      })
    return () => {
      active = false
    }
  }, [sessionVersion])

  // Logging out closes any open edit form (adjusted while rendering, not in an effect)
  const [couldWrite, setCouldWrite] = useState(canWrite)
  if (couldWrite !== canWrite) {
    setCouldWrite(canWrite)
    if (!canWrite) setEditingId(null)
  }

  async function handleCreate(input: AdInput) {
    const created = await createAd(input)
    setAds((current) => [created, ...current])
  }

  async function handleUpdate(id: number, input: AdInput) {
    const updated = await updateAd(id, input)
    setAds((current) => current.map((ad) => (ad.id === id ? updated : ad)))
    setEditingId(null)
  }

  return (
    <main>
      <h1>Bulletin Board</h1>

      <AuthPanels />

      {canWrite && (
        <section data-testid="new-ad-section">
          <h2>New ad</h2>
          <AdForm onSubmit={handleCreate} />
        </section>
      )}

      <section>
        <h2>Ads</h2>
        {loadError && (
          <p role="alert" className="error" data-testid="ad-list-error">
            Could not load ads: {loadError}
          </p>
        )}
        {!loadError && ads.length === 0 && <p className="muted">No ads yet.</p>}
        <ul className="ad-list" data-testid="ad-list">
          {ads.map((ad) => (
            <li key={ad.id} className="ad-card" data-testid="ad-card">
              {editingId === ad.id ? (
                <AdForm
                  ad={ad}
                  onSubmit={(input) => handleUpdate(ad.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <h3>{ad.title}</h3>
                  <p className="author" data-testid="ad-card-author">
                    by {ad.authorName || 'Unknown'}
                  </p>
                  <p className="description">{ad.description}</p>
                  <div className="meta">
                    <span className="muted">Updated {new Date(ad.updatedAt).toLocaleString()}</span>
                    {user && ad.ownedByMe && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setEditingId(ad.id)}
                        data-testid="ad-card-edit-button"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
