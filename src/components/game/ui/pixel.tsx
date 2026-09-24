'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface PixelPanelProps {
  children: ReactNode
  className?: string
  title?: string
}

/**
 * Painel pixel-art reutilizável: carvão escuro, borda sólida 2px,
 * sombra offset estilo 32-bit, cantos retos.
 * Se `title` for passado, renderiza cabeçalho .font-pixel com
 * linha inferior pontilhada (cor pergaminho).
 */
export function PixelPanel({ children, className, title }: PixelPanelProps) {
  return (
    <div
      className={cn(
        'rounded-none border-2 border-[#3a2f22] bg-[#1a1410] p-3 shadow-[4px_4px_0_rgba(0,0,0,0.5)]',
        className,
      )}
    >
      {title ? (
        <div className="mb-3 border-b border-dotted border-[#3a2f22] pb-2">
          <h2 className="font-pixel text-[10px] tracking-wider text-[#e8d5a9]">{title}</h2>
        </div>
      ) : null}
      {children}
    </div>
  )
}
