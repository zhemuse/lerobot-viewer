import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from './BrandLogo'

describe('BrandLogo', () => {
  it('renders the LV mark beside the Landing wordmark', () => {
    const markup = renderToStaticMarkup(<BrandLogo showWordmark />)

    expect(markup).toContain('src="/lerobot-viewer/lerobot-viewer-lv-logo-v2.png"')
    expect(markup).toContain('alt="LeRobot Viewer"')
    expect(markup).toContain('LEROBOT <b>VIEWER</b>')
  })
})
