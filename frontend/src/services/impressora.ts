/**
 * Impressora Bematech MP-4200 TH / Pos-80 via WebUSB
 * Chrome/Edge apenas
 */

const ESC = 0x1b, GS = 0x1d, LF = 0x0a

const VENDORS = [
  { vendorId: 0x0B1B }, // Bematech
  { vendorId: 0x0DD4 }, // Elgin
  { vendorId: 0x04B8 }, // Epson
]

export class Impressora {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private device: any = null
  private endpoint: number | null = null
  private buf: number[] = []

  get conectada() { return this.device !== null }

  async conectar(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usb = (navigator as any).usb
    if (!usb) throw new Error('WebUSB não suportado. Use Chrome ou Edge.')
    this.device = await usb.requestDevice({ filters: VENDORS })
    await this.device.open()
    if (this.device.configuration === null) await this.device.selectConfiguration(1)
    await this.device.claimInterface(0)
    const ep = this.device.configuration.interfaces[0].alternate.endpoints
      .find((e: { direction: string }) => e.direction === 'out')
    if (!ep) throw new Error('Endpoint não encontrado')
    this.endpoint = ep.endpointNumber
  }

  async desconectar() {
    if (this.device) { await this.device.close(); this.device = null; this.endpoint = null }
  }

  private c(...b: number[]) { this.buf.push(...b); return this }
  init()   { return this.c(ESC, 0x40) }
  lf(n=1)  { for(let i=0;i<n;i++) this.buf.push(LF); return this }
  text(s: string) { for(const ch of s) this.buf.push(ch.charCodeAt(0)); return this }
  line(s: string) { return this.text(s).lf() }
  align(a: 'left'|'center'|'right') { return this.c(ESC,0x61,{left:0,center:1,right:2}[a]) }
  bold(on: boolean) { return this.c(ESC,0x45,on?1:0) }
  double(on: boolean) { return this.c(GS,0x21,on?0x11:0x00) }
  sep(ch='-',n=42) { return this.line(ch.repeat(n)) }
  cut() { return this.c(GS,0x56,0) }

  async print(): Promise<void> {
    if (!this.device || this.endpoint === null) throw new Error('Impressora não conectada')
    await this.device.transferOut(this.endpoint, new Uint8Array(this.buf))
    this.buf = []
  }
}

export const impressora = new Impressora()
