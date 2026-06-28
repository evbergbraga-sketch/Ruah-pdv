-- PDV SaaS — Schema definitivo
-- PostgreSQL 16 · Multi-tenant via RLS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── tenants ──────────────────────────────────────────────────
CREATE TABLE tenants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT NOT NULL,
  cnpj         TEXT UNIQUE NOT NULL,
  razao_social TEXT NOT NULL,
  email        TEXT NOT NULL,
  telefone     TEXT,
  endereco     JSONB DEFAULT '{}',
  logo_url     TEXT,
  plano        TEXT NOT NULL DEFAULT 'basico',
  ativo        BOOLEAN NOT NULL DEFAULT true,
  -- Config Focus NFe por tenant
  focus_token          TEXT,
  focus_ambiente       TEXT NOT NULL DEFAULT 'homologacao',
  nfce_serie           INTEGER NOT NULL DEFAULT 1,
  nfce_proximo_numero  INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── users ────────────────────────────────────────────────────
CREATE TABLE users (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_id   UUID UNIQUE,
  nome      TEXT NOT NULL,
  email     TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'operador', -- admin|gerente|operador
  ativo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- ── categorias ───────────────────────────────────────────────
CREATE TABLE categorias (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  cor       TEXT DEFAULT '#6B6985',
  ativo     BOOLEAN NOT NULL DEFAULT true
);

-- ── produtos ─────────────────────────────────────────────────
CREATE TABLE produtos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id),
  ean          TEXT,           -- código de barras
  codigo       TEXT,           -- código interno
  nome         TEXT NOT NULL,
  descricao    TEXT,
  foto_url     TEXT,
  preco_custo  NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_venda  NUMERIC(12,2) NOT NULL,
  unidade      TEXT NOT NULL DEFAULT 'UN',
  -- Fiscal NFC-e
  ncm          TEXT NOT NULL DEFAULT '33049900', -- cosméticos
  cfop         TEXT NOT NULL DEFAULT '5102',
  cst          TEXT NOT NULL DEFAULT '400',
  aliq_icms    NUMERIC(5,2) NOT NULL DEFAULT 0,
  aliq_pis     NUMERIC(5,2) NOT NULL DEFAULT 0,
  aliq_cofins  NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Controle
  estoque_minimo INTEGER NOT NULL DEFAULT 5,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, ean),
  UNIQUE(tenant_id, codigo)
);

CREATE INDEX idx_produtos_busca ON produtos
  USING gin((nome || ' ' || COALESCE(ean,'') || ' ' || COALESCE(codigo,'')) gin_trgm_ops);

-- ── estoque ──────────────────────────────────────────────────
CREATE TABLE estoque (
  produto_id  UUID PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quantidade  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE estoque_movimentos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produto_id  UUID NOT NULL REFERENCES produtos(id),
  tipo        TEXT NOT NULL, -- entrada|saida|venda|ajuste|devolucao
  quantidade  INTEGER NOT NULL,
  qtd_antes   INTEGER NOT NULL,
  venda_id    UUID,
  user_id     UUID REFERENCES users(id),
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── clientes ─────────────────────────────────────────────────
CREATE TABLE clientes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  cpf             TEXT,
  email           TEXT,
  telefone        TEXT,
  data_nascimento DATE,
  tags            TEXT[] DEFAULT '{}',
  total_gasto     NUMERIC(12,2) NOT NULL DEFAULT 0,
  qtd_compras     INTEGER NOT NULL DEFAULT 0,
  ultima_compra   TIMESTAMPTZ,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, cpf),
  UNIQUE(tenant_id, telefone)
);

CREATE INDEX idx_clientes_busca ON clientes
  USING gin((nome || ' ' || COALESCE(cpf,'') || ' ' || COALESCE(telefone,'')) gin_trgm_ops);

-- ── caixas ───────────────────────────────────────────────────
CREATE TABLE caixas (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_abertura_id   UUID NOT NULL REFERENCES users(id),
  user_fechamento_id UUID REFERENCES users(id),
  valor_abertura     NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_fechamento   NUMERIC(12,2),
  valor_esperado     NUMERIC(12,2),
  diferenca          NUMERIC(12,2),
  status             TEXT NOT NULL DEFAULT 'aberto', -- aberto|fechado
  observacoes        TEXT,
  aberto_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fechado_em         TIMESTAMPTZ
);

CREATE TABLE caixa_movimentos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  caixa_id    UUID NOT NULL REFERENCES caixas(id),
  tipo        TEXT NOT NULL, -- suprimento|sangria
  valor       NUMERIC(12,2) NOT NULL,
  descricao   TEXT,
  user_id     UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── vendas ───────────────────────────────────────────────────
