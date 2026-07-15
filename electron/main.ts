import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from 'electron'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  ItemPatch,
  Retention,
  SettingsPatch,
  ShelfItem,
  ShelfItemType,
  ShelfSettings,
  ShelfState,
} from '../src/types'
import { isPathInside } from './pathSafety'

const EXPANDED_WIDTH = 440
const COLLAPSED_WIDTH = 18
const WINDOW_HEIGHT = 760
const SHORTCUT = 'CommandOrControl+Shift+Space'

const DEFAULT_SETTINGS: ShelfSettings = {
  side: 'right',
  autoHide: true,
  alwaysOnTop: true,
  launchAtLogin: false,
  clipboardMonitoring: false,
  retention: '24h',
  hasSeenWelcome: false,
}

let state: ShelfState = { version: 1, items: [], settings: { ...DEFAULT_SETTINGS } }
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let expanded = false
let stateFile = ''
let captureDirectory = ''
let clipboardTimer: NodeJS.Timeout | null = null
let lastClipboardSignature = ''
let saveChain: Promise<void> = Promise.resolve()
let isQuitting = false
const visualCheckPath = process.env.DROPSHELF_VISUAL_CHECK
const visualCheckView = process.env.DROPSHELF_VISUAL_VIEW ?? 'items'

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif'])

function retentionMs(retention: Retention): number | null {
  if (retention === '1h') return 60 * 60 * 1000
  if (retention === '24h') return 24 * 60 * 60 * 1000
  if (retention === '7d') return 7 * 24 * 60 * 60 * 1000
  return null
}

function expirationFor(settings = state.settings): number | null {
  const duration = retentionMs(settings.retention)
  return duration === null ? null : Date.now() + duration
}

function accentFor(type: ShelfItemType): string {
  return {
    file: '#8b83ff',
    folder: '#f4b85b',
    image: '#ff76a8',
    text: '#54d7b0',
    link: '#64b5ff',
  }[type]
}

function safeState(value: unknown): ShelfState {
  if (!value || typeof value !== 'object') return { version: 1, items: [], settings: { ...DEFAULT_SETTINGS } }
  const candidate = value as Partial<ShelfState>
  const rawItems = Array.isArray(candidate.items) ? candidate.items : []
  const items = rawItems.filter((item): item is ShelfItem => Boolean(
    item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.type === 'string',
  )).slice(0, 2000)
  return {
    version: 1,
    items,
    settings: { ...DEFAULT_SETTINGS, ...(candidate.settings ?? {}) },
  }
}

async function loadState(): Promise<void> {
  try {
    state = safeState(JSON.parse(await fs.readFile(stateFile, 'utf8')))
  } catch {
    state = { version: 1, items: [], settings: { ...DEFAULT_SETTINGS } }
  }
  removeExpired(false)
}

function seedVisualState(): void {
  if (!visualCheckPath) return
  const now = Date.now()
  state.settings = { ...DEFAULT_SETTINGS, autoHide: false, hasSeenWelcome: visualCheckView !== 'welcome' }
  state.items = visualCheckView === 'welcome' ? [] : [
    {
      id: 'visual-file', type: 'file', title: 'Project brief.pdf', extension: 'PDF', size: 3_680_000,
      createdAt: now - 130_000, updatedAt: now - 130_000, pinned: true, expiresAt: null, accent: '#8b83ff',
    },
    {
      id: 'visual-image', type: 'image', title: 'Kitchen inspiration.png', extension: 'PNG', size: 2_210_000,
      createdAt: now - 510_000, updatedAt: now - 510_000, pinned: false, expiresAt: now + 82_000_000, accent: '#ff76a8',
    },
    {
      id: 'visual-link', type: 'link', title: 'architecturaldigest.com', content: 'https://www.architecturaldigest.com/story/kitchen-lighting',
      createdAt: now - 950_000, updatedAt: now - 950_000, pinned: false, expiresAt: now + 81_000_000, accent: '#64b5ff',
    },
    {
      id: 'visual-text', type: 'text', title: 'Remember to ask about the afternoon delivery window', content: 'Remember to ask about the afternoon delivery window.',
      createdAt: now - 4_400_000, updatedAt: now - 4_400_000, pinned: false, expiresAt: now + 78_000_000, accent: '#54d7b0',
    },
  ]
}

