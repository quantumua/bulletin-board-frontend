import { useEffect, useState } from 'react'
import AdForm from './AdForm'
import AuthBar from './AuthBar'
import { ApiError, createAd, listAds, updateAd, type Ad, type AdInput } from './api'
import { canEdit } from './permissions'
import { useAuth } from './useAuth'

export default function App() {
  const { user, sessionExpired, expireSession } = useAuth()
  const [ads, setAds] = useState<Ad[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    listAds()
      .then(setAds)
      .catch((e: Error) => setLoadError(e.message))
  }, [])

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
  }

  async function handleUpdate(id: number, input: AdInput) {
    const updated = await updateAd(id, input).catch(handleWriteError)
    setAds((current) => current.map((ad) => (ad.id === id ? updated : ad)))
    setEditingId(null)
  }

  return (
    <main>
      <h1>Bulletin Board</h1>

      <AuthBar />

      {!user && sessionExpired && <p className="error">Your session has ended. Please log in again.</p>}

      {!user && (
        <section>
          <h2>New ad</h2>
          <p className="muted">Log in to post an ad.</p>
        </section>
      )}

      {/* Stays mounted (hidden) when anonymous so a draft survives an expired session */}
      <section hidden={!user}>
        <h2>New ad</h2>
        <AdForm onSubmit={handleCreate} />
      </section>

      <section>
        <h2>Ads</h2>
        {loadError && <p className="error">Could not load ads: {loadError}</p>}
        {!loadError && ads.length === 0 && <p className="muted">No ads yet.</p>}
        <ul className="ad-list">
          {ads.map((ad) => (
            <li key={ad.id} className="ad-card">
              {editingId === ad.id ? (
                <AdForm
                  ad={ad}
                  onSubmit={(input) => handleUpdate(ad.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <h3>{ad.title}</h3>
                  <p className="description">{ad.description}</p>
                  <div className="meta">
                    <span className="muted">
                      {ad.author ? `By ${ad.author} · ` : ''}Updated {new Date(ad.updatedAt).toLocaleString()}
                    </span>
                    {canEdit(ad, user) && (
                      <button type="button" className="secondary" onClick={() => setEditingId(ad.id)}>
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
