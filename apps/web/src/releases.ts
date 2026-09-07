/**
 * The page seeds the version from the desktop app's package.json (injected at build
 * time) so it renders instantly and without JS, then refreshes from the GitHub API on
 * mount — that way publishing a release updates the site with no redeploy.
 */
export const seedVersion = `v${__APP_VERSION__}`

const latestReleaseApi = 'https://api.github.com/repos/zhemuse/lerobot-viewer/releases/latest'

/**
 * Resolves to the newest published tag, or null when there is nothing to show —
 * no releases yet (404), a rate-limited IP (403), or an offline visitor. Callers
 * keep the seed in that case rather than surfacing an error to the reader.
 */
export async function fetchLatestVersion(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(latestReleaseApi, {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return null
    const release: { tag_name?: string; draft?: boolean } = await response.json()
    if (release.draft || !release.tag_name) return null
    return release.tag_name
  } catch {
    return null
  }
}
