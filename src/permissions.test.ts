import { describe, expect, test } from 'vitest'
import type { Ad, User } from './api'
import { canEdit } from './permissions'

const ad = (author: string | null): Ad => ({
  id: 1,
  title: 't',
  description: 'd',
  author,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})
const ann: User = { id: 1, username: 'ann' }

describe('canEdit', () => {
  test('owner can edit', () => expect(canEdit(ad('ann'), ann)).toBe(true))
  test('another user cannot edit', () => expect(canEdit(ad('bob'), ann)).toBe(false))
  test('anonymous cannot edit', () => expect(canEdit(ad('ann'), null)).toBe(false))
  test('ownerless ad cannot be edited', () => expect(canEdit(ad(null), ann)).toBe(false))
})
