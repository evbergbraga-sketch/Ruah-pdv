import { useRef, useState, useEffect, useCallback } from 'react'

interface ScannerModalProps {
  aberto: boolean
  contexto: 'pdv' | 'estoque'
  onCodigo: (codigo: string) => void
  onFechar: () => void
}

export function ScannerModal({ aberto, contexto, onCodigo, onFechar }: ScannerModalProps) {
  const [aba, setAba] = useState<'camera' | 'usb'>('usb')
  const [inputManual, setInputManual] = useState('')
  const [erroCamera, setErroCamera] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const pararCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const iniciarCamera = useCallback(async () => {
    setErroCamera('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setErroCamera('Câmera não disponível')
      setAba('usb')
    }
  }, [])

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
    onCodigo(cod)
    onFechar()
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
                  <div className="absolute inset-x-0 h-0.5 bg-rose animate-[scan_1.8s_ease-in-out_infinite]"
                    style={{ animation: 'scan 1.8s ease-in-out infinite' }} />
                </div>
              </div>
            </div>
            {erroCamera && <p className="text-center text-xs text-red py-3">{erroCamera}</p>}
            {!erroCamera && <p className="text-center text-xs text-txt3 py-3">Aponte para o código de barras</p>}
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
