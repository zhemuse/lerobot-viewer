import { join } from 'node:path'
import { app, BrowserWindow, protocol, shell } from 'electron'
import { registerIpcHandlers } from './ipc'
import { registerLerobotProtocol } from './protocol'

protocol.registerSchemesAsPrivileged([
  { scheme: 'lerobot', privileges: { standard: true, supportFetchAPI: true, stream: true } },
])

const ALLOWED_ORIGINS = new Set([
  'lerobot:',
  'file:',
  ...(process.env.ELECTRON_RENDERER_URL ? [new URL(process.env.ELECTRON_RENDERER_URL).origin] : []),
])

function hardenWindow(win: BrowserWindow): void {
  // External links open in the OS browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Block in-window navigation away from our own origin.
  win.webContents.on('will-navigate', (event, url) => {
    const origin = new URL(url).origin
    if (!ALLOWED_ORIGINS.has(origin) && !ALLOWED_ORIGINS.has(new URL(url).protocol)) {
      event.preventDefault()
    }
  })

  // Deny renderer requests for elevated permissions (camera / mic / etc.).
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false)
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false,
    },
  })

  hardenWindow(win)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerLerobotProtocol()
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
