import { useState, type FormEvent } from 'react'
import { ApiError, GENERIC_ERROR_MESSAGE, type Ad, type AdInput } from './api'

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
      // Refusals (not logged in, not the owner, ...) keep everything the user typed
      setError(e instanceof ApiError ? e.detail : GENERIC_ERROR_MESSAGE)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="ad-form" onSubmit={handleSubmit} data-testid="ad-form">
      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          required
          data-testid="ad-form-title-input"
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          required
          data-testid="ad-form-description-input"
        />
      </label>
      {error && (
        <p role="alert" className="error" data-testid="ad-form-error">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" disabled={saving} data-testid="ad-form-submit-button">
          {ad ? 'Save' : 'Add ad'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={saving}
            data-testid="ad-form-cancel-button"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
