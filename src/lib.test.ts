import { describe, expect, it } from 'vitest'
import { expirationLabel, formatBytes, matchesItem, relativeTime, retentionToExpiry } from './lib'
import type { ShelfItem } from './types'

const item: ShelfItem = {
  id: '1', type: 'text', title: 'Shipping address', content: '12 Lavender Road',
  createdAt: 1_000_000, updatedAt: 1_000_000, pinned: false, expiresAt: 4_600_000, accent: '#54d7b0',
}

describe('shelf utilities', () => {
  it('formats file sizes for humans', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(12 * 1024 * 1024)).toBe('12 MB')
  })

  it('matches titles and content case-insensitively', () => {
    expect(matchesItem(item, 'LAVENDER', 'all')).toBe(true)
    expect(matchesItem(item, 'shipping', 'text')).toBe(true)
    expect(matchesItem(item, 'shipping', 'link')).toBe(false)
  })

  it('produces friendly relative and expiry labels', () => {
    expect(relativeTime(970_000, 1_000_000)).toBe('just now')
    expect(relativeTime(400_000, 1_000_000)).toBe('10m ago')
    expect(expirationLabel(item, 1_000_000)).toBe('1h left')
  })

  it('maps retention to an exact future timestamp', () => {
    expect(retentionToExpiry('never', 100)).toBeNull()
    expect(retentionToExpiry('1h', 100)).toBe(3_600_100)
  })
})
