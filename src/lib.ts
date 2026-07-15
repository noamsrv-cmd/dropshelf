import type { Retention, ShelfItem, ShelfItemType } from './types'

export const FILTERS: Array<{ id: 'all' | ShelfItemType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'file', label: 'Files' },
  { id: 'image', label: 'Images' },
  { id: 'text', label: 'Text' },
  { id: 'link', label: 'Links' },
]

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

export function expirationLabel(item: ShelfItem, now = Date.now()): string | null {
  if (item.pinned || item.expiresAt === null) return null
  const milliseconds = item.expiresAt - now
  if (milliseconds <= 0) return 'expiring'
  const minutes = Math.ceil(milliseconds / 60_000)
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.ceil(minutes / 60)
  if (hours < 48) return `${hours}h left`
  return `${Math.ceil(hours / 24)}d left`
}

export function retentionLabel(value: Retention): string {
  return { never: 'Never', '1h': 'After 1 hour', '24h': 'After 24 hours', '7d': 'After 7 days' }[value]
}

export function matchesItem(item: ShelfItem, query: string, filter: 'all' | ShelfItemType): boolean {
  const normalized = query.trim().toLocaleLowerCase()
  const matchesFilter = filter === 'all' || item.type === filter || (filter === 'file' && item.type === 'folder')
  if (!matchesFilter) return false
  if (!normalized) return true
  return `${item.title}\n${item.content ?? ''}\n${item.path ?? ''}`.toLocaleLowerCase().includes(normalized)
}

export function retentionToExpiry(retention: Retention, now = Date.now()): number | null {
  const durations: Record<Retention, number | null> = {
    never: null,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  }
  const duration = durations[retention]
  return duration === null ? null : now + duration
}
