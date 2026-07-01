-- ── 002: Super Admin ────────────────────────────────────────────
-- Painel master (Berg) para gerenciar todas as empresas (tenants):
-- criar empresa + admin, liberar features, definir limites de plano.

-- Super admins não pertencem a nenhum tenant — administram todos.
CREATE TABLE super_admins (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id    UUID UNIQUE NOT NULL,
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: mesmo padrão de "self_lookup" já usado em users — o backend
-- precisa consultar o próprio registro antes de ter qualquer contexto
-- de tenant. Como super_admins não tem tenant_id, é uma leitura livre
-- de SELECT (o filtro por auth_id sempre vem da app, nunca do cliente).
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_lookup ON super_admins FOR SELECT USING (true);

-- Features e limites por empresa. Ficam direto em `tenants` (tabela
-- sem RLS habilitado) para consulta simples sem bypass de segurança.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS limite_usuarios       INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS permite_crm           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permite_mensagens     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_cupom_fiscal  BOOLEAN NOT NULL DEFAULT false;

-- Função com bypass de RLS mínimo e auditável: apenas conta usuários
-- por tenant, e apenas se o chamador for um super_admin cadastrado.
-- Não expõe nenhum dado além da contagem.
CREATE OR REPLACE FUNCTION superadmin_contagem_usuarios(p_auth_id UUID)
RETURNS TABLE(tenant_id UUID, qtd_usuarios BIGINT) AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE auth_id = p_auth_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY SELECT u.tenant_id, COUNT(*) FROM users u GROUP BY u.tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
