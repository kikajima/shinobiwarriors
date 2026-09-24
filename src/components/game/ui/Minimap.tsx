// ============================================================
// Shinobi Online — minimapa
// ============================================================

'use client'

import { useEffect, useRef } from 'react'
import type { GameEngine } from '../engine'

export interface MinimapProps {
  engine: GameEngine | null
}

export function Minimap({ engine }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!engine) return
    let raf = 0
    let last = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (t - last < 250) return
      last = t
      const c = canvasRef.current
      if (c) engine.renderMinimap(c)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  return (
    <div className="pointer-events-none absolute right-2 top-[64px] z-20 sm:right-3 sm:top-[72px]">
      <div className="border-2 border-[#3a2f22] bg-[#0f0d0a] p-[3px] shadow-[3px_3px_0_rgba(0,0,0,0.5)]">
        <canvas ref={canvasRef} width={128} height={128} className="h-[96px] w-[96px] image-pixel sm:h-[128px] sm:w-[128px]" aria-label="Minimapa" />
      </div>
    </div>
  )
}