function persistState(): Promise<void> {
  const snapshot = JSON.stringify(state, null, 2)
  saveChain = saveChain.then(async () => {
    await fs.mkdir(path.dirname(stateFile), { recursive: true })
    const temporary = `${stateFile}.tmp`
    await fs.writeFile(temporary, snapshot, 'utf8')
    await fs.rename(temporary, stateFile).catch(async () => {
      await fs.copyFile(temporary, stateFile)
      await fs.unlink(temporary).catch(() => undefined)
    })
  }).catch((error) => console.error('Could not save DropShelf state', error))
  return saveChain
}

function broadcastState(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('state:changed', state)
}

async function commitState(): Promise<void> {
  broadcastState()
  await persistState()
  refreshTrayMenu()
}

function removeExpired(commit = true): void {
  const now = Date.now()
  const before = state.items.length
  const removed = state.items.filter((item) => !item.pinned && item.expiresAt !== null && item.expiresAt <= now)
  state.items = state.items.filter((item) => item.pinned || item.expiresAt === null || item.expiresAt > now)
  void cleanupManagedCaptures(removed)
  if (commit && before !== state.items.length) void commitState()
}

function isManagedCapture(filePath: string): boolean {
  return isPathInside(captureDirectory, filePath)
}

async function cleanupManagedCaptures(items: ShelfItem[]): Promise<void> {
  await Promise.all(items.map(async (item) => {
    if (item.path && isManagedCapture(item.path)) await fs.unlink(item.path).catch(() => undefined)
  }))
}

async function openExternalUrl(value: string): Promise<boolean> {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    await shell.openExternal(url.toString())
    return true
  } catch {
    return false
  }
}

function copyItemToClipboard(item: ShelfItem): boolean {
  if (item.type === 'image' && item.path) {
    const image = nativeImage.createFromPath(item.path)
    if (image.isEmpty()) return false
    clipboard.writeImage(image)
  } else if (item.content) clipboard.writeText(item.content)
  else if (item.path) clipboard.writeText(item.path)
  else return false
  lastClipboardSignature = clipboardSignature()
  toast('Copied to clipboard')
  return true
}

function detectTextType(content: string): ShelfItemType {
  try {
    const url = new URL(content.trim())
    if (url.protocol === 'http:' || url.protocol === 'https:') return 'link'
  } catch {
    // Plain text.
  }
  return 'text'
}

function titleForText(content: string, type: ShelfItemType): string {
  if (type === 'link') {
    try {
      const url = new URL(content.trim())
      return url.hostname.replace(/^www\./, '')
    } catch {
      return 'Link'
    }
  }
  const title = content.trim().replace(/\s+/g, ' ')
  return title.length > 72 ? `${title.slice(0, 69)}…` : title || 'Text snippet'
}

async function addText(content: string, announce = false): Promise<ShelfItem | null> {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!normalized || normalized.length > 1_000_000) return null
  const duplicate = state.items.find((item) => item.content === normalized)
  if (duplicate) {
    duplicate.updatedAt = Date.now()
    duplicate.createdAt = Date.now()
    if (!duplicate.pinned) duplicate.expiresAt = expirationFor()
    state.items = [duplicate, ...state.items.filter((item) => item.id !== duplicate.id)]
    await commitState()
    return duplicate
  }
  const type = detectTextType(normalized)
  const item: ShelfItem = {
    id: randomUUID(),
    type,
    title: titleForText(normalized, type),
    content: normalized,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    expiresAt: expirationFor(),
    accent: accentFor(type),
  }
  state.items = [item, ...state.items].slice(0, 2000)
  await commitState()
  if (announce) toast(type === 'link' ? 'Link added from clipboard' : 'Text added from clipboard')
  return item
}

async function itemFromPath(filePath: string): Promise<ShelfItem | null> {
  try {
    const stats = await fs.stat(filePath)
    const extension = stats.isDirectory() ? '' : path.extname(filePath).toLowerCase()
    const type: ShelfItemType = stats.isDirectory() ? 'folder' : imageExtensions.has(extension) ? 'image' : 'file'
    return {
      id: randomUUID(),
      type,
      title: path.basename(filePath) || filePath,
      path: path.resolve(filePath),
      extension: extension ? extension.slice(1).toUpperCase() : undefined,
      size: stats.isFile() ? stats.size : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      expiresAt: expirationFor(),
      accent: accentFor(type),
    }
  } catch {
    return null
  }
}

