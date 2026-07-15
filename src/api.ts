import type { DropShelfAPI, ShelfItem, ShelfState } from './types'

const now = Date.now()
let previewState: ShelfState = {
  version: 1,
  settings: {
    side: 'right',
    autoHide: false,
    alwaysOnTop: true,
    launchAtLogin: false,
    clipboardMonitoring: false,
    retention: '24h',
    hasSeenWelcome: true,
  },
  items: [
    {
      id: 'preview-1',
      type: 'image',
      title: 'Mountain moodboard.png',
      extension: 'PNG',
      size: 2_460_000,
      createdAt: now - 90_000,
      updatedAt: now - 90_000,
      pinned: true,
      expiresAt: null,
      accent: '#ff76a8',
    },
    {
      id: 'preview-2',
      type: 'link',
      title: 'theverge.com',
      content: 'https://www.theverge.com/',
      createdAt: now - 480_000,
      updatedAt: now - 480_000,
      pinned: false,
      expiresAt: now + 80_000_000,
      accent: '#64b5ff',
    },
    {
      id: 'preview-3',
      type: 'text',
      title: 'Remember to ask about the afternoon delivery window',
      content: 'Remember to ask about the afternoon delivery window.',
      createdAt: now - 1_600_000,
      updatedAt: now - 1_600_000,
      pinned: false,
      expiresAt: now + 79_000_000,
      accent: '#54d7b0',
    },
  ],
}

const listeners = new Set<(state: ShelfState) => void>()
const emit = () => listeners.forEach((listener) => listener(structuredClone(previewState)))

const previewApi: DropShelfAPI = {
  getState: async () => structuredClone(previewState),
  getPathForFile: (file) => file.name,
  addFiles: async (paths) => {
    const items: ShelfItem[] = paths.map((value, index) => ({
      id: `preview-file-${Date.now()}-${index}`,
      type: 'file',
      title: value.split(/[\\/]/).pop() ?? value,
      path: value,
      extension: value.split('.').pop()?.toUpperCase(),
      createdAt: Date.now(), updatedAt: Date.now(), pinned: false,
      expiresAt: Date.now() + 86_400_000, accent: '#8b83ff',
    }))
    previewState.items.unshift(...items); emit(); return items
  },
  addText: async (content) => {
    if (!content.trim()) return null
    const item: ShelfItem = {
      id: `preview-text-${Date.now()}`, type: 'text', title: content.slice(0, 72), content,
      createdAt: Date.now(), updatedAt: Date.now(), pinned: false,
      expiresAt: Date.now() + 86_400_000, accent: '#54d7b0',
    }
    previewState.items.unshift(item); emit(); return item
  },
  addFromClipboard: async () => previewApi.addText('A fresh note from your clipboard'),
  chooseFiles: async () => previewApi.addFiles(['Project brief.pdf']),
  updateItem: async (id, patch) => {
    const item = previewState.items.find((candidate) => candidate.id === id)
    if (!item) return null
    Object.assign(item, patch); emit(); return item
  },
  removeItems: async (ids) => { previewState.items = previewState.items.filter((item) => !ids.includes(item.id)); emit() },
  clearUnpinned: async () => { previewState.items = previewState.items.filter((item) => item.pinned); emit() },
  updateSettings: async (patch) => { previewState.settings = { ...previewState.settings, ...patch }; emit(); return previewState.settings },
  getPreview: async () => null,
  getFileIcon: async () => null,
  openItem: async () => undefined,
  revealItem: async () => undefined,
  copyItem: async () => true,
  startFileDrag: () => undefined,
  expand: () => undefined,
  collapse: () => undefined,
  hide: () => undefined,
  quit: () => undefined,
  showContextMenu: () => undefined,
  onStateChanged: (callback) => { listeners.add(callback); return () => listeners.delete(callback) },
  onWindowMode: () => () => undefined,
  onToast: () => () => undefined,
}

export const dropShelf = window.dropShelf ?? previewApi
export const isDesktop = Boolean(window.dropShelf)
