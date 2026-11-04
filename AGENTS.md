<!-- bmad:context -->
<!-- Verified 2026-11-04 against workspace state (Módulo 1 concluído em backend/ e frontend/; Correct Course M2 aplicado: Core Salão :3000 + kds-service :3001 + caixa-service :3002 + gestao-service :3003; Fidelidade/Cashback fora do escopo v1). Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## vapt-pdv

VaptPDV: Ecossistema distribuído de Ponto de Venda e Atendimento de Salão (PDV Core), Cozinha/Bar (KDS), Frente de Caixa & Split Payment (`caixa-service`) e Gestão Executiva & Analytics/BI OLAP (`gestao-service`) para bares e lanchonetes (3ª Unidade de Sistemas Distribuídos — DCC/UERN). Arquitetura **Core Operacional de Salão (`vapt-pdv-core` em `:3000`, `vaptpdv_db`) + 3 Microsserviços Satélites (`kds-service` `:3001`/`kds_db`, `caixa-service` `:3002`/`caixa_db`, `gestao-service` `:3003`/`gestao_db`)** (`ADR-01`). Fidelidade/Cashback (`C14`) está explicitamente fora do escopo v1 (*Non-Goal*). Stack: Node.js >=20, TypeScript, Fastify 5, Prisma ORM, PostgreSQL 16, RabbitMQ 3.13, Docker Compose e Frontend Web/PWA (React 19, Vite, Tailwind CSS, TanStack Query, Zustand); deploy IaaS na AWS EC2. Contrato canônico vigente: `_bmad-output/specs/spec-vapt-pdv/SPEC.md` (derivado de `.memlog.md` + companions no frontmatter) e documentação completa em `docs/engenharia/`.

## Policy

- Leia `_bmad-output/specs/spec-vapt-pdv/SPEC.md`, seus companions e `.memlog.md` antes de implementar; divergência com o contrato se resolve atualizando a Spec via `/bmad-spec` (registrando no `.memlog.md`), nunca editando `SPEC.md` à mão.
- Nunca grave segredo, `DATABASE_URL` ou credencial no repositório; use variáveis de ambiente e mantenha `backend/.env.example` sem valores reais. Nunca versione `.env`.
- Nunca apague usuário ou produto fisicamente (`DELETE`); inative logicamente (`ativo = false` — `RN14`).
- Nunca use `Float`/`number` binário para cálculos ou saída de dinheiro; use `DECIMAL(10,2)` no PostgreSQL, `Prisma.Decimal` (`ROUND_HALF_UP`) no backend e string de 2 casas (`"14.90"`) na API (`RN15`).
- Nunca faça `git commit`, `git tag` ou `git push` sem pedido explícito do usuário. As tags (`entrega-1-cloud`, `entrega-2-microsservicos`, `entrega-3-containers`, `entrega-4-mensageria`) são criadas pelos discentes.
- Mantenha a estética do Frontend Web/PWA fiel a `docs/DESIGN.md` ("Mostarda `#F2A81D`, café `#2B2019` e creme `#FBF7F1`, sem neon e sem emoji", alvos de toque `>= 44x44px`, WCAG 2.2 AA).

## Where things are

- **Memória e retomada entre sessões/agentes:**
  - Visão geral humana/agente: `docs/STATUS.md`
  - Quadro de execução de stories e Loop: `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/specs/spec-vapt-pdv/stories.yaml` e `.bmad-loop/policy.toml`
  - Memória append-only canônica (`.memlog.md`): `_bmad-output/specs/spec-vapt-pdv/.memlog.md` (manipulada via `python3 _bmad/scripts/memlog.py`), além dos logs de iniciativa em `_bmad-output/initiative-vapt-pdv/`
  - Sempre atualize `docs/STATUS.md`, `sprint-status.yaml` e registre decisões relevantes no `.memlog.md` ao concluir ou alterar uma story.
- **Contratos e Documentação de Engenharia (`docs/engenharia/`):**
  - PRD & Escopo: `docs/engenharia/01-visao-e-escopo.md`
  - SRS (`RF01`–`RF34`, `RN01`–`RN24`, `RNF01`–`RNF12`): `docs/engenharia/02-especificacao-requisitos-srs.md`
  - ARD Parte 1 (`ASR-01`–`ASR-10`, C4 Níveis 1–4, Resiliência, Docker Compose, `ADR-01`–`ADR-12`): `docs/engenharia/03-arquitetura-c4-model.md`
  - ARD Parte 2 (DDD, DERs Físicos, DDL SQL dos 4 bancos, Concorrência `READ COMMITTED`): `docs/engenharia/04-modelo-dados-e-dominio.md`
  - ARD Parte 3 (Contratos REST `:3000`–`:3003`, Erros e Eventos AMQP `vaptpdv.eventos`): `docs/engenharia/05-contrato-apis-e-eventos.md`
  - UX & Telas (`docs/artes/`): `docs/DESIGN.md` e `docs/engenharia/08-ux-e-experiencia-frontend.md`