async function addFiles(paths: string[]): Promise<ShelfItem[]> {
  const uniquePaths = [...new Set(paths.filter((value) => typeof value === 'string'))].slice(0, 100)
  const candidates = (await Promise.all(uniquePaths.map(itemFromPath))).filter((item): item is ShelfItem => item !== null)
  const added: ShelfItem[] = []
  for (const candidate of candidates) {
    const duplicate = state.items.find((item) => item.path?.toLowerCase() === candidate.path?.toLowerCase())
    if (duplicate) {
      duplicate.createdAt = Date.now()
      duplicate.updatedAt = Date.now()
      if (!duplicate.pinned) duplicate.expiresAt = expirationFor()
      state.items = [duplicate, ...state.items.filter((item) => item.id !== duplicate.id)]
      added.push(duplicate)
    } else {
      state.items.unshift(candidate)
      added.push(candidate)
    }
  }
  state.items = state.items.slice(0, 2000)
  if (added.length) await commitState()
  return added
}

async function addClipboardImage(announce = false): Promise<ShelfItem | null> {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null
  await fs.mkdir(captureDirectory, { recursive: true })
  const id = randomUUID()
  const filePath = path.join(captureDirectory, `clipboard-${id}.png`)
  await fs.writeFile(filePath, image.toPNG())
  const item = await itemFromPath(filePath)
  if (!item) return null
  item.id = id
  item.title = `Clipboard image · ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(Date.now())}`
  state.items.unshift(item)
  await commitState()
  if (announce) toast('Image added from clipboard')
  return item
}

async function addFromClipboard(announce = false): Promise<ShelfItem | null> {
  const formats = clipboard.availableFormats()
  if (formats.some((format) => format.toLowerCase().includes('image'))) {
    const imageItem = await addClipboardImage(announce)
    if (imageItem) return imageItem
  }
  return addText(clipboard.readText(), announce)
}

function clipboardSignature(): string {
  const image = clipboard.readImage()
  if (!image.isEmpty()) return `image:${image.getSize().width}x${image.getSize().height}:${image.toPNG().byteLength}`
  return `text:${clipboard.readText()}`
}

function configureClipboardMonitoring(): void {
  if (clipboardTimer) clearInterval(clipboardTimer)
  clipboardTimer = null
  lastClipboardSignature = clipboardSignature()
  if (!state.settings.clipboardMonitoring) return
  clipboardTimer = setInterval(() => {
    const signature = clipboardSignature()
    if (signature !== lastClipboardSignature && signature !== 'text:') {
      lastClipboardSignature = signature
      void addFromClipboard(false)
    }
  }, 900)
}

function findItem(id: string): ShelfItem | undefined {
  return state.items.find((item) => item.id === id)
}

function toast(message: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('toast', message)
}

function currentDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

function targetBounds(isExpanded: boolean) {
  const { workArea } = currentDisplay()
  const width = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH
  const height = Math.min(WINDOW_HEIGHT, workArea.height - 28)
  const x = state.settings.side === 'right'
    ? workArea.x + workArea.width - width + (isExpanded ? 0 : 8)
    : workArea.x - (isExpanded ? 0 : 8)
  const y = workArea.y + Math.max(14, Math.round((workArea.height - height) / 2))
  return { x, y, width, height }
}

function setExpanded(next: boolean, focus = true): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  expanded = next
  mainWindow.setBounds(targetBounds(next), true)
  mainWindow.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating')
  if (!mainWindow.isVisible()) mainWindow.showInactive()
  if (next && focus) mainWindow.focus()
  mainWindow.webContents.send('window:mode', next ? 'expanded' : 'collapsed')
}

function toggleWindow(): void {
  setExpanded(!expanded)
}

