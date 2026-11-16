# STATUS — VaptPDV (Controle de Progresso para Agentes e Desenvolvedores)

> **Propósito:** Ponto único de retomada para qualquer desenvolvedor ou agente de IA ao abrir o repositório em outra máquina ou nova sessão. Atualize este arquivo e `_bmad-output/implementation-artifacts/sprint-status.yaml` sempre que uma story mudar de estado.

**Última atualização:** 2026-11-13 (*Módulo 3 concluído — `entrega-3-containers` validado com 8/8 containers `healthy` no Docker Compose, persistência pós-ciclo `down` -> `up` comprovada via `scripts/testar-persistencia-docker.sh`, Dockerfiles multi-stage `node:20-alpine` `USER node` e **433 testes automatizados passando verdes**: Core 191, Frontend 131, KDS 23, Caixa 64, Gestão 24*)  
**Módulo atual:** Módulo 3 — Containers e Orquestração (`entrega-3-containers`) — **CÓDIGO, CONTAINERS E PERSISTÊNCIA 100% CONCLUÍDOS (`done`)**
**Próximo Passo:** Módulo 4 — Mensageria e Streaming (`entrega-4-mensageria`); Deploy/validação em containers na AWS EC2, vídeo demonstrativo e tag Git `entrega-3-containers` pelos discentes.
**Status do Ecossistema:** 
- **Backend Fastify/Prisma (`vapt-pdv-core` `:3000`):** 100% implementado, containerizado (`backend/Dockerfile` multi-stage `node:20-alpine`, `USER node`, CONTENT SIZE `117MB` `< 220MB`) e testado com **191 testes automatizados passando verde** (inclui proxy transparente `/gestao/*` e `/analytics/*` com `AbortSignal.timeout(2000)`, migration `movimentos_estoque.tipo`, padronização de mesa como inteiro positivo, auditoria de cancelamento com `motivo_cancelamento`, `HttpKdsGateway`, transferência/mesclagem e observações). Servindo estáticos compilados com fallback SPA para `/caixa`, `/garcom`, `/login`, `/kds` e `/gestao`.
- **Frontend Web/PWA (`frontend/`):** **131 testes automatizados passando verde** com React 19, TypeScript, Vite, Tailwind CSS, TanStack Query e Zustand (alinhado a `DESIGN.md` e WCAG 2.2 AA), compilado e embutido em `/app/public` na imagem do `vapt-pdv-core`:
  - Setup, Tailwind, PWA, Lucide e Componentes Atômicos (`1.10`): `done`
  - API Client com TanStack Query e Zustand (`1.11`): `done`
  - Modo Garçom PWA (`1.12`): `done`
  - Modo Caixa Desktop (`1.13`): `done`
  - Shell Gerencial e Dashboard Executivo `/gestao` (`2.3.2`): `done`
  - Telas Analíticas Curva ABC, Garçons, Estoque e Exportação (`2.3.3`): `done`
  - Gestão de Equipe, Produtos e Reposição (`2.3.4`, `2.3.5`, `2.3.6`): `done`
  - Login Operacional de Cozinha e Rota `/kds` (`2.1.6`): `done`
  - Painel TV da Cozinha/Bar com SLA dinâmico e gestão de fichas (`2.1.7`): `done`
  - Reconexão do Caixa ao Satélite `:3002`, Split Payment e Recibo Térmico .paper (`2.2.8`): `done`
- **Microsserviços Satélites (Containerizados `< 160MB`, `USER node`, CORS ativo):**
  - `kds-service` (`:3001` / `kds_db`): CONTENT SIZE `76MB`, **23 testes** unitários e de integração (`done`).
  - `caixa-service` (`:3002` / `caixa_db`): CONTENT SIZE `77.6MB`, **64 testes** unitários e de integração (split payment, troco, recibo `.paper`, CORS) (`done`).
  - `gestao-service` (`:3003` / `gestao_db`): CONTENT SIZE `77.6MB`, **24 testes** unitários, OLAP e CORS (`done`).
- **Orquestração & Persistência Docker Compose:** 8/8 containers `healthy` na rede `vaptpdv-net` (`postgres-core`, `postgres-kds`, `postgres-caixa`, `postgres-gestao` + 4 microsserviços) com volumes nomeados (`pgdata_*`) e prova automatizada em `scripts/testar-persistencia-docker.sh` passando (`exit 0`).
- **Infraestrutura AWS EC2:** Provisionada com sucesso pelos discentes.