- **Código-Fonte:**
  - Backend do PDV Core (`vapt-pdv-core`, `:3000`): `backend/src/modules/{usuarios,produtos,comandas,saude}`, `backend/src/shared/`, `backend/prisma/schema.prisma`, `backend/prisma/seed-produtos.sql` e testes em `backend/test/`.
  - Frontend Web/PWA (`/login`, `/garcom`, `/caixa`, `/kds`, `/gestao`): `frontend/src/` (compilado para `backend/public/`).
  - Microsserviços Satélites (Módulo 2+): `services/{kds-service,caixa-service,gestao-service}/`.

## Running and verifying

- **Backend (`backend/`):**
  - Instalar: `cd backend && npm install`
  - Dev (watch): `cd backend && npm run dev`
  - Build e Start: `cd backend && npm run build && npm start`
  - Typecheck: `cd backend && npm run typecheck`
  - Testes automatizados (Vitest — 143 testes): `cd backend && npm test`
  - Prisma: `cd backend && npm run prisma:generate`, `npm run prisma:migrate` (dev) e `npm run prisma:deploy` (produção)
- **Frontend (`frontend/`):**
  - Instalar: `cd frontend && npm install`
  - Dev: `cd frontend && npm run dev`
  - Build estático integrado ao Fastify: `cd frontend && npm run build`
  - Testes: `cd frontend && npm test`
- **Memória BMad (`memlog.py`):**
  - Registrar decisão/evento na Spec: `python3 _bmad/scripts/memlog.py append --workspace _bmad-output/specs/spec-vapt-pdv --type decision --text "<resumo>"`

## Conventions that differ from defaults

- **Quatro Perfis de Usuário (`RF02`, `RF34`):** `usuarios.perfil` aceita exatamente `'garcom' | 'caixa' | 'gerente' | 'cozinha'`. Apenas `'garcom'` ativo pode abrir comanda (`RN08`).
- **Identificador de Mesa (`mesa`):** Sempre `INTEGER > 0` no PostgreSQL e inteiro positivo (`12`) na saída JSON da API (a entrada aceita `12` ou `"12"` e converte para inteiro `> 0`). Mesa livre é garantida por índice único parcial `WHERE status = 'aberta'` (`RN07`).
- **Fronteira de Contexto e Resiliência (`ADR-01`, `ADR-07`):** `comandas` acessa `usuarios` e `produtos` exclusivamente por Gateways (`GarcomGateway`, `EstoqueGateway`). Nos Módulos 2 e 3, chamadas HTTP aos satélites (`kds-service` `:3001`, `caixa-service` `:3002`, `gestao-service` `:3003`) usam `AbortSignal.timeout(2000)`: falha em dependência obrigatória pré-commit retorna `503 SERVICO_INDISPONIVEL`; falha em integração colateral pós-commit não reverte a venda, grava `integracao_pendente = true` e retorna `200/201` com `avisos`.
- **Snapshot e Cálculos (`RN04`, `RN05`, `RN12`, `RN19`):** Item da comanda copia `nome_copiado` e `preco_copiado` no lançamento e inclui `observacao` e `status_preparo`. No `caixa-service`, a divisão de conta (*split payment* `POST /caixa/comandas/:comandaId/dividir`) conserva 100% dos centavos (`soma(cotas) === total`) e calcula troco exato em `DECIMAL(10,2)`.
- **Baixa Única e Idempotência (`RN10`, `ADR-09`, `ADR-10`):** Baixa de estoque ocorre uma única vez no pagamento, idempotente por `(comanda_id, produto_id)`. No Módulo 4, eventos são publicados via tabela `outbox_eventos` (Transactional Outbox) no exchange `vaptpdv.eventos`, e a baixa síncrona dá lugar ao consumidor da fila `produtos.comanda.paga`.

## Known pitfalls

- Nunca divida `usuarios`, `produtos` e `comandas` em microsserviços CRUD separados: a decisão arquitetural canônica (`ADR-01`) preserva o `vapt-pdv-core` (`:3000`/`vaptpdv_db`) coeso e extrai `kds-service` (`:3001`/`kds_db`), `caixa-service` (`:3002`/`caixa_db`) e `gestao-service` (`:3003`/`gestao_db`). Fidelidade/Cashback (`C14`) está fora do escopo v1.
- No ambiente Linux atual, o binário `uv` não está instalado no PATH global; execute os scripts Python do `_bmad/scripts/` (`resolve_config.py`, `resolve_customization.py`, `memlog.py`) diretamente com `python3`.

<!-- /bmad:context -->
