import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  toggleMiniMode: () => ipcRenderer.send('toggle-mini-mode'),
  getInitialMiniModeState: () => ipcRenderer.invoke('get-initial-mini-mode-state'),
  onMiniModeChanged: (callback) => ipcRenderer.on('mini-mode-changed', (_event, ...args) => callback(...args)),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  loadSettings: () => ipcRenderer.invoke('load-settings')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('appApi', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.appApi = api
}
