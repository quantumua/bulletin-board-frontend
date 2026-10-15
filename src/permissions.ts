import type { Ad, User } from './api'

// UI hint only: the backend enforces ownership. Ownerless ads (author null) are never editable.
export function canEdit(ad: Ad, user: User | null): boolean {
  return user !== null && ad.author !== null && ad.author === user.username
}
