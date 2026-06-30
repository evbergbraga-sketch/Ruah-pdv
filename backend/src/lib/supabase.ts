import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

// Node 20 não tem WebSocket nativo (chegou só no Node 22).
// O SDK do Supabase instancia um RealtimeClient sempre, incondicionalmente,
// no construtor do SupabaseClient — não existe flag para desabilitar isso.
// Por isso fornecemos o polyfill globalmente antes de criar o client.
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = WebSocket
}

// Cliente único compartilhado entre todos os módulos.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
)
