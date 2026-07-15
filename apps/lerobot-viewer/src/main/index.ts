import { app, BrowserWindow, protocol } from 'electron'
import { join } from 'path'
import { registerLerobotProtocol } from './protocol'
import { registerIpcHandlers } from './ipc'

protocol.registerSchemesAsPrivileged([
  { scheme: 'lerobot', privileges: { standard: true, supportFetchAPI: true, stream: true } },
])

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
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
