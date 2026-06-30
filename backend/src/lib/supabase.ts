import { createClient } from '@supabase/supabase-js'

// Cliente único compartilhado entre todos os módulos.
// IMPORTANTE: persistSession e autoRefreshToken DEVEM ficar false —
// caso contrário o SDK tenta inicializar o Realtime (WebSocket),
// que não existe nativamente no Node 20 e derruba o processo
// com "Node.js detected but native WebSocket not found".
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
)
