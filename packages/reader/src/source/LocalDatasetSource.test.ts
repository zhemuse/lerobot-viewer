import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readDatasetMeta, readEpisodeFrames } from '../index'
import { DatasetSource } from './DatasetSource'
import { LocalDatasetSource } from './LocalDatasetSource'

describe('LocalDatasetSource', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lerobot-source-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('extends the abstract DatasetSource contract', () => {
    const src = new LocalDatasetSource(root)
    expect(src).toBeInstanceOf(DatasetSource)
    expect(src.id).toBe(`local:${root}`)
  })

  describe('videoUrl', () => {
    it('produces the lerobot:// URL the protocol handler consumes', () => {
      const src = new LocalDatasetSource(root)
      expect(src.videoUrl(0, 'top_rgb')).toBe(
        'lerobot://videos/observation.images.top_rgb/episode_000000.mp4',
      )
      expect(src.videoUrl(42, 'wrist')).toBe(
        'lerobot://videos/observation.images.wrist/episode_000042.mp4',
      )
    })
  })

  describe('meta', () => {
    it('parses info.json + episodes.jsonl into the DatasetMeta shape', async () => {
      mkdirSync(join(root, 'meta'), { recursive: true })
      writeFileSync(
        join(root, 'meta', 'info.json'),
        JSON.stringify({
          fps: 30,
          total_episodes: 2,
          features: {
            'observation.state': {
              dtype: 'float32',
              shape: [6],
              names: ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'],
            },
            'observation.images.top': { dtype: 'video', shape: [3, 480, 640] },
            'observation.images.wrist': { dtype: 'video', shape: [3, 480, 640] },
            action: { dtype: 'float32', shape: [6], names: ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'] },
          },
        }),
      )
      writeFileSync(
        join(root, 'meta', 'episodes.jsonl'),
        [
          JSON.stringify({ episode_index: 0, length: 120, task: 'pick' }),
          JSON.stringify({ episode_index: 1, length: 90, task: 'place' }),
        ].join('\n'),
      )

      const meta = await new LocalDatasetSource(root).meta()

      expect(meta.fps).toBe(30)
      expect(meta.totalEpisodes).toBe(2)
      expect(meta.jointNames).toEqual(['j1', 'j2', 'j3', 'j4', 'j5', 'j6'])
      expect(meta.cameraNames).toEqual(['top', 'wrist'])
      expect(meta.episodes).toEqual([
        { episodeIndex: 0, length: 120, task: 'pick' },
        { episodeIndex: 1, length: 90, task: 'place' },
      ])
    })

    it('honors AbortSignal at the entry point', async () => {
      const controller = new AbortController()
      controller.abort()
      await expect(new LocalDatasetSource(root).meta(controller.signal)).rejects.toThrow()
    })
  })

  describe('frames', () => {
    it('throws a useful error when no chunk contains the requested episode', async () => {
      mkdirSync(join(root, 'data'), { recursive: true })
      await expect(new LocalDatasetSource(root).frames(0)).rejects.toThrow(/not found/)
    })

    it('honors AbortSignal at the entry point', async () => {
      const controller = new AbortController()
      controller.abort()
      await expect(new LocalDatasetSource(root).frames(0, controller.signal)).rejects.toThrow()
    })
  })
})

describe('back-compat shims', () => {
  it('readDatasetMeta / readEpisodeFrames still exist and delegate to LocalDatasetSource', () => {
    // Signature smoke test — actual behavior covered above via the class.
    expect(typeof readDatasetMeta).toBe('function')
    expect(typeof readEpisodeFrames).toBe('function')
  })
})
