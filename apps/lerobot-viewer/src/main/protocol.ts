import { protocol } from 'electron'
import { createReadStream, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'

let datasetRoot = ''
let urdfRoot = ''

export function setDatasetRoot(p: string) {
  datasetRoot = p
}

export function setUrdfRoot(p: string) {
  urdfRoot = p
}

function resolveVideoPath(rest: string[]): string | null {
  const videosDir = join(datasetRoot, 'videos')
  const direct = join(videosDir, ...rest)
  try {
    statSync(direct)
    return direct
  } catch {
    // fall through to chunk lookup
  }
  let chunks: string[]
  try {
    chunks = readdirSync(videosDir).filter((d) => d.startsWith('chunk-')).sort()
  } catch {
    return null
  }
  for (const chunk of chunks) {
    const candidate = join(videosDir, chunk, ...rest)
    try {
      statSync(candidate)
      return candidate
    } catch {
      // try next chunk
    }
  }
  return null
}

export function registerLerobotProtocol() {
  protocol.handle('lerobot', (request) => {
    const url = new URL(request.url)
    // lerobot://videos/observation.images.top/episode_000000.mp4
    // lerobot://urdf/robot.urdf
    const category = url.hostname
    const rest = url.pathname.split('/').filter(Boolean)

    const localPath =
      category === 'videos'
        ? resolveVideoPath(rest)
        : join(urdfRoot, ...rest)

    if (!localPath) {
      return new Response('Not found', { status: 404 })
    }

    try {
      const stat = statSync(localPath)
      const rangeHeader = request.headers.get('range')
      const ext = localPath.split('.').pop() ?? ''
      const contentType =
        ext === 'mp4' ? 'video/mp4' :
        ext === 'urdf' ? 'application/xml' :
        'application/octet-stream'

      if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
        const start = parseInt(startStr, 10)
        const end = endStr ? parseInt(endStr, 10) : stat.size - 1
        const stream = createReadStream(localPath, { start, end })
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(end - start + 1),
            'Content-Type': contentType,
          },
        })
      }

      const stream = createReadStream(localPath)
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 200,
        headers: {
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
        },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
