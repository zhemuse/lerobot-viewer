import { ipcMain, dialog } from 'electron'
import { readDatasetMeta, readEpisodeFrames } from '@lerobot/lerobot-reader'
import { dirname, basename } from 'path'
import { promises as fs } from 'fs'
import { setDatasetRoot, setUrdfRoot } from './protocol'
import { readRecent, pushRecent, removeRecent, clearRecent } from './recent'

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
      title: '选择 LeRobot 数据集目录',
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
      title: '选择 URDF 文件',
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
