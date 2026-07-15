'use client'
import { Grid } from '@react-three/drei'

export type SceneMode = 'light' | 'dark'

const BRAND = { light: '#5B3EFF', dark: '#7F77DD' }

export default function SceneEnvironment({ mode = 'light' }: { mode?: SceneMode }) {
  return (
    <>
      {/* ambient keeps shadows from going fully black */}
      <ambientLight intensity={mode === 'dark' ? 1.2 : 0.8} />
      {/* key light from upper-front-left */}
      <directionalLight
        position={[3, 6, 4]}
        intensity={mode === 'dark' ? 2.0 : 1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {/* fill light from the right to soften hard shadows */}
      <directionalLight position={[-3, 3, -2]} intensity={mode === 'dark' ? 0.8 : 0.5} />
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor={BRAND[mode]}
        sectionSize={50}
        sectionThickness={0}
        sectionColor={BRAND[mode]}
        fadeDistance={52}
        fadeStrength={1}
        followCamera={false}
      />
    </>
  )
}
