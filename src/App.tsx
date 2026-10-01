import { useEffect, useState } from 'react'
import AdForm from './AdForm'
import { createAd, listAds, updateAd, type Ad, type AdInput } from './api'

export default function App() {
  const [ads, setAds] = useState<Ad[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    listAds()
      .then(setAds)
      .catch((e: Error) => setLoadError(e.message))
  }, [])

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

      <section>
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
                    <span className="muted">Updated {new Date(ad.updatedAt).toLocaleString()}</span>
                    <button type="button" className="secondary" onClick={() => setEditingId(ad.id)}>
                      Edit
                    </button>
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
