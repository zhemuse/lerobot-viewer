import { app } from 'electron'
import { promises as fs } from 'fs'
import { join, basename } from 'path'

export type RecentEntry = {
  path: string
  name: string
  lastOpenedAt: number
}

const MAX_RECENT = 10

function filePath(): string {
  return join(app.getPath('userData'), 'recent.json')
}

export async function readRecent(): Promise<RecentEntry[]> {
  try {
    const raw = await fs.readFile(filePath(), 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .filter(
        (e): e is RecentEntry =>
          typeof e?.path === 'string' &&
          typeof e?.name === 'string' &&
          typeof e?.lastOpenedAt === 'number',
      )
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

async function writeRecent(list: RecentEntry[]): Promise<void> {
  await fs.writeFile(filePath(), JSON.stringify(list, null, 2), 'utf-8')
}

export async function pushRecent(path: string): Promise<void> {
  const list = await readRecent()
  const next: RecentEntry[] = [
    { path, name: basename(path), lastOpenedAt: Date.now() },
    ...list.filter((e) => e.path !== path),
  ].slice(0, MAX_RECENT)
  await writeRecent(next)
}

export async function removeRecent(path: string): Promise<void> {
  const list = await readRecent()
  await writeRecent(list.filter((e) => e.path !== path))
}

export async function clearRecent(): Promise<void> {
  await writeRecent([])
}
