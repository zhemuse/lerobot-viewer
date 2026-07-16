import { promises as fs } from 'node:fs'
import { basename, dirname } from 'node:path'
import { readDatasetMeta, readEpisodeFrames } from '@lerobot-viewer/reader'
import { dialog, ipcMain } from 'electron'
import { setDatasetRoot, setUrdfRoot } from './protocol'
import { clearRecent, pushRecent, readRecent, removeRecent } from './recent'

let currentDatasetPath = ''

async function openDatasetAt(path: string) {
  currentDatasetPath = path
  setDatasetRoot(currentDatasetPath)
  const meta = await readDatasetMeta(currentDatasetPath)
  await pushRecent(currentDatasetPath)
  return { path, meta }
}

export function registerIpcHandlers() {
  ipcMain.handle('open-dataset', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select a LeRobot dataset folder',
    })
    if (result.canceled || !result.filePaths[0]) return null
    return openDatasetAt(result.filePaths[0])
  })

  ipcMain.handle('load-episode', async (_event, episodeIndex: number) => {
    if (!currentDatasetPath) throw new Error('No dataset loaded')
    return readEpisodeFrames(currentDatasetPath, episodeIndex)
  })

  ipcMain.handle('open-urdf', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'URDF', extensions: ['urdf'] }],
      title: 'Select a URDF file',
    })
    if (result.canceled || !result.filePaths[0]) return null

    const urdfFile = result.filePaths[0]
    setUrdfRoot(dirname(urdfFile))
    return `lerobot://urdf/${basename(urdfFile)}`
  })

  ipcMain.handle('list-recent', async () => readRecent())

  ipcMain.handle('open-recent', async (_event, path: string) => {
    try {
      const stat = await fs.stat(path)
      if (!stat.isDirectory()) {
        await removeRecent(path)
        return null
      }
      return await openDatasetAt(path)
    } catch {
      await removeRecent(path)
      return null
    }
  })

  ipcMain.handle('clear-recent', async () => clearRecent())
}
