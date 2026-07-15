import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DropShelfAPI, ItemPatch, SettingsPatch, ShelfState } from '../src/types'

const api: DropShelfAPI = {
  getState: () => ipcRenderer.invoke('state:get'),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  addFiles: (paths) => ipcRenderer.invoke('items:add-files', paths),
  addText: (content) => ipcRenderer.invoke('items:add-text', content),
  addFromClipboard: () => ipcRenderer.invoke('items:add-clipboard'),
  chooseFiles: () => ipcRenderer.invoke('items:choose-files'),
  updateItem: (id: string, patch: ItemPatch) => ipcRenderer.invoke('items:update', id, patch),
  removeItems: (ids: string[]) => ipcRenderer.invoke('items:remove', ids),
  clearUnpinned: () => ipcRenderer.invoke('items:clear-unpinned'),
  updateSettings: (patch: SettingsPatch) => ipcRenderer.invoke('settings:update', patch),
  getPreview: (id: string) => ipcRenderer.invoke('item:preview', id),
  getFileIcon: (id: string) => ipcRenderer.invoke('item:file-icon', id),
  openItem: (id: string) => ipcRenderer.invoke('item:open', id),
  revealItem: (id: string) => ipcRenderer.invoke('item:reveal', id),
  copyItem: (id: string) => ipcRenderer.invoke('item:copy', id),
  startFileDrag: (id: string) => ipcRenderer.send('item:start-drag', id),
  expand: () => ipcRenderer.send('window:expand'),
  collapse: () => ipcRenderer.send('window:collapse'),
  hide: () => ipcRenderer.send('window:collapse'),
  quit: () => ipcRenderer.send('app:quit'),
  showContextMenu: (id: string) => ipcRenderer.send('item:context-menu', id),
  onStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ShelfState) => callback(state)
    ipcRenderer.on('state:changed', listener)
    return () => ipcRenderer.removeListener('state:changed', listener)
  },
  onWindowMode: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, mode: 'expanded' | 'collapsed') => callback(mode)
    ipcRenderer.on('window:mode', listener)
    return () => ipcRenderer.removeListener('window:mode', listener)
  },
  onToast: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('toast', listener)
    return () => ipcRenderer.removeListener('toast', listener)
  },
}

contextBridge.exposeInMainWorld('dropShelf', api)
