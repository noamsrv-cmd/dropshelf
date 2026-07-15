export type ShelfItemType = 'file' | 'folder' | 'image' | 'text' | 'link'
export type ShelfSide = 'left' | 'right'
export type Retention = 'never' | '1h' | '24h' | '7d'

export interface ShelfItem {
  id: string
  type: ShelfItemType
  title: string
  path?: string
  content?: string
  extension?: string
  size?: number
  createdAt: number
  updatedAt: number
  pinned: boolean
  expiresAt: number | null
  accent: string
}

export interface ShelfSettings {
  side: ShelfSide
  autoHide: boolean
  alwaysOnTop: boolean
  launchAtLogin: boolean
  clipboardMonitoring: boolean
  retention: Retention
  hasSeenWelcome: boolean
}

export interface ShelfState {
  version: 1
  items: ShelfItem[]
  settings: ShelfSettings
}

export type ItemPatch = Partial<Pick<ShelfItem, 'title' | 'pinned' | 'accent'>>
export type SettingsPatch = Partial<ShelfSettings>

export interface DropShelfAPI {
  getState(): Promise<ShelfState>
  getPathForFile(file: File): string
  addFiles(paths: string[]): Promise<ShelfItem[]>
  addText(content: string): Promise<ShelfItem | null>
  addFromClipboard(): Promise<ShelfItem | null>
  chooseFiles(): Promise<ShelfItem[]>
  updateItem(id: string, patch: ItemPatch): Promise<ShelfItem | null>
  removeItems(ids: string[]): Promise<void>
  clearUnpinned(): Promise<void>
  updateSettings(patch: SettingsPatch): Promise<ShelfSettings>
  getPreview(id: string): Promise<string | null>
  getFileIcon(id: string): Promise<string | null>
  openItem(id: string): Promise<void>
  revealItem(id: string): Promise<void>
  copyItem(id: string): Promise<boolean>
  startFileDrag(id: string): void
  expand(): void
  collapse(): void
  hide(): void
  quit(): void
  showContextMenu(id: string): void
  onStateChanged(callback: (state: ShelfState) => void): () => void
  onWindowMode(callback: (mode: 'expanded' | 'collapsed') => void): () => void
  onToast(callback: (message: string) => void): () => void
}

declare global {
  interface Window {
    dropShelf: DropShelfAPI
  }
}
