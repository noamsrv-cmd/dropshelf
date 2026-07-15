import {
  Archive,
  ArrowLeftToLine,
  ArrowRightToLine,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  Copy,
  ExternalLink,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  MoreHorizontal,
  MousePointer2,
  PanelRightClose,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { dropShelf, isDesktop } from './api'
import { expirationLabel, FILTERS, formatBytes, matchesItem, relativeTime, retentionLabel } from './lib'
import type { ShelfItem, ShelfItemType, ShelfSettings, ShelfState } from './types'

const EMPTY_STATE: ShelfState = {
  version: 1,
  items: [],
  settings: {
    side: 'right', autoHide: true, alwaysOnTop: true, launchAtLogin: false,
    clipboardMonitoring: false, retention: '24h', hasSeenWelcome: false,
  },
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="DropShelf">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <defs>
          <linearGradient id="shelf-gradient" x1="5" y1="3" x2="31" y2="33" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A7A1FF" />
            <stop offset="1" stopColor="#766DF6" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="32" height="32" rx="10" fill="url(#shelf-gradient)" />
        <path d="M9.5 13.5h17v3h-17z" fill="white" fillOpacity=".97" />
        <path d="M12 19h12a3 3 0 0 1 3 3v5H9v-5a3 3 0 0 1 3-3Z" fill="white" />
        <path d="M14 22h8" stroke="#8981FA" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {!compact && <span>DropShelf</span>}
    </div>
  )
}

