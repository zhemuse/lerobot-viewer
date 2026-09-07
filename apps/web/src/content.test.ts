import { describe, expect, it } from 'vitest'
import viteConfig from '../vite.config'
import { defaultLanguage, features, languages, links, otherLanguage, translations } from './content'

describe('LeRobot Viewer website configuration', () => {
  it('keeps the GitHub Pages base path in step with the repository name', () => {
    // The deployed site lives at https://zhemuse.github.io/lerobot-viewer/, so every
    // asset URL has to be prefixed with the repo name or the page 404s on Pages.
    expect(viteConfig.base).toBe('/lerobot-viewer/')
  })

  it('points the download and source links at the public project', () => {
    expect(links.github).toBe('https://github.com/zhemuse/lerobot-viewer')
    expect(links.releases).toBe('https://github.com/zhemuse/lerobot-viewer/releases')
  })

  it('presents the four core desktop viewer capabilities', () => {
    expect(features).toHaveLength(4)
    expect(features.map((feature) => feature.id)).toEqual(['sync', 'trace', 'replay', 'quality'])
  })
})

describe('website translations', () => {
  it('defaults to Chinese and toggles between the two languages', () => {
    expect(defaultLanguage).toBe('zh')
    expect(otherLanguage('zh')).toBe('en')
    expect(otherLanguage('en')).toBe('zh')
  })

  it('translates every capability into every language', () => {
    for (const language of languages) {
      for (const feature of features) {
        const item = translations[language].features.items[feature.id]
        expect(item.a.length, `${language}/${feature.id} title`).toBeGreaterThan(0)
        expect(item.b.length, `${language}/${feature.id} description`).toBeGreaterThan(0)
      }
    }
  })

  it('gives each language a full set of prose, with no copy shared by accident', () => {
    for (const language of languages) {
      const t = translations[language]
      expect(t.features.intro).toHaveLength(2)
      for (const value of [t.heroLede, t.manifesto.body, t.loop.body]) {
        expect(value.length).toBeGreaterThan(0)
      }
    }
    expect(translations.zh.heroHeadline.a).not.toBe(translations.en.heroHeadline.a)
    expect(translations.zh.heroLede).not.toBe(translations.en.heroLede)
    expect(translations.zh.manifesto.headline.b).not.toBe(translations.en.manifesto.headline.b)
    expect(translations.zh.loop.headline.b).not.toBe(translations.en.loop.headline.b)
  })
})
