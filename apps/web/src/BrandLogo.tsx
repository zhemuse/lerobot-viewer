interface BrandLogoProps {
  className?: string
  decorative?: boolean
  showWordmark?: boolean
}

export function BrandLogo({ className, decorative = false, showWordmark = false }: BrandLogoProps) {
  return (
    <span className={className}>
      <img
        className="brand-logo-mark"
        src="/lerobot-viewer/lerobot-viewer-lv-logo-v2.png"
        alt={decorative ? '' : 'LeRobot Viewer'}
        aria-hidden={decorative || undefined}
      />
      {showWordmark && (
        <span className="brand-logo-wordmark">
          LEROBOT <b>VIEWER</b>
        </span>
      )}
    </span>
  )
}