---

## 1. Como retomar o trabalho em outra máquina / sessão

1. Leia [`AGENTS.md`](../AGENTS.md) na raiz (carregado automaticamente pelos agentes).
2. Consulte este [`STATUS.md`](STATUS.md), os artefatos de planejamento em [`_bmad-output/planning-artifacts/`](../_bmad-output/planning-artifacts/), o contrato canônico em [`_bmad-output/specs/spec-vapt-pdv/SPEC.md`](../_bmad-output/specs/spec-vapt-pdv/SPEC.md) e [`_bmad-output/implementation-artifacts/sprint-status.yaml`](../_bmad-output/implementation-artifacts/sprint-status.yaml) para saber o progresso da sprint.
3. Para prosseguir com as próximas entregas, consulte o PRD e o ARD reconciliados em [`docs/engenharia/README.md`](engenharia/README.md).

---

## 2. Divisão de Responsabilidades Registrada

- **Discentes (Kaio França e Mateus Neri):** Responsáveis por toda a infraestrutura e computação distribuída prática (instância AWS EC2, Security Groups, liberação de portas, SO, PM2, subida prática dos bancos/serviços/containers e RabbitMQ, além dos vídeos de entrega e tags Git).
- **Agente BMad (Equipe de Agentes - PM, Architect, Dev, TEA):** Responsável pelo planejamento, documentação formal de engenharia/sprint/arquitetura (PRD, SRS, ARD C4 Model), especificação de UX/UI, e construção do código da aplicação VaptPDV (Fastify, Prisma, TypeScript, camadas desacopladas, interfaces, gateways, Frontend Web/PWA integrado em `frontend/`), preparando o software de forma limpa e modular para encaixar perfeitamente em cada arquitetura dos 4 módulos da disciplina (`ADR-01`: Core Salão/PDV `vapt-pdv-core` `:3000`/`vaptpdv_db` + 3 Microsserviços Satélites por estação: `kds-service` `:3001`/`kds_db`, `caixa-service` `:3002`/`caixa_db`, `gestao-service` `:3003`/`gestao_db`; Fidelidade/Cashback `C14` movido para Out-of-Scope v1).

---

## 3. Artefatos de Planejamento e Especificação Concluídos

### Documentação Oficial de Engenharia de Software (`docs/engenharia/`)
- [x] Índice Mestre da Suite Documental: [`docs/engenharia/README.md`](engenharia/README.md)
- [x] PRD Parte 1 — Visão, Escopo, Personas, JTBD, Contra-Métricas e Roadmap: [`docs/engenharia/01-visao-e-escopo.md`](engenharia/01-visao-e-escopo.md)
- [x] PRD Parte 2 — Especificação de Requisitos SRS (`UJ-01`–`UJ-10`, `RF01`–`RF34`, `RN01`–`RN24`, `RNF01`–`RNF12`, `UC01`–`UC08`): [`docs/engenharia/02-especificacao-requisitos-srs.md`](engenharia/02-especificacao-requisitos-srs.md)
- [x] ARD Parte 1 — Arquitetura C4 Model, Kruchten 4+1, `ASR-01`–`ASR-10` e `ADR-01`–`ADR-12`: [`docs/engenharia/03-arquitetura-c4-model.md`](engenharia/03-arquitetura-c4-model.md)
- [x] ARD Parte 2 — Modelo de Domínio DDD, DERs Físicos, DDL SQL dos 4 Bancos (`vaptpdv_db`, `kds_db`, `caixa_db`, `gestao_db`) e Concorrência: [`docs/engenharia/04-modelo-dados-e-dominio.md`](engenharia/04-modelo-dados-e-dominio.md)
- [x] ARD Parte 3 — Contrato de APIs REST (`:3000` a `:3003`) e Mensageria AMQP Reconciliado: [`docs/engenharia/05-contrato-apis-e-eventos.md`](engenharia/05-contrato-apis-e-eventos.md)
- [x] UX/UI Design Frontend (Catálogo das 46 Telas: Login, Garçom, Caixa, KDS, Gestão): [`docs/engenharia/08-ux-e-experiencia-frontend.md`](engenharia/08-ux-e-experiencia-frontend.md)
- [x] Plano de Testes e Qualidade (TEA BMad): [`_bmad-output/test-artifacts/test-design/test-plan.md`](../_bmad-output/test-artifacts/test-design/test-plan.md)