function IconButton({ label, active, className = '', children, onClick }: {
  label: string; active?: boolean; className?: string; children: React.ReactNode; onClick?: () => void
}) {
  return (
    <button className={`icon-button ${active ? 'is-active' : ''} ${className}`} type="button" title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button className={`toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

function ShelfHandle({ side, onExpand }: { side: 'left' | 'right'; onExpand: () => void }) {
  return (
    <button
      type="button"
      className={`shelf-handle shelf-handle--${side}`}
      onMouseEnter={onExpand}
      onDragEnter={(event) => { event.preventDefault(); onExpand() }}
      onClick={onExpand}
      aria-label="Open DropShelf"
      title="Open DropShelf · Ctrl+Shift+Space"
    >
      <span className="handle-glow" />
      <span className="handle-dot" />
      <span className="handle-dot" />
      <span className="handle-dot" />
    </button>
  )
}

function useAsset(item: ShelfItem): string | null {
  const [asset, setAsset] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const request = item.type === 'image' ? dropShelf.getPreview(item.id) : item.path ? dropShelf.getFileIcon(item.id) : Promise.resolve(null)
    void request.then((value) => { if (live) setAsset(value) })
    return () => { live = false }
  }, [item.id, item.path, item.type])
  return asset
}

function ItemVisual({ item }: { item: ShelfItem }) {
  const asset = useAsset(item)
  if (asset) return <img className={item.type === 'image' ? 'item-preview' : 'file-icon'} src={asset} alt="" draggable={false} />
  if (item.type === 'image') return <ImageIcon />
  if (item.type === 'folder') return <Folder />
  if (item.type === 'link') return <Link2 />
  if (item.type === 'text') return <Type />
  return <File />
}

function itemMeta(item: ShelfItem): string {
  if (item.type === 'text') return `${item.content?.length ?? 0} characters`
  if (item.type === 'link') {
    try { return new URL(item.content ?? '').pathname === '/' ? 'Website' : new URL(item.content ?? '').pathname }
    catch { return 'Link' }
  }
  return [item.extension ?? (item.type === 'folder' ? 'Folder' : 'File'), formatBytes(item.size)].filter(Boolean).join(' · ')
}

function ItemCard({ item, selected, onSelect, onRemove }: {
  item: ShelfItem; selected: boolean; onSelect: (event: MouseEvent) => void; onRemove: () => void
}) {
  const expiry = expirationLabel(item)
  const supportsNativeDrag = Boolean(item.path)
  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    if (supportsNativeDrag) {
      event.preventDefault()
      dropShelf.startFileDrag(item.id)
    } else {
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData(item.type === 'link' ? 'text/uri-list' : 'text/plain', item.content ?? item.title)
      event.dataTransfer.setData('text/plain', item.content ?? item.title)
    }
  }
  return (
    <article
      className={`item-card ${selected ? 'is-selected' : ''} item-card--${item.type}`}
      style={{ '--item-accent': item.accent } as CSSProperties}
      tabIndex={0}
      role="option"
      aria-selected={selected}
      draggable
      onDragStart={handleDragStart}
      onClick={onSelect}
      onDoubleClick={() => void dropShelf.openItem(item.id)}
      onContextMenu={(event) => { event.preventDefault(); dropShelf.showContextMenu(item.id) }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter') void dropShelf.openItem(item.id)
        if (event.key === 'Delete' || event.key === 'Backspace') onRemove()
      }}
    >
      <div className="item-accent" />
      <div className={`item-visual ${item.type === 'image' ? 'item-visual--image' : ''}`}>
        <ItemVisual item={item} />
        <div className="drag-grip"><span /><span /><span /></div>
      </div>
      <div className="item-copy">
        <div className="item-title-row">
          <strong title={item.title}>{item.title}</strong>
          {item.pinned && <Pin className="pin-indicator" aria-label="Pinned" />}
        </div>
        {item.type === 'text' && item.content && <p className="snippet">{item.content}</p>}
        <div className="item-meta">
          <span>{itemMeta(item)}</span>
          <i />
          <span>{relativeTime(item.createdAt)}</span>
          {expiry && <><i /><span className="expiry">{expiry}</span></>}
        </div>
      </div>
      <div className="item-actions">
        <IconButton label="Copy" onClick={() => void dropShelf.copyItem(item.id)}><Copy /></IconButton>
        <IconButton label={item.pinned ? 'Unpin' : 'Pin'} active={item.pinned} onClick={() => void dropShelf.updateItem(item.id, { pinned: !item.pinned })}>
          {item.pinned ? <PinOff /> : <Pin />}
        </IconButton>
        <IconButton label="More" onClick={() => dropShelf.showContextMenu(item.id)}><MoreHorizontal /></IconButton>
      </div>
    </article>
  )
}

function Welcome({ onComplete, onChoose }: { onComplete: () => void; onChoose: () => void }) {
  return (
    <section className="welcome">
      <div className="welcome-orbit" aria-hidden="true">
        <span className="orbit-card orbit-card--file"><File /></span>
        <span className="orbit-card orbit-card--image"><ImageIcon /></span>
        <span className="orbit-card orbit-card--link"><Link2 /></span>
        <div className="welcome-logo"><Logo compact /></div>
      </div>
      <span className="eyebrow"><Sparkles /> Your new in-between place</span>
      <h1>Keep it close.<br />Use it anywhere.</h1>
      <p>Drop files, images, links, and text here while you move between apps. Nothing leaves your computer.</p>
      <div className="welcome-actions">
        <button className="button button--primary" onClick={onComplete}><MousePointer2 /> Start using DropShelf</button>
        <button className="button button--ghost" onClick={onChoose}><FilePlus2 /> Choose files</button>
      </div>
      <div className="shortcut-hint"><kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>Space</kbd><em>opens from anywhere</em></div>
    </section>
  )
}

function EmptyShelf({ hasQuery, onChoose, onPaste }: { hasQuery: boolean; onChoose: () => void; onPaste: () => void }) {
  if (hasQuery) return (
    <div className="empty-state empty-state--search"><Search /><h3>No matches</h3><p>Try another word or filter.</p></div>
  )
  return (
    <div className="empty-state">
      <div className="empty-illustration"><Archive /><span className="drop-pulse" /></div>
      <h3>Your shelf is ready</h3>
      <p>Drag anything here, or add your first item.</p>
      <div><button className="button button--soft" onClick={onChoose}><FilePlus2 /> Choose files</button><button className="button button--text" onClick={onPaste}><Clipboard /> Add clipboard</button></div>
    </div>
  )
}

function TextComposer({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => area.current?.focus(), [])
  const save = async () => {
    const item = await dropShelf.addText(value)
    if (item) onClose()
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="composer" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <div className="panel-heading"><div><span className="panel-icon"><Type /></span><div><h2>Add text or a link</h2><p>It stays local on this computer.</p></div></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
        <textarea ref={area} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Paste or type anything…" />
        <div className="composer-footer"><span>{value.length.toLocaleString()} characters</span><div><button type="button" className="button button--ghost" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={!value.trim()}><Plus /> Add to shelf</button></div></div>
      </form>
    </div>
  )
}

function AddMenu({ onText, onClose }: { onText: () => void; onClose: () => void }) {
  const action = (callback: () => void) => { callback(); onClose() }
  return (
    <div className="popover add-menu">
      <span className="popover-label">Add to your shelf</span>
      <button onClick={() => action(() => { void dropShelf.chooseFiles() })}><span className="menu-icon menu-icon--purple"><FilePlus2 /></span><span><strong>Files or folders</strong><small>Choose from your computer</small></span></button>
      <button onClick={() => action(onText)}><span className="menu-icon menu-icon--green"><Type /></span><span><strong>Text or link</strong><small>Write or paste something</small></span></button>
      <button onClick={() => action(() => { void dropShelf.addFromClipboard() })}><span className="menu-icon menu-icon--pink"><Clipboard /></span><span><strong>Current clipboard</strong><small>Add what you copied</small></span></button>
    </div>
  )
}

function SettingRow({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <div className="setting-row"><span className="setting-icon">{icon}</span><div><strong>{title}</strong><p>{description}</p></div><div className="setting-control">{children}</div></div>
}

function SettingsPanel({ settings, onClose, onUpdate }: { settings: ShelfSettings; onClose: () => void; onUpdate: (patch: Partial<ShelfSettings>) => void }) {
  return (
    <div className="panel-overlay">
      <aside className="settings-panel">
        <div className="panel-heading"><div><span className="panel-icon"><Settings /></span><div><h2>Settings</h2><p>Make the shelf feel like yours.</p></div></div><IconButton label="Close settings" onClick={onClose}><X /></IconButton></div>
        <div className="settings-content">
          <section><h3>BEHAVIOR</h3>
            <SettingRow icon={<PanelRightClose />} title="Hide when inactive" description="Collapse back to the edge after you click away."><Toggle label="Hide when inactive" checked={settings.autoHide} onChange={(autoHide) => onUpdate({ autoHide })} /></SettingRow>
            <SettingRow icon={<Pin />} title="Stay above windows" description="Keep DropShelf within reach while it is open."><Toggle label="Stay above windows" checked={settings.alwaysOnTop} onChange={(alwaysOnTop) => onUpdate({ alwaysOnTop })} /></SettingRow>
            <SettingRow icon={<Sparkles />} title="Start with Windows" description="Have your shelf ready when you sign in."><Toggle label="Start with Windows" checked={settings.launchAtLogin} onChange={(launchAtLogin) => onUpdate({ launchAtLogin })} /></SettingRow>
          </section>
          <section><h3>POSITION</h3>
            <div className="side-picker">
              <button className={settings.side === 'left' ? 'is-active' : ''} onClick={() => onUpdate({ side: 'left' })}><ArrowLeftToLine /> Left edge</button>
              <button className={settings.side === 'right' ? 'is-active' : ''} onClick={() => onUpdate({ side: 'right' })}>Right edge <ArrowRightToLine /></button>
            </div>
          </section>
          <section><h3>CLEANUP</h3>
            <SettingRow icon={<Clock3 />} title="Remove unpinned items" description="Pinned items are always kept.">
              <label className="select-wrap"><select value={settings.retention} onChange={(event) => onUpdate({ retention: event.target.value as ShelfSettings['retention'] })}><option value="1h">After 1 hour</option><option value="24h">After 24 hours</option><option value="7d">After 7 days</option><option value="never">Never</option></select><ChevronDown /></label>
            </SettingRow>
          </section>
          <section><h3>CLIPBOARD</h3>
            <SettingRow icon={<Clipboard />} title="Clipboard history" description="Automatically add copied text and images. Kept locally."><Toggle label="Clipboard history" checked={settings.clipboardMonitoring} onChange={(clipboardMonitoring) => onUpdate({ clipboardMonitoring })} /></SettingRow>
            {settings.clipboardMonitoring && <div className="privacy-note"><Check /> DropShelf never uploads or analyzes your clipboard.</div>}
          </section>
          <section className="about-card"><Logo /><p>Version 1.0.0 · Local-first and open source.</p><span>Your files stay yours.</span></section>
        </div>
      </aside>
    </div>
  )
}

function DropOverlay({ count }: { count: number }) {
  return <div className="drop-overlay"><div className="drop-target"><span className="drop-target-icon"><Plus /></span><h2>Drop to keep it close</h2><p>{count ? `${count} item${count === 1 ? '' : 's'} ready to add` : 'Files, folders, images, text, or links'}</p></div></div>
}

function App() {
  const [state, setState] = useState<ShelfState>(EMPTY_STATE)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'expanded' | 'collapsed'>(() => window.innerWidth < 100 ? 'collapsed' : 'expanded')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | ShelfItemType>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(() => new URLSearchParams(window.location.search).get('view') === 'settings')
  const [addOpen, setAddOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragCount, setDragCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const dragDepth = useRef(0)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    void dropShelf.getState().then((next) => { setState(next); setReady(true) })
    const offState = dropShelf.onStateChanged(setState)
    const offMode = dropShelf.onWindowMode(setMode)
    const offToast = dropShelf.onToast((message) => {
      setToast(message)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 2400)
    })
    const resize = () => setMode(window.innerWidth < 100 ? 'collapsed' : 'expanded')
    window.addEventListener('resize', resize)
    return () => { offState(); offMode(); offToast(); window.removeEventListener('resize', resize) }
  }, [])

  useEffect(() => {
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (composerOpen) setComposerOpen(false)
        else if (settingsOpen) setSettingsOpen(false)
        else if (addOpen) setAddOpen(false)
        else if (selected.size) setSelected(new Set())
        else dropShelf.collapse()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault(); document.querySelector<HTMLInputElement>('.search-input input')?.focus()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [addOpen, composerOpen, selected.size, settingsOpen])

  const visibleItems = useMemo(() => state.items.filter((item) => matchesItem(item, query, filter)), [filter, query, state.items])
  const pinned = visibleItems.filter((item) => item.pinned)
  const recent = visibleItems.filter((item) => !item.pinned)
  const completeWelcome = () => void dropShelf.updateSettings({ hasSeenWelcome: true })
  const updateSettings = (patch: Partial<ShelfSettings>) => void dropShelf.updateSettings(patch)

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault(); event.stopPropagation(); dragDepth.current += 1
    setDragCount(event.dataTransfer.items.length); setDragging(true)
    if (mode === 'collapsed') dropShelf.expand()
  }
  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault(); event.stopPropagation(); dragDepth.current -= 1
    if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false) }
  }
  const handleDrop = async (event: DragEvent) => {
    event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false)
    const paths = [...event.dataTransfer.files].map((file) => dropShelf.getPathForFile(file)).filter(Boolean)
    if (paths.length) await dropShelf.addFiles(paths)
    else {
      const content = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
      if (content) await dropShelf.addText(content)
    }
  }

  const chooseItem = (item: ShelfItem, event: MouseEvent) => {
    setSelected((current) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        const next = new Set(current)
        if (next.has(item.id)) next.delete(item.id); else next.add(item.id)
        return next
      }
      return current.has(item.id) && current.size === 1 ? new Set() : new Set([item.id])
    })
  }

  if (mode === 'collapsed') return <ShelfHandle side={state.settings.side} onExpand={() => dropShelf.expand()} />

  const showWelcome = ready && !state.settings.hasSeenWelcome && state.items.length === 0
  return (
    <main className="app-shell" onDragEnter={handleDragEnter} onDragOver={(event) => event.preventDefault()} onDragLeave={handleDragLeave} onDrop={(event) => void handleDrop(event)}>
      <header className="app-header">
        <Logo />
        <div className="header-actions">
          <IconButton label={state.settings.autoHide ? 'Keep shelf open' : 'Hide when inactive'} active={!state.settings.autoHide} onClick={() => updateSettings({ autoHide: !state.settings.autoHide })}>{state.settings.autoHide ? <Pin /> : <PinOff />}</IconButton>
          <IconButton label="Settings" active={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings /></IconButton>
          <IconButton label="Collapse to edge" onClick={() => dropShelf.collapse()}><PanelRightClose /></IconButton>
        </div>
      </header>

      {showWelcome ? <Welcome onComplete={completeWelcome} onChoose={() => { completeWelcome(); void dropShelf.chooseFiles() }} /> : <>
        <div className="toolbar">
          <label className="search-input"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your shelf" /><kbd>⌘F</kbd>{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}</label>
          <div className="add-wrap"><button className={`add-button ${addOpen ? 'is-active' : ''}`} onClick={() => setAddOpen(!addOpen)} aria-label="Add item"><Plus /><span>Add</span><ChevronDown /></button>{addOpen && <AddMenu onText={() => setComposerOpen(true)} onClose={() => setAddOpen(false)} />}</div>
        </div>
        <nav className="filter-row" aria-label="Item filters">
          {FILTERS.map((option) => <button key={option.id} className={filter === option.id ? 'is-active' : ''} onClick={() => setFilter(option.id)}>{option.label}{option.id !== 'all' && <span>{state.items.filter((item) => option.id === 'file' ? item.type === 'file' || item.type === 'folder' : item.type === option.id).length}</span>}</button>)}
        </nav>

        {selected.size > 0 && <div className="selection-bar"><span><i>{selected.size}</i> selected</span><div><IconButton label="Copy selected" onClick={() => { for (const id of selected) void dropShelf.copyItem(id) }}><Copy /></IconButton><IconButton label="Pin selected" onClick={() => { for (const id of selected) void dropShelf.updateItem(id, { pinned: true }) }}><Pin /></IconButton><IconButton label="Remove selected" className="danger" onClick={() => { void dropShelf.removeItems([...selected]); setSelected(new Set()) }}><Trash2 /></IconButton><IconButton label="Clear selection" onClick={() => setSelected(new Set())}><X /></IconButton></div></div>}

        <section className="shelf-content" onClick={(event) => { if (event.target === event.currentTarget) setSelected(new Set()) }}>
          {visibleItems.length === 0 ? <EmptyShelf hasQuery={Boolean(query || filter !== 'all')} onChoose={() => void dropShelf.chooseFiles()} onPaste={() => void dropShelf.addFromClipboard()} /> : <>
            {pinned.length > 0 && <div className="item-group"><div className="group-heading"><span><Pin /> Pinned</span><small>{pinned.length}</small></div>{pinned.map((item) => <ItemCard key={item.id} item={item} selected={selected.has(item.id)} onSelect={(event) => chooseItem(item, event)} onRemove={() => void dropShelf.removeItems([item.id])} />)}</div>}
            {recent.length > 0 && <div className="item-group"><div className="group-heading"><span><Clock3 /> Recent</span><small>{recent.length}</small></div>{recent.map((item) => <ItemCard key={item.id} item={item} selected={selected.has(item.id)} onSelect={(event) => chooseItem(item, event)} onRemove={() => void dropShelf.removeItems([item.id])} />)}</div>}
          </>}
        </section>
        <footer className="app-footer"><span><span className="status-dot" /> {state.items.length} item{state.items.length === 1 ? '' : 's'} · local only</span><button onClick={() => void dropShelf.clearUnpinned()} disabled={!state.items.some((item) => !item.pinned)}><Trash2 /> Clear unpinned</button></footer>
      </>}

      {settingsOpen && <SettingsPanel settings={state.settings} onClose={() => setSettingsOpen(false)} onUpdate={updateSettings} />}
      {composerOpen && <TextComposer onClose={() => setComposerOpen(false)} />}
      {dragging && <DropOverlay count={dragCount} />}
      {toast && <div className="toast"><span><Check /></span>{toast}</div>}
      {!isDesktop && <div className="preview-badge">Browser preview</div>}
    </main>
  )
}

export default App
