import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrandLogo } from './BrandLogo'
import {
  type FeatureId,
  features,
  type Language,
  languageLabels,
  languageStorageKey,
  links,
  otherLanguage,
  readStoredLanguage,
  translations,
} from './content'
import { fetchLatestVersion, seedVersion } from './releases'
import './styles.css'

const htmlLang: Record<Language, string> = { zh: 'zh-CN', en: 'en' }

function LinkArrow() {
  return (
    <span className="arrow" aria-hidden="true">
      ↗
    </span>
  )
}

function DownArrow() {
  return (
    <span className="arrow" aria-hidden="true">
      ↓
    </span>
  )
}

function GlobeIcon() {
  return (
    <svg className="globe" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" />
      <ellipse cx="8" cy="8" rx="2.7" ry="6.4" />
      <path d="M1.9 5.9h12.2M1.9 10.1h12.2" />
    </svg>
  )
}

function LanguageToggle({
  lang,
  onChange,
}: {
  lang: Language
  onChange: (next: Language) => void
}) {
  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => onChange(otherLanguage(lang))}
      aria-label={translations[lang].a11y.switchLanguage}
    >
      <GlobeIcon />
      {languageLabels[lang]}
    </button>
  )
}

function ReleaseBadge({ lang }: { lang: Language }) {
  const t = translations[lang].release
  const [version, setVersion] = useState(seedVersion)

  useEffect(() => {
    const controller = new AbortController()
    fetchLatestVersion(controller.signal).then((tag) => {
      if (tag) setVersion(tag)
    })
    return () => controller.abort()
  }, [])

  return (
    <div className="hero-release">
      <a className="release-pill" href={links.releases} target="_blank" rel="noreferrer">
        <i aria-hidden="true" />
        {t.latest}
        <span aria-hidden="true">·</span>
        <b>{version}</b>
      </a>
      <a className="release-all" href={links.releases} target="_blank" rel="noreferrer">
        {t.viewAll} <LinkArrow />
      </a>
    </div>
  )
}

function ViewerMockup({ lang }: { lang: Language }) {
  const [playing, setPlaying] = useState(false)
  const [frame, setFrame] = useState(26)
  return (
    <section className="viewer-mockup" aria-label={translations[lang].a11y.mockup}>
      <div className="mockup-toolbar">
        <span className="window-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="mockup-file">aloha_static_coffee / ep_017</span>
        <span className="mockup-mode">LOCAL DATASET</span>
      </div>
      <div className="mockup-body">
        <aside className="mockup-sidebar">
          <div className="side-brand">
            <BrandLogo className="side-brand-logo" decorative />
          </div>
          <div className="side-label">
            EPISODES <b>128</b>
          </div>
          {['ep_017', 'ep_018', 'ep_019', 'ep_020'].map((episode, index) => (
            <div className={`episode ${index === 0 ? 'current' : ''}`} key={episode}>
              <span>{episode}</span>
              <em>{index === 0 ? 'LIVE' : `${index + 2}.4s`}</em>
            </div>
          ))}
          <div className="side-footer">● LOCAL / READY</div>
        </aside>
        <div className="mockup-content">
          <div className="camera-grid">
            <div className="camera-view large">
              <span>cam_high</span>
              <div className="mini-scene">
                <b className="mini-table" />
                <b className="mini-cube" />
                <b className="mini-arm">
                  <i />
                  <i />
                  <i />
                </b>
                <b className="mini-cross" />
              </div>
            </div>
            <div className="camera-view">
              <span>wrist_L</span>
              <div className="mini-scene close">
                <b className="mini-hand" />
              </div>
            </div>
            <div className="camera-view">
              <span>wrist_R</span>
              <div className="mini-scene close">
                <b className="mini-target" />
              </div>
            </div>
          </div>
          <div className="mockup-chart">
            <div className="chart-top">
              <span>ACTION / STATE</span>
              <b>Δ 0.004</b>
            </div>
            <div className="chart-lines">
              <i />
              <i />
              <i />
              <b className="line-one" />
              <b className="line-two" />
            </div>
          </div>
          <div className="mockup-timeline">
            <div className="timeline-bars">
              <i />
              <i />
              <i />
              <b style={{ left: `${frame / 8.12}%` }} />
            </div>
            <div className="time-labels">
              <span>00:00</span>
              <span>00:04.3</span>
              <span>00:08.6</span>
              <span>00:12.9</span>
            </div>
            <button type="button" className="mock-play" onClick={() => setPlaying(!playing)}>
              {playing ? 'Ⅱ' : '▶'}
            </button>
            <span className="frame-label">FRAME {String(frame).padStart(4, '0')} / 0812</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mock-scrub"
        aria-label={translations[lang].a11y.scrub}
        onClick={() => setFrame((value) => (value >= 812 ? 26 : value + 103))}
      >
        <span>{playing ? 'PLAYING' : 'CLICK TO SCRUB'}</span>
        <b>→</b>
      </button>
    </section>
  )
}