### Contrato Canônico e Artefatos BMad
- [x] Artefatos de Planejamento & PRD/Arquitetura: [`_bmad-output/planning-artifacts/`](../_bmad-output/planning-artifacts/)
- [x] Contrato Canônico (`SPEC.md`) & Backlog de Stories: [`_bmad-output/specs/spec-vapt-pdv/`](../_bmad-output/specs/spec-vapt-pdv/)
- [x] Especificação Canônica Atualizada: [`_bmad-output/specs/spec-vapt-pdv/SPEC.md`](../_bmad-output/specs/spec-vapt-pdv/SPEC.md) e [`.memlog.md`](../_bmad-output/specs/spec-vapt-pdv/.memlog.md)
- [x] Companions do SPEC: [`architecture-and-stack.md`](../_bmad-output/specs/spec-vapt-pdv/architecture-and-stack.md), [`domain-and-state-machine.md`](../_bmad-output/specs/spec-vapt-pdv/domain-and-state-machine.md), [`api-contract.md`](../_bmad-output/specs/spec-vapt-pdv/api-contract.md), [`academic-deliverables.md`](../_bmad-output/specs/spec-vapt-pdv/academic-deliverables.md) e [`requirements-traceability.md`](../_bmad-output/specs/spec-vapt-pdv/requirements-traceability.md)
- [x] Artefatos Executivos de Planejamento: [`_bmad-output/planning-artifacts/product-brief.md`](../_bmad-output/planning-artifacts/product-brief.md), [`prd.md`](../_bmad-output/planning-artifacts/prd.md), [`architecture.md`](../_bmad-output/planning-artifacts/architecture.md), [`ux-design.md`](../_bmad-output/planning-artifacts/ux-design.md)
- [x] Contexto de Agentes e Git: [`AGENTS.md`](../AGENTS.md) e [`.gitignore`](../.gitignore)

---

## 4. Backlog e Progresso das Stories

### Épico 1 — Módulo 1: Computação em Nuvem (`entrega-1-cloud` · Concluído em Código)

