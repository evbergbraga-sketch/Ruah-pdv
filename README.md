# PDV SaaS 🛍️

PDV web multi-tenant com leitor de barcode (câmera + USB), impressão térmica Bematech/Pos-80 e NFC-e via Focus NFe.

## Setup

```bash
cp .env.example .env
# edite .env com suas credenciais

docker compose up
```

| Serviço  | URL |
|---|---|
| Frontend PDV | http://localhost:3010 |
| API Backend  | http://localhost:8010 |
| Health check | http://localhost:8010/health |

## Impressora

Bematech MP-4200 TH / Pos-80 via **WebUSB** — sem driver.
Requer Chrome ou Edge. Na primeira venda, o browser pede permissão de acesso à USB.

## NFC-e

Configurada em **homologação** por padrão (notas não têm validade fiscal).
Quando a cliente tiver o certificado digital A1, mudar `FOCUS_NFE_AMBIENTE=producao` no `.env`.

## Leitor de barcode

- **Câmera:** usa ZXing — aponte para o produto, lê automaticamente
- **USB:** leitores USB funcionam como teclado — código vai direto para o carrinho
- Atalho: **F3** abre o scanner de qualquer tela

## Estrutura

```
pdv/
├── backend/src/
│   ├── db/migrations/   # Schema SQL + seed
│   ├── modules/pdv/     # Busca produto, criar venda
│   ├── modules/caixa/   # Abertura, fechamento, sangria
│   └── modules/fiscal/  # NFC-e Focus NFe
├── frontend/src/
│   ├── services/impressora.ts   # ESC/POS Bematech WebUSB
│   ├── hooks/useBarcode.ts      # Câmera + USB
│   └── components/shared/ScannerModal.tsx
├── docker-compose.yml
└── .env.example
```