function createWindow(): void {
  const bounds = targetBounds(false)
  mainWindow = new BrowserWindow({
    ...bounds,
    title: 'DropShelf',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: state.settings.alwaysOnTop,
    hasShadow: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      navigateOnDragDrop: false,
      spellcheck: true,
    },
  })

  mainWindow.setMenu(null)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.VITE_DEV_SERVER_URL) void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'), visualCheckView === 'settings' ? { query: { view: 'settings' } } : undefined)

  mainWindow.once('ready-to-show', () => {
    if (visualCheckPath) {
      setExpanded(true)
      setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        const image = await mainWindow.webContents.capturePage()
        await fs.mkdir(path.dirname(visualCheckPath), { recursive: true })
        await fs.writeFile(visualCheckPath, image.toPNG())
        isQuitting = true
        app.quit()
      }, 1000)
    } else {
      mainWindow?.showInactive()
      mainWindow?.webContents.send('window:mode', 'collapsed')
    }
  })
  mainWindow.on('blur', () => {
    if (state.settings.autoHide && expanded) setTimeout(() => {
      if (mainWindow && !mainWindow.isFocused()) setExpanded(false, false)
    }, 220)
  })
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      setExpanded(false, false)
    }
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
}

function logoImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#171722"/><path d="M16 22c0-3.3 2.7-6 6-6h20c3.3 0 6 2.7 6 6v22c0 3.3-2.7 6-6 6H22c-3.3 0-6-2.7-6-6V22Z" fill="#8B83FF"/><path d="M22 29h20v4H22zM25 36h14a3 3 0 0 1 3 3v5H22v-5a3 3 0 0 1 3-3Z" fill="white"/></svg>`
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 32, height: 32 })
}

function refreshTrayMenu(): void {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: expanded ? 'Hide DropShelf' : 'Open DropShelf', click: toggleWindow },
    { label: 'Add clipboard', click: () => void addFromClipboard(true) },
    { type: 'separator' },
    { label: `${state.items.length} item${state.items.length === 1 ? '' : 's'} on shelf`, enabled: false },
    { label: 'Clear unpinned', enabled: state.items.some((item) => !item.pinned), click: () => {
      const removed = state.items.filter((item) => !item.pinned)
      state.items = state.items.filter((item) => item.pinned)
      void cleanupManagedCaptures(removed)
      void commitState()
    } },
    { type: 'separator' },
    { label: 'Quit DropShelf', click: () => {
      isQuitting = true
      app.quit()
    } },
  ]))
}

function createTray(): void {
  tray = new Tray(logoImage())
  tray.setToolTip(`DropShelf · ${SHORTCUT.replace('CommandOrControl', process.platform === 'darwin' ? '⌘' : 'Ctrl')}`)
  tray.on('click', toggleWindow)
  refreshTrayMenu()
}

function applySettings(): void {
  mainWindow?.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating')
  app.setLoginItemSettings({ openAtLogin: state.settings.launchAtLogin, openAsHidden: true })
  configureClipboardMonitoring()
  if (mainWindow) setExpanded(expanded, false)
}

