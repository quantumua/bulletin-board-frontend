import { useState, type FormEvent } from 'react'
import type { Ad, AdInput } from './api'

interface AdFormProps {
  ad?: Ad
  onSubmit: (input: AdInput) => Promise<void>
  onCancel?: () => void
}

export default function AdForm({ ad, onSubmit, onCancel }: AdFormProps) {
  const [title, setTitle] = useState(ad?.title ?? '')
  const [description, setDescription] = useState(ad?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ title: title.trim(), description: description.trim() })
      if (!ad) {
        setTitle('')
        setDescription('')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="ad-form" onSubmit={handleSubmit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={saving}>
          {ad ? 'Save' : 'Add ad'}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
