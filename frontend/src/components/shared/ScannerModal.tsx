import { useRef, useState, useEffect } from 'react'
import { useBarcode } from '../hooks/useBarcode'

interface ScannerModalProps {
  aberto: boolean
  contexto: 'pdv' | 'estoque'
  onCodigo: (codigo: string) => void
  onFechar: () => void
}

export function ScannerModal({ aberto, contexto, onCodigo, onFechar }: ScannerModalProps) {
  const [aba, setAba] = useState<'camera' | 'usb'>('camera')
  const [inputManual, setInputManual] = useState('')
  const videoEl = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { iniciarCamera, pararCamera, erro: erroCamera } = useBarcode((codigo) => {
    if (!aberto) return
    onCodigo(codigo)
    onFechar()
  })

  useEffect(() => {
    if (!aberto) { pararCamera(); return }
    if (aba === 'camera' && videoEl.current) iniciarCamera(videoEl.current)
    if (aba === 'usb') setTimeout(() => inputRef.current?.focus(), 100)
    return () => pararCamera()
  }, [aberto, aba])

  // Quando câmera falha, vai para USB automaticamente
  useEffect(() => {
    if (erroCamera) setAba('usb')
  }, [erroCamera])

  function trocarAba(nova: 'camera' | 'usb') {
    pararCamera()
    setAba(nova)
    setInputManual('')
  }

  function confirmarManual() {
    const cod = inputManual.trim()
    if (cod.length < 2) return
    onCodigo(cod)
    onFechar()
  }

  if (!aberto) return null

  const titulo = contexto === 'pdv'
    ? 'Escanear produto — Venda'
    : 'Escanear produto — Estoque'

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className="bg-[#131318] border border-[#2A2A38] rounded-2xl w-[520px] max-w-[95vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A38]">
          <h2 className="text-[15px] font-bold">📷 {titulo}</h2>
          <button
            onClick={onFechar}
            className="text-[#6B6985] hover:text-white text-xl leading-none transition-colors"
          >×</button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 px-4 py-3 border-b border-[#2A2A38]">
          {(['camera','usb'] as const).map(a => (
            <button
              key={a}
              onClick={() => trocarAba(a)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                aba === a
                  ? 'bg-[#3D1A25] border border-[#E8547A] text-[#E8547A]'
                  : 'bg-[#1A1A22] border border-[#2A2A38] text-[#A09EBB] hover:text-white'
              }`}
            >
              {a === 'camera' ? '📷 Câmera' : '🔌 Leitor USB / Manual'}
            </button>
          ))}
        </div>

        {/* Câmera */}
        {aba === 'camera' && (
          <div>
            <div className="relative bg-black h-56 overflow-hidden">
              <video
                ref={videoEl}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Frame de mira */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-24 relative" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}>
                  {/* Cantos */}
                  {[['top-0 left-0','border-t-2 border-l-2'],
                    ['top-0 right-0','border-t-2 border-r-2'],
                    ['bottom-0 left-0','border-b-2 border-l-2'],
                    ['bottom-0 right-0','border-b-2 border-r-2']
                  ].map(([pos, cls]) => (
                    <div key={pos} className={`absolute ${pos} w-4 h-4 border-[#E8547A] rounded-sm ${cls}`} />
                  ))}
                  {/* Linha de scan animada */}
                  <div className="absolute left-0 right-0 h-0.5 bg-[#E8547A] shadow-[0_0_8px_#E8547A] animate-[scan_1.8s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-[#6B6985] py-3">
              Aponte a câmera para o código de barras — leitura automática
            </p>
          </div>
        )}

        {/* USB / Manual */}
        {aba === 'usb' && (
          <div className="flex flex-col items-center gap-4 px-6 py-6">
            <div className="text-5xl opacity-40">🔌</div>
            <p className="text-sm text-[#A09EBB] text-center leading-relaxed">
              Conecte seu leitor USB e passe o produto.<br />
              O código entra automaticamente.<br />
              <span className="text-[#6B6985] text-xs">Ou digite o código abaixo e pressione Enter</span>
            </p>
            <div className="w-full flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputManual}
                onChange={e => setInputManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmarManual()}
                placeholder="EAN ou código interno"
                className="flex-1 bg-[#1A1A22] border-2 border-[#E8547A] rounded-lg px-4 py-3
                           text-lg font-bold text-center tracking-widest font-mono outline-none
                           placeholder:text-[#6B6985] placeholder:text-sm placeholder:tracking-normal placeholder:font-sans"
              />
              <button
                onClick={confirmarManual}
                disabled={inputManual.trim().length < 2}
                className="px-4 py-3 bg-[#E8547A] text-white font-bold rounded-lg
                           disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#d44868] transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-[#6B6985]">
              💡 Leitores USB funcionam como teclado — o código aparece aqui automaticamente
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-[#2A2A38] justify-end">
          <button
            onClick={onFechar}
            className="px-5 py-2 rounded-lg border border-[#2A2A38] bg-transparent text-[#A09EBB]
                       text-sm font-semibold hover:border-[#E85454] hover:text-[#E85454] transition-colors"
          >
            Fechar  <span className="text-xs opacity-60 ml-1">[Esc]</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%,100% { top: 8px; }
          50%      { top: calc(100% - 10px); }
        }
      `}</style>
    </div>
  )
}