function registerIpc(): void {
  ipcMain.handle('state:get', () => state)
  ipcMain.handle('items:add-files', (_event, paths: string[]) => addFiles(paths))
  ipcMain.handle('items:add-text', (_event, content: string) => addText(content))
  ipcMain.handle('items:add-clipboard', () => addFromClipboard(true))
  ipcMain.handle('items:choose-files', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add to DropShelf',
      properties: ['openFile', 'openDirectory', 'multiSelections'],
    })
    return result.canceled ? [] : addFiles(result.filePaths)
  })
  ipcMain.handle('items:update', async (_event, id: string, patch: ItemPatch) => {
    const item = findItem(id)
    if (!item) return null
    if (typeof patch.title === 'string') item.title = patch.title.trim().slice(0, 160) || item.title
    if (typeof patch.accent === 'string' && /^#[0-9a-f]{6}$/i.test(patch.accent)) item.accent = patch.accent
    if (typeof patch.pinned === 'boolean') {
      item.pinned = patch.pinned
      item.expiresAt = patch.pinned ? null : expirationFor()
    }
    item.updatedAt = Date.now()
    await commitState()
    return item
  })
  ipcMain.handle('items:remove', async (_event, ids: string[]) => {
    const set = new Set(ids)
    const removed = state.items.filter((item) => set.has(item.id))
    state.items = state.items.filter((item) => !set.has(item.id))
    await cleanupManagedCaptures(removed)
    await commitState()
  })
  ipcMain.handle('items:clear-unpinned', async () => {
    const removed = state.items.filter((item) => !item.pinned)
    state.items = state.items.filter((item) => item.pinned)
    await cleanupManagedCaptures(removed)
    await commitState()
  })
  ipcMain.handle('settings:update', async (_event, patch: SettingsPatch) => {
    state.settings = { ...state.settings, ...patch }
    applySettings()
    await commitState()
    return state.settings
  })
  ipcMain.handle('item:preview', async (_event, id: string) => {
    const item = findItem(id)
    if (!item?.path || item.type !== 'image') return null
    try {
      const image = nativeImage.createFromPath(item.path)
      if (image.isEmpty()) return null
      const size = image.getSize()
      const width = Math.min(720, size.width)
      return image.resize({ width, quality: 'good' }).toDataURL()
    } catch {
      return null
    }
  })
  ipcMain.handle('item:file-icon', async (_event, id: string) => {
    const item = findItem(id)
    if (!item?.path) return null
    try {
      return (await app.getFileIcon(item.path, { size: 'normal' })).toDataURL()
    } catch {
      return null
    }
  })
  ipcMain.handle('item:open', async (_event, id: string) => {
    const item = findItem(id)
    if (!item) return
    if (item.type === 'link' && item.content) {
      await openExternalUrl(item.content)
    } else if (item.path) {
      const error = await shell.openPath(item.path)
      if (error) toast(error)
    }
  })
  ipcMain.handle('item:reveal', (_event, id: string) => {
    const item = findItem(id)
    if (item?.path) shell.showItemInFolder(item.path)
  })
  ipcMain.handle('item:copy', async (_event, id: string) => {
    const item = findItem(id)
    return item ? copyItemToClipboard(item) : false
  })
  ipcMain.on('item:start-drag', async (event, id: string) => {
    const item = findItem(id)
    if (!item?.path) return
    try {
      const icon = await app.getFileIcon(item.path, { size: 'large' })
      event.sender.startDrag({ file: item.path, icon })
    } catch {
      toast('This item cannot be dragged right now')
    }
  })
  ipcMain.on('window:expand', () => setExpanded(true))
  ipcMain.on('window:collapse', () => setExpanded(false, false))
  ipcMain.on('app:quit', () => {
    isQuitting = true
    app.quit()
  })
  ipcMain.on('item:context-menu', (event, id: string) => {
    const item = findItem(id)
    if (!item) return
    Menu.buildFromTemplate([
      { label: item.type === 'link' ? 'Open link' : item.type === 'text' ? 'Copy text' : 'Open', click: () => {
        if (item.type === 'text') copyItemToClipboard(item)
        else if (item.type === 'link' && item.content) void openExternalUrl(item.content)
        else if (item.path) void shell.openPath(item.path)
      } },
      { label: 'Copy', click: () => { copyItemToClipboard(item) } },
      ...(item.path ? [{ label: 'Show in folder', click: () => shell.showItemInFolder(item.path!) }] : []),
      { type: 'separator' as const },
      { label: item.pinned ? 'Unpin' : 'Pin', click: () => {
        item.pinned = !item.pinned
        item.expiresAt = item.pinned ? null : expirationFor()
        void commitState()
      } },
      { label: 'Remove from shelf', click: () => {
        state.items = state.items.filter((candidate) => candidate.id !== id)
        void cleanupManagedCaptures([item])
        void commitState()
      } },
    ]).popup({ window: BrowserWindow.fromWebContents(event.sender) ?? undefined })
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
else {
  app.on('second-instance', () => setExpanded(true))
  app.whenReady().then(async () => {
    app.setName('DropShelf')
    stateFile = path.join(app.getPath('userData'), 'dropshelf-state.json')
    captureDirectory = path.join(app.getPath('userData'), 'captured')
    await loadState()
    seedVisualState()
    registerIpc()
    createWindow()
    createTray()
    applySettings()
    globalShortcut.register(SHORTCUT, toggleWindow)
    setInterval(() => removeExpired(), 60_000)
  }).catch((error) => {
    console.error(error)
    app.quit()
  })
}

app.on('activate', () => setExpanded(true))
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (clipboardTimer) clearInterval(clipboardTimer)
})
app.on('window-all-closed', () => {
  if (process.platform === 'darwin' && isQuitting) app.quit()
})
