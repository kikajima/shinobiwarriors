// ============================================================
// Shinobi Online — controlador de entrada
// Teclado + mouse (desktop) e joystick virtual + botões (mobile)
// ============================================================

'use client'

export interface InputState {
  moveX: number
  moveY: number
  // mira (em coords de tela do canvas)
  aimX: number
  aimY: number
  hasMouseAim: boolean
  // ações disparadas (consumidas pelo engine)
  attackHeld: boolean
}

export type ActionListener = (action: 'attack' | 'skill0' | 'skill1' | 'skill2' | 'skill3' | 'potion' | 'interact') => void

export class InputController {
  state: InputState = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    hasMouseAim: false,
    attackHeld: false,
  }
  enabled = true
  onAction: ActionListener | null = null

  private keys = new Set<string>()
  private canvas: HTMLCanvasElement | null = null
  private lastMouseMove = 0
  private joystickVec = { x: 0, y: 0 }
  private bound = false

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    if (this.bound) return
    this.bound = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    canvas.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  detach() {
    if (!this.bound) return
    this.bound = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.canvas?.removeEventListener('mousemove', this.onMouseMove)
    this.canvas?.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas?.removeEventListener('contextmenu', this.onContextMenu)
  }

  private onContextMenu = (e: Event) => e.preventDefault()

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return
    const target = e.target as HTMLElement
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === ' ' || k === 'j') {
      e.preventDefault()
      this.state.attackHeld = true
      this.onAction?.('attack')
    }
    if (k === '1') this.onAction?.('skill0')
    if (k === '2') this.onAction?.('skill1')
    if (k === '3') this.onAction?.('skill2')
    if (k === '4') this.onAction?.('skill3')
    if (k === 'q' || k === '5') this.onAction?.('potion')
    if (k === 'e') this.onAction?.('interact')
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.delete(k)
    if (k === ' ' || k === 'j') this.state.attackHeld = false
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas?.getBoundingClientRect()
    if (!rect) return
    this.state.aimX = e.clientX - rect.left
    this.state.aimY = e.clientY - rect.top
    this.state.hasMouseAim = true
    this.lastMouseMove = performance.now()
  }

  private onMouseDown = (e: MouseEvent) => {
    if (!this.enabled) return
    if (e.button !== 0) return
    this.state.attackHeld = true
    this.onAction?.('attack')
  }

  private onMouseUp = () => {
    this.state.attackHeld = false
  }

  /** joystick virtual (chamado pelo componente de touch) */
  setJoystick(x: number, y: number) {
    this.joystickVec.x = x
    this.joystickVec.y = y
  }

  /** mira automática: usado pelo engine quando não há mouse recente */
  hasRecentMouse(): boolean {
    return performance.now() - this.lastMouseMove < 3000 && this.state.hasMouseAim
  }

  /** computa vetor de movimento do frame */
  computeMove(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 }
    let x = this.joystickVec.x
    let y = this.joystickVec.y
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }

  clearKeys() {
    this.keys.clear()
    this.state.attackHeld = false
    this.joystickVec.x = 0
    this.joystickVec.y = 0
  }
}