| ID (`stories.yaml`) | Chave (`sprint-status.yaml`) | Título | Status | Spec da Story |
| :--- | :--- | :--- | :--- | :--- |
| `"1"` | `1-1-esqueleto-da-api-e-infraestrutura-base` | Esqueleto da API e infraestrutura base | `done` | [`stories/1-esqueleto-da-api-e-infraestrutura-base.md`](../_bmad-output/specs/spec-vapt-pdv/stories/1-esqueleto-da-api-e-infraestrutura-base.md) |
| `"2"` | `1-2-crud-de-usuarios-com-perfil` | CRUD de usuários com perfil | `done` | [`stories/2-crud-de-usuarios-com-perfil.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-crud-de-usuarios-com-perfil.md) |
| `"3"` | `1-3-crud-de-produtos-com-estoque` | CRUD de produtos com estoque | `done` | [`stories/3-crud-de-produtos-com-estoque.md`](../_bmad-output/specs/spec-vapt-pdv/stories/3-crud-de-produtos-com-estoque.md) |
| `"4"` | `1-4-abertura-e-consulta-de-comandas` | Abertura e consulta de comandas | `done` | [`stories/4-abertura-e-consulta-de-comandas.md`](../_bmad-output/specs/spec-vapt-pdv/stories/4-abertura-e-consulta-de-comandas.md) |
| `"5"` | `1-5-lancamento-ajuste-e-remocao-de-itens` | Lançamento, ajuste e remoção de itens | `done` | [`stories/5-lancamento-ajuste-e-remocao-de-itens.md`](../_bmad-output/specs/spec-vapt-pdv/stories/5-lancamento-ajuste-e-remocao-de-itens.md) |
| `"6"` | `1-6-fechamento-com-taxa-de-servico-e-cancelamento` | Fechamento com taxa de serviço e cancelamento | `done` | [`stories/6-fechamento-com-taxa-de-servico-e-cancelamento.md`](../_bmad-output/specs/spec-vapt-pdv/stories/6-fechamento-com-taxa-de-servico-e-cancelamento.md) |
| `"7"` | `1-7-pagamento-com-baixa-de-estoque-transacional` | Pagamento com baixa de estoque transacional | `done` | [`stories/7-pagamento-com-baixa-de-estoque-transacional.md`](../_bmad-output/specs/spec-vapt-pdv/stories/7-pagamento-com-baixa-de-estoque-transacional.md) |
| `"8"` | `1-8-deploy-em-nuvem-com-banco-gerenciado` | Deploy em nuvem com banco gerenciado (AWS EC2) | `done` | [`stories/8-deploy-em-nuvem-com-banco-gerenciado.md`](../_bmad-output/specs/spec-vapt-pdv/stories/8-deploy-em-nuvem-com-banco-gerenciado.md) |
| `"9"` | `1-9-documentacao-e-prova-de-entrega-do-modulo-1` | Documentação e prova de entrega do Módulo 1 | `done` | [`stories/9-documentacao-e-prova-de-entrega-do-modulo-1.md`](../_bmad-output/specs/spec-vapt-pdv/stories/9-documentacao-e-prova-de-entrega-do-modulo-1.md) |
| `"10"` | `1-10-setup-frontend-vite-tailwind-pwa` | Setup do Frontend React, Tailwind e PWA | `done` | [`stories/10-setup-frontend-vite-tailwind-pwa.md`](../_bmad-output/specs/spec-vapt-pdv/stories/10-setup-frontend-vite-tailwind-pwa.md) |
| `"11"` | `1-11-api-client-tanstack-query-zustand` | Camada de API REST e Estado Global (TanStack Query e Zustand) | `done` | [`stories/11-api-client-tanstack-query-zustand.md`](../_bmad-output/specs/spec-vapt-pdv/stories/11-api-client-tanstack-query-zustand.md) |
| `"12"` | `1-12-modo-garcom-pwa` | Modo Garçom PWA (Salão, Comanda da Mesa e Cardápio Mobile) | `done` | [`stories/12-modo-garcom-pwa.md`](../_bmad-output/specs/spec-vapt-pdv/stories/12-modo-garcom-pwa.md) |
| `"13"` | `1-13-modo-caixa-e-pagamento` | Modo Caixa / Balcão e Fechamento/Pagamento (Desktop 1440x900) | `done` | [`stories/13-modo-caixa-e-pagamento.md`](../_bmad-output/specs/spec-vapt-pdv/stories/13-modo-caixa-e-pagamento.md) |

### Épico 2 — Módulo 2: Arquitetura de Microsserviços (`entrega-2-microsservicos` · Core Salão + 3 Satélites por Estação)

Conforme `ADR-01` (*Correct Course M2*), o Módulo 2 preserva o **`vapt-pdv-core` (`:3000`, `vaptpdv_db`)** como núcleo de Salão/Garçom e catálogo base (com rotas de fronteira `/usuarios/:id/validar-garcom`, `/produtos/:id/disponibilidade` e `/produtos/baixa-estoque`) e integra via HTTP REST síncrono (`AbortSignal.timeout(2000)`, degradação graciosa e fail-fast `503`) os **3 Microsserviços Satélites** com bancos exclusivos (`Database-per-Service`):

| ID / Chave | Sub-História / Escopo | Porta / Banco | Status | Referência Spec (EARS) |
| :--- | :--- | :--- | :--- | :--- |
| `2-3-4` | **Gestão Frontend:** Equipe e Gestão de Usuários (`M12`, `M13`, `RF02`, `RN14`) | `:3000` | `done` | [`stories/2-3-4-gestao-frontend-equipe-usuarios.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-3-4-gestao-frontend-equipe-usuarios.md) |
| `2-3-5` | **Gestão Frontend:** Cardápio e Gestão de Produtos (`M02`, `M03`, `RF01`, `RF33`) | `:3000` | `done` | [`stories/2-3-5-gestao-frontend-cardapio-e-produtos.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-3-5-gestao-frontend-cardapio-e-produtos.md) |
| `2-3-6` | **Gestão:** Reposição de Estoque com `MovimentoEstoque` e Modal (`M05`, `M06`, `RF33`, `RN10`) | `:3000` | `done` | [`stories/2-3-6-gestao-frontend-reposicao-estoque.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-3-6-gestao-frontend-reposicao-estoque.md) |
| `2-1-5` | **Core:** Integração via `KdsGateway` com Resiliência e Timeout (`ADR-01`, `ADR-07`) | `:3000` -> `:3001` | `done` | [`stories/2-1-5-core-integracao-kds-gateway.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-1-5-core-integracao-kds-gateway.md) |
| `2-1-6` | **KDS Frontend:** Habilitação do Perfil Cozinha, Sessão e Rota `/kds` (`RF02`, `RF34`) | Web / React | `done` | [`stories/2-1-6-kds-frontend-habilitacao-login-cozinha.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-1-6-kds-frontend-habilitacao-login-cozinha.md) |
| `2-1-7` | **KDS Frontend:** Painel TV da Cozinha e Gestão de Fichas (`K01` a `K04`, SLA dinâmico) | `:3001` | `done` | [`stories/2-1-7-kds-frontend-painel-tv.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-1-7-kds-frontend-painel-tv.md) |
| `2-1-8` | **Core & Salão:** Observações de Preparo, Alergias e Bottom Sheet `G04` (`RF19`, `RF22`) | `:3000` / PWA | `done` | [`stories/2-1-8-core-salao-observacoes-e-alergias.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-1-8-core-salao-observacoes-e-alergias.md) |
| `2-2-8` | **Caixa Frontend:** Reconexão ao Satélite `caixa-service`, Split e Recibo (`ADR-01`, `ADR-08`) | `:3002` | `done` | [`stories/2-2-8-caixa-frontend-reconexao-satelite.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-2-8-caixa-frontend-reconexao-satelite.md) |
| `2-2-9` | **Caixa & Salão:** Checagem de Pendências do KDS no Fechamento (`RF23`, `C04`) | `:3001` / `:3000` | `done` | [`stories/2-2-9-caixa-checagem-pendencias-kds.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-2-9-caixa-checagem-pendencias-kds.md) |
| `2-4-4` | **Core:** Padronização de Mesa como Inteiro, Timestamp e Motivo de Cancelamento (`RN07`, `RF07`) | `:3000` | `done` | [`stories/2-4-4-core-padronizacao-mesa-e-motivo-cancelamento.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-4-4-core-padronizacao-mesa-e-motivo-cancelamento.md) |
| `2-5-1` | **Core & Salão:** Transferência de Mesa e Junção/Mesclagem de Comandas (Aprovada) | `:3000` / PWA | `done` | [`stories/2-5-1-core-transferencia-e-juncao-mesas.md`](../_bmad-output/specs/spec-vapt-pdv/stories/2-5-1-core-transferencia-e-juncao-mesas.md) |

### Épico 3 — Módulo 3: Containers e Orquestração (`entrega-3-containers` · Concluído em Código e Containers)

| ID (`stories.yaml`) | Chave (`sprint-status.yaml`) | Escopo | Status | Spec da Story |
| :--- | :--- | :--- | :--- | :--- |
| **`18.1`** | `3-1-1-dockerfile-core-multistage` | `Dockerfile` multi-stage enxuto para `vapt-pdv-core` com build do Frontend embutido (`node:20-alpine`, `USER node`, `117MB < 220MB`) e proxy `/gestao/*` + `/analytics/*` | `done` | [`stories/3-1-1-dockerfile-core-multistage.md`](../_bmad-output/specs/spec-vapt-pdv/stories/3-1-1-dockerfile-core-multistage.md) |
| **`18.2`** | `3-1-2-dockerfiles-satelites-multistage` | `Dockerfile` multi-stage enxuto para os satélites `kds-service` (`76MB`), `caixa-service` (`77.6MB`) e `gestao-service` (`77.6MB`) (`< 160MB` cada, `USER node`, CORS) | `done` | [`stories/3-1-2-dockerfiles-satelites-multistage.md`](../_bmad-output/specs/spec-vapt-pdv/stories/3-1-2-dockerfiles-satelites-multistage.md) |
| **`19.1`** | `3-2-1-compose-postgres-volumes-persistentes` | Rede `vaptpdv-net` e 4 containers PostgreSQL 16 isolados com volumes persistentes nomeados (`pgdata_*`), `.env.docker.example` e `pg_isready` | `done` | [`stories/3-2-1-compose-postgres-volumes-persistentes.md`](../_bmad-output/specs/spec-vapt-pdv/stories/3-2-1-compose-postgres-volumes-persistentes.md) |
| **`19.2`** | `3-2-2-compose-orquestracao-servicos` | `docker-compose.yml` orquestrando os 4 microsserviços (`8/8 healthy`) com `depends_on: { service_healthy }`, variáveis seguras e limites de CPU/RAM | `done` | [`stories/3-2-2-compose-orquestracao-servicos.md`](../_bmad-output/specs/spec-vapt-pdv/stories/3-2-2-compose-orquestracao-servicos.md) |
| **`20.1`** | `3-3-1-teste-persistencia-dados-volumes` | Script de teste automatizado de persistência de dados (`scripts/testar-persistencia-docker.sh`) pós-ciclo `down` e `up` | `done` | [`stories/3-3-1-teste-persistencia-dados-volumes.md`](../_bmad-output/specs/spec-vapt-pdv/stories/3-3-1-teste-persistencia-dados-volumes.md) |

### Épico 4 — Módulo 4: Mensageria e Streaming (`entrega-4-mensageria`)

| ID | Escopo | Status | Referência Arquitetural |
| :--- | :--- | :--- | :--- |
| **`21.1`** | Container `rabbitmq:3.13-management-alpine`, exchange topic `vaptpdv.eventos`, DLX `vaptpdv.dlx`, 5 filas duráveis e `vaptpdv.dlq` | `backlog` | [`03-arquitetura-c4-model.md — Seção 7.2`](engenharia/03-arquitetura-c4-model.md) |
| **`21.2`** | **Transactional Outbox Pattern** (`outbox_eventos`) no Core e Caixa com worker `OutboxPublisher` e publisher confirms | `backlog` | [`03-arquitetura-c4-model.md — Seção 7.2`](engenharia/03-arquitetura-c4-model.md) |
| **`22.1`** | Consumidor AMQP `kds.item.lancado` no KDS: criação de fichas com ack manual, desduplicação por `item_comanda_id` e emissão de `item.pronto` | `backlog` | [`05-contrato-apis-e-eventos.md — Seção 6`](engenharia/05-contrato-apis-e-eventos.md) |
| **`22.2`** | Consumidor AMQP `caixa.comanda.fechada` no Caixa: atualização da fila de cobranças com desduplicação por `comanda_id` | `backlog` | [`05-contrato-apis-e-eventos.md — Seção 6`](engenharia/05-contrato-apis-e-eventos.md) |
| **`22.3`** | Consumidor AMQP `produtos.comanda.paga` no Core: baixa atômica de estoque por `(comanda_id, produto_id)` e emissão de `estoque.movimentado` | `backlog` | [`05-contrato-apis-e-eventos.md — Seção 6`](engenharia/05-contrato-apis-e-eventos.md) |
| **`22.4`** | Consumidor AMQP `gestao.eventos` (routing `#`) no Gestão: ingestão contínua assíncrona das 5 projeções analíticas com ack manual | `backlog` | [`05-contrato-apis-e-eventos.md — Seção 6`](engenharia/05-contrato-apis-e-eventos.md) |
| **`23.1`** | Validação prática de resiliência assíncrona: consumidores offline, fila durável, reconexão e reprocessamento sem perdas + DLQ | `backlog` | [`03-arquitetura-c4-model.md — Seção 8`](engenharia/03-arquitetura-c4-model.md) |
| **`23.2`** | Estudo comparativo Mensageria Tradicional (RabbitMQ) vs Streaming (Kafka/Redpanda) e checklist da tag `entrega-4-mensageria` | `backlog` | [`03-arquitetura-c4-model.md — Seção 8`](engenharia/03-arquitetura-c4-model.md) |

---

## 5. Ações Humanas (Discentes)

- [x] **Infraestrutura Cloud IaaS e Deploy M1/M2:** Instância **AWS EC2** (`54.234.157.236`) provisionada com Ubuntu LTS, Node.js, PostgreSQL e deploy operacional da aplicação e dos 4 serviços (`vapt-pdv-core` `:3000`, `kds-service` `:3001`, `caixa-service` `:3002` e `gestao-service` `:3003`) realizado pelos discentes nos Módulos 1 e 2.
- [ ] **Containers e Orquestração (Módulo 3):** Dockerfiles, `docker-compose.yml` e `scripts/testar-persistencia-docker.sh` validados localmente; pendente pelos discentes subir na AWS EC2, gravar o vídeo demonstrativo e criar a tag Git `entrega-3-containers`.
- [ ] **Mensageria RabbitMQ (Módulo 4):** Subir e validar o broker RabbitMQ, workers Outbox/consumidores e prova de resiliência assíncrona, gravar o vídeo demonstrativo e criar a tag Git `entrega-4-mensageria`.