CREATE SEQUENCE venda_numero_seq START 1;

CREATE TABLE vendas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  caixa_id        UUID REFERENCES caixas(id),
  cliente_id      UUID REFERENCES clientes(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  numero          BIGINT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'finalizada', -- finalizada|cancelada
  subtotal        NUMERIC(12,2) NOT NULL,
  desconto_valor  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  troco           NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes     TEXT,
  cancelamento_motivo TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelada_em    TIMESTAMPTZ,
  UNIQUE(tenant_id, numero)
);

CREATE INDEX idx_vendas_tenant_data ON vendas(tenant_id, created_at DESC);

CREATE TABLE venda_itens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venda_id        UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES produtos(id),
  nome_produto    TEXT NOT NULL,    -- snapshot
  quantidade      NUMERIC(10,3) NOT NULL,
  preco_unitario  NUMERIC(12,2) NOT NULL,
  desconto_valor  NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) NOT NULL,
  ncm             TEXT,
  cfop            TEXT,
  cst             TEXT,
  aliq_icms       NUMERIC(5,2)
);

CREATE TABLE pagamentos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venda_id    UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  forma       TEXT NOT NULL, -- dinheiro|credito|debito|pix|voucher
  valor       NUMERIC(12,2) NOT NULL,
  bandeira    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── notas fiscais ─────────────────────────────────────────────
CREATE TABLE notas_fiscais (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venda_id     UUID NOT NULL REFERENCES vendas(id),
  numero       INTEGER NOT NULL,
  serie        INTEGER NOT NULL DEFAULT 1,
  chave_acesso TEXT,
  status       TEXT NOT NULL DEFAULT 'pendente', -- pendente|autorizada|cancelada|rejeitada
  xml          TEXT,
  danfe_url    TEXT,
  qrcode_url   TEXT,
  protocolo    TEXT,
  focus_ref    TEXT UNIQUE,
  motivo_rejeicao TEXT,
  emitida_em   TIMESTAMPTZ,
  cancelada_em TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── sequência de número de venda por tenant ──────────────────
CREATE TABLE venda_sequences (
  tenant_id     UUID PRIMARY KEY REFERENCES tenants(id),
  ultimo_numero BIGINT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_venda_number(p_tenant UUID)
RETURNS BIGINT AS $$
DECLARE v BIGINT;
BEGIN
  INSERT INTO venda_sequences(tenant_id, ultimo_numero) VALUES(p_tenant, 1)
  ON CONFLICT(tenant_id) DO UPDATE
    SET ultimo_numero = venda_sequences.ultimo_numero + 1
  RETURNING ultimo_numero INTO v;
  RETURN v;
END;
$$ LANGUAGE plpgsql;

-- ── RLS ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN (current_setting('app.tenant_id', true))::UUID;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY[
  'users','categorias','produtos','estoque','estoque_movimentos',
  'clientes','caixas','caixa_movimentos','vendas','venda_itens',
  'pagamentos','notas_fiscais','venda_sequences'
]) LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('
    CREATE POLICY tenant_iso ON %I
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id())', t, t);
END LOOP; END $$;

-- ── Triggers: updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_tenants  BEFORE UPDATE ON tenants  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_produtos BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_clientes BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Trigger: baixa de estoque ao finalizar venda ─────────────
CREATE OR REPLACE FUNCTION fn_baixa_estoque() RETURNS TRIGGER AS $$
DECLARE item RECORD; qtd_atual INTEGER;
BEGIN
  FOR item IN SELECT vi.produto_id, vi.quantidade::INTEGER
              FROM venda_itens vi WHERE vi.venda_id = NEW.id
  LOOP
    SELECT quantidade INTO qtd_atual FROM estoque
    WHERE produto_id = item.produto_id;

    UPDATE estoque SET quantidade = quantidade - item.quantidade, updated_at = NOW()
    WHERE produto_id = item.produto_id;

    INSERT INTO estoque_movimentos(tenant_id, produto_id, tipo, quantidade, qtd_antes, venda_id)
    VALUES(NEW.tenant_id, item.produto_id, 'venda', -item.quantidade, qtd_atual, NEW.id);
  END LOOP;

  IF NEW.cliente_id IS NOT NULL THEN
    UPDATE clientes SET
      total_gasto  = total_gasto + NEW.total,
      qtd_compras  = qtd_compras + 1,
      ultima_compra = NOW()
    WHERE id = NEW.cliente_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_baixa_estoque
AFTER INSERT ON vendas
FOR EACH ROW EXECUTE FUNCTION fn_baixa_estoque();
