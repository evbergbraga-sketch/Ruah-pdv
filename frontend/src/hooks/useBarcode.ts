/**
 * useBarcode — Leitor de código de barras
 *
 * Dois modos:
 *  1. Câmera: usa @zxing/library (BrowserMultiFormatReader)
 *  2. USB: leitores USB emulam teclado — capturamos via keydown global
 *     com debounce de 80ms (leitura completa quando para de digitar)
 *
 * Uso:
 *   const { iniciarCamera, pararCamera, ultimoCodigo, erro } = useBarcode(onScan)
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export type OnScanFn = (codigo: string) => void

export function useBarcode(onScan: OnScanFn) {
  const [ativo, setAtivo]           = useState(false)
  const [erro, setErro]             = useState<string | null>(null)
  const [ultimoCodigo, setUltimo]   = useState<string | null>(null)
  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const readerRef  = useRef<unknown>(null)
  const bufRef     = useRef('')
  const timerRef   = useRef<ReturnType<typeof setTimeout>>()

  // ── Modo câmera (ZXing) ───────────────────────────────────────
  const iniciarCamera = useCallback(async (videoEl: HTMLVideoElement) => {
    setErro(null)
    videoRef.current = videoEl
    try {
      // Importação dinâmica — não bloqueia o bundle inicial
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      await reader.decodeFromVideoDevice(
        undefined, // usa câmera padrão (traseira em mobile)
        videoEl,
        (result, err) => {
          if (result) {
            const codigo = result.getText()
            setUltimo(codigo)
            beep()
            onScan(codigo)
          }
          // err esperado entre frames — ignoramos
        }
      )
      setAtivo(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar câmera'
      if (msg.includes('Permission') || msg.includes('permission')) {
        setErro('Permissão de câmera negada. Use a aba Leitor USB.')
      } else {
        setErro('Câmera não disponível. Use a aba Leitor USB.')
      }
    }
  }, [onScan])

  const pararCamera = useCallback(() => {
    const reader = readerRef.current as { reset?: () => void } | null
    reader?.reset?.()
    readerRef.current = null
    setAtivo(false)
  }, [])

  // ── Modo USB (keydown global) ─────────────────────────────────
  // Leitores USB digitam o código muito rápido + Enter
  // Detectamos pela velocidade: se < 80ms entre teclas = leitor
  const ultimaKeyRef = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignora quando o foco está em campos de texto normais
      const tag = (e.target as HTMLElement).tagName
      const isInput = ['INPUT','TEXTAREA','SELECT'].includes(tag)

      const agora = Date.now()
      const delta = agora - ultimaKeyRef.current
      ultimaKeyRef.current = agora

      if (e.key === 'Enter') {
        const codigo = bufRef.current.trim()
        bufRef.current = ''
        clearTimeout(timerRef.current)
        if (codigo.length >= 3) {
          setUltimo(codigo)
          beep()
          onScan(codigo)
        }
        return
      }

      // Caractere normal — acumula no buffer
      if (e.key.length === 1) {
        // Se veio muito rápido (< 80ms) ou buffer já tem conteúdo = leitor USB
        // Se veio devagar = usuário digitando manualmente em campo
        if (delta < 80 || bufRef.current.length > 0) {
          if (!isInput) e.preventDefault() // não poluir outros campos
          bufRef.current += e.key
          clearTimeout(timerRef.current)
          // Se parar de digitar por 120ms = leitura completa
          timerRef.current = setTimeout(() => {
            const codigo = bufRef.current.trim()
            bufRef.current = ''
            if (codigo.length >= 3) {
              setUltimo(codigo)
              beep()
              onScan(codigo)
            }
          }, 120)
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(timerRef.current)
    }
  }, [onScan])

  return { iniciarCamera, pararCamera, ativo, erro, ultimoCodigo }
}

// Beep sonoro no scan
function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 1760
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(); osc.stop(ctx.currentTime + 0.12)
  } catch { /* sem som em contexto sem interação */ }
}
