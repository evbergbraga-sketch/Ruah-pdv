import { useEffect, useRef } from 'react'

export type OnScanFn = (codigo: string) => void

export function useBarcode(onScan: OnScanFn, ativo = true) {
  const bufRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const ultimaKeyRef = useRef(0)

  useEffect(() => {
    if (!ativo) return

    const onKey = (e: KeyboardEvent) => {
      const agora = Date.now()
      const delta = agora - ultimaKeyRef.current
      ultimaKeyRef.current = agora

      if (e.key === 'Enter') {
        const codigo = bufRef.current.trim()
        bufRef.current = ''
        clearTimeout(timerRef.current)
        if (codigo.length >= 3) {
          beep()
          onScan(codigo)
        }
        return
      }

      if (e.key.length === 1 && (delta < 80 || bufRef.current.length > 0)) {
        const tag = (e.target as HTMLElement).tagName
        if (!['INPUT', 'TEXTAREA'].includes(tag)) e.preventDefault()
        bufRef.current += e.key
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          const codigo = bufRef.current.trim()
          bufRef.current = ''
          if (codigo.length >= 3) {
            beep()
            onScan(codigo)
          }
        }, 120)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(timerRef.current)
    }
  }, [onScan, ativo])
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 1760
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.start(); osc.stop(ctx.currentTime + 0.1)
  } catch { /* sem som */ }
}
