import { useRef, useState, useEffect, useCallback } from 'react'

interface ScannerModalProps {
  aberto: boolean
  contexto: 'pdv' | 'estoque'
  onCodigo: (codigo: string) => void
  onFechar: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BarcodeDetectorType = any

export function ScannerModal({ aberto, contexto, onCodigo, onFechar }: ScannerModalProps) {
  const [aba, setAba] = useState<'camera' | 'usb'>('camera')
  const [inputManual, setInputManual] = useState('')
  const [erroCamera, setErroCamera] = useState('')
  const [suporteNativo, setSuporteNativo] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorType>(null)
  const rafRef = useRef<number>()
  const lidoRef = useRef(false)

  const pararCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    lidoRef.current = false
  }, [])

  const handleLeitura = useCallback((codigo: string) => {
    if (lidoRef.current) return
    lidoRef.current = true
    beep()
    onCodigo(codigo)
    onFechar()
  }, [onCodigo, onFechar])

  // Loop de detecção usando BarcodeDetector nativo (Chrome/Edge)
  const loopDeteccao = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || lidoRef.current) return
    try {
      const codes = await detectorRef.current.detect(videoRef.current)
      if (codes.length > 0) {
        handleLeitura(codes[0].rawValue)
        return
      }
    } catch {
      // frame ainda não pronto, ignora
    }
    rafRef.current = requestAnimationFrame(loopDeteccao)
  }, [handleLeitura])

  const iniciarCamera = useCallback(async () => {
    setErroCamera('')
    lidoRef.current = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (!win.BarcodeDetector) {
      setSuporteNativo(false)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      if (win.BarcodeDetector) {
        detectorRef.current = new win.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
        })
        rafRef.current = requestAnimationFrame(loopDeteccao)
      }
    } catch (e) {
      const err = e as Error
      setErroCamera(
        err.name === 'NotAllowedError'
          ? 'Permissão de câmera negada'
          : 'Câmera não disponível neste dispositivo'
      )
      setAba('usb')
    }
  }, [loopDeteccao])

  useEffect(() => {
    if (!aberto) { pararCamera(); return }
    if (aba === 'camera') iniciarCamera()
    else setTimeout(() => inputRef.current?.focus(), 100)
    return pararCamera
  }, [aberto, aba, iniciarCamera, pararCamera])

  function trocarAba(nova: 'camera' | 'usb') {
    pararCamera()
    setAba(nova)
    setInputManual('')
  }

  function confirmar() {
    const cod = inputManual.trim()
    if (cod.length < 2) return
    handleLeitura(cod)
  }

  if (!aberto) return null

  const titulo = contexto === 'pdv' ? 'Escanear — Venda' : 'Escanear — Estoque'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="bg-bg2 border border-border rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-bold">📷 {titulo}</h2>
          <button onClick={onFechar} className="text-txt3 hover:text-txt text-xl leading-none transition-colors">×</button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 px-4 py-3 border-b border-border">
          {(['camera', 'usb'] as const).map(a => (
            <button key={a} onClick={() => trocarAba(a)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                aba === a ? 'bg-rose-dim border border-rose text-rose' : 'bg-bg3 border border-border text-txt2'
              }`}>
              {a === 'camera' ? '📷 Câmera' : '🔌 Leitor USB / Manual'}
            </button>
          ))}
        </div>

        {/* Câmera */}
        {aba === 'camera' && (
          <div>
            <div className="relative bg-black h-52 overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-20 border-2 border-rose rounded-lg relative"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
                  <div className="absolute inset-x-0 h-0.5 bg-rose"
                    style={{ animation: 'scan 1.8s ease-in-out infinite' }} />
                </div>
              </div>
            </div>
            {erroCamera ? (
              <p className="text-center text-xs text-red py-3">{erroCamera}</p>
            ) : !suporteNativo ? (
              <p className="text-center text-xs text-gold py-3">
                Seu navegador não decodifica código de barras automaticamente.<br />Use a aba Leitor USB.
              </p>
            ) : (
              <p className="text-center text-xs text-txt3 py-3">Aponte para o código de barras</p>
            )}
          </div>
        )}

        {/* USB / Manual */}
        {aba === 'usb' && (
          <div className="flex flex-col items-center gap-4 px-6 py-6">
            <div className="text-4xl opacity-30">🔌</div>
            <p className="text-sm text-txt2 text-center leading-relaxed">
              Conecte seu leitor USB e passe o produto.<br />
              <span className="text-txt3 text-xs">Ou digite o código abaixo</span>
            </p>
            <div className="w-full flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputManual}
                onChange={e => setInputManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmar()}
                placeholder="EAN ou código interno"
                className="flex-1 bg-bg3 border-2 border-rose rounded-lg px-4 py-3 text-lg font-bold text-center tracking-widest font-mono text-txt outline-none placeholder:text-txt3 placeholder:text-sm placeholder:tracking-normal placeholder:font-sans"
              />
              <button onClick={confirmar} disabled={inputManual.trim().length < 2}
                className="px-4 py-3 bg-rose text-white font-bold rounded-lg disabled:opacity-40 hover:bg-rose/90 transition-colors">
                OK
              </button>
            </div>
            <p className="text-xs text-txt3">💡 Leitores USB digitam o código automaticamente</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-border justify-end">
          <button onClick={onFechar}
            className="px-5 py-2 rounded-lg border border-border text-sm font-semibold text-txt2 hover:text-red hover:border-red transition-colors">
            Fechar <span className="text-xs opacity-50 ml-1 font-mono">[Esc]</span>
          </button>
        </div>
      </div>

      <style>{`@keyframes scan { 0%,100%{top:8px} 50%{top:calc(100% - 10px)} }`}</style>
    </div>
  )
}

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
  } catch { /* sem som */ }
}