function FeatureVisual({ id, active }: { id: FeatureId; active: boolean }) {
  if (id === 'sync')
    return (
      <div className="feature-visual sync-visual">
        <div className="stream-boxes">
          <span>cam_high</span>
          <span>wrist_L</span>
          <span>wrist_R</span>
        </div>
        <div className="stream-lines">
          <i />
          <i />
          <i />
          <b />
        </div>
        <small>video · action · state — frame aligned</small>
      </div>
    )
  if (id === 'trace')
    return (
      <div className={`feature-visual trace-visual ${active ? 'active' : ''}`}>
        <div className="trace-grid" />
        <div className="trace-path action" />
        <div className="trace-path state" />
        <div className="trace-deviation" />
        <small>
          action vs state <b>Δ deviation</b>
        </small>
      </div>
    )
  if (id === 'replay')
    return (
      <div className={`feature-visual replay-visual ${active ? 'active' : ''}`}>
        <div className="replay-meta">
          3D VIEWPORT <b>URDF: aloha</b>
        </div>
        <div className="floor-grid" />
        <div className="replay-arm">
          <i />
          <i />
          <i />
          <i />
          <em />
        </div>
        <div className="end-effector-path" />
        <small>
          JOINTS 07 · POSE 026 · <b>● LIVE</b>
        </small>
      </div>
    )
  return (
    <div className={`feature-visual quality-visual ${active ? 'active' : ''}`}>
      <div className="quality-meta">
        QUALITY REPORT <b>128 EPISODES</b>
      </div>
      {[
        ['ep_017', '96', 'good'],
        ['ep_042', '92', 'good'],
        ['ep_063', '58', 'warn'],
        ['ep_089', '31', 'bad'],
      ].map(([episode, score, type], index) => (
        <div className="quality-row" key={episode}>
          <span>{episode}</span>
          <i className={type} style={{ width: `${[92, 87, 58, 31][index]}%` }} />
          <b>{score}</b>
        </div>
      ))}
      <small>△ ep_089: camera occlusion 3.2s</small>
    </div>
  )
}

function App() {
  const [activeFeature, setActiveFeature] = useState<FeatureId>('sync')
  const [lang, setLang] = useState<Language>(readStoredLanguage)
  const t = translations[lang]

  useEffect(() => {
    document.documentElement.lang = htmlLang[lang]
    localStorage.setItem(languageStorageKey, lang)
  }, [lang])

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top">
          <BrandLogo className="brand-logo" showWordmark />
        </a>
        <nav>
          <a href="#features">{t.nav.capabilities}</a>
          <a href="#how-it-works">{t.nav.howItWorks}</a>
          <a href={links.github} target="_blank" rel="noreferrer">
            {t.nav.github} <LinkArrow />
          </a>
        </nav>
        <div className="header-actions">
          <LanguageToggle lang={lang} onChange={setLang} />
          <a className="header-download" href={links.releases} target="_blank" rel="noreferrer">
            {t.buttons.download} <LinkArrow />
          </a>
        </div>
      </header>
      <main>
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> DESKTOP DATA EXPLORER
            </p>
            <h1>
              {t.heroHeadline.a}
              <br />
              <em>{t.heroHeadline.b}</em>
            </h1>
            <p className="hero-lede">{t.heroLede}</p>
            <div className="hero-buttons">
              <a
                className="button button-primary"
                href={links.releases}
                target="_blank"
                rel="noreferrer"
              >
                {t.buttons.downloadApp} <LinkArrow />
              </a>
              <a
                className="button button-ghost"
                href={links.github}
                target="_blank"
                rel="noreferrer"
              >
                {t.buttons.source} <LinkArrow />
              </a>
            </div>
            <ReleaseBadge lang={lang} />
          </div>
          <div className="hero-visual">
            <div className="visual-caption">
              A BETTER WAY TO
              <br />
              <b>READ ROBOT DATA</b>
            </div>
            <ViewerMockup lang={lang} />
            <div className="visual-signal signal-one" />
            <div className="visual-signal signal-two" />
            <div className="visual-signal signal-three" />
          </div>
        </section>
        <section className="manifesto">
          <span className="section-kicker">THE IDEA</span>
          <h2>
            {t.manifesto.headline.a}
            <br />
            <em>{t.manifesto.headline.b}</em>
          </h2>
          <p>{t.manifesto.body}</p>
        </section>
        <section className="features-section" id="features">
          <div className="section-heading">
            <div>
              <span className="section-kicker">CORE CAPABILITIES</span>
              <h2>
                {t.features.headline.a}
                <br />
                <em>{t.features.headline.b}</em>
              </h2>
            </div>
            <p>
              {t.features.intro[0]}
              <br />
              {t.features.intro[1]}
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article
                className={`feature-card ${activeFeature === feature.id ? 'selected' : ''}`}
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
              >
                <span className="feature-label">{feature.label}</span>
                <FeatureVisual id={feature.id} active={activeFeature === feature.id} />
                <h3>{t.features.items[feature.id].a}</h3>
                <p>{t.features.items[feature.id].b}</p>
                <span className="feature-status">
                  {activeFeature === feature.id ? 'ACTIVE VIEW' : 'EXPLORE VIEW'} <LinkArrow />
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="loop-section" id="how-it-works">
          <span className="section-kicker">HOW TO USE</span>
          <div className="loop-grid">
            <h2>
              {t.loop.headline.a}
              <br />
              <em>{t.loop.headline.b}</em>
            </h2>
            <div className="loop-copy">
              <p>{t.loop.body}</p>
              <div className="loop-buttons">
                <a
                  className="button button-primary"
                  href={links.releases}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.buttons.downloadClient} <DownArrow />
                </a>
                <a
                  className="button button-ghost"
                  href={links.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.buttons.source} <LinkArrow />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer>
        <a className="brand" href="#top">
          <BrandLogo className="brand-logo" showWordmark />
        </a>
        <span>DATA SHOULD BE LEGIBLE.</span>
        <span>© 2026 / OPEN SOURCE</span>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
