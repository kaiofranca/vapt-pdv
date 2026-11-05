# STATUS — VaptPDV (Controle de Progresso para Agentes e Desenvolvedores)

> **Propósito:** Ponto único de retomada para qualquer desenvolvedor ou agente de IA ao abrir o repositório em outra máquina ou nova sessão. Atualize este arquivo e `_bmad-output/implementation-artifacts/sprint-status.yaml` sempre que uma story mudar de estado.

**Última atualização:** 2026-11-04 (*Correct Course M2 aplicado: Core Salão `:3000` + KDS `:3001` + Caixa `:3002` + Gestão `:3003`; revisão crítica e correções 100% implementadas no contrato de APIs e eventos*)  
**Módulo atual:** Módulo 1 — Computação em Nuvem (`entrega-1-cloud`) — **CÓDIGO E TESTES 100% CONCLUÍDOS (`done`)**  
**Próximo Passo:** Atualização do build final na instância AWS EC2 pelos discentes, gravação do vídeo demonstrativo e criação da tag `entrega-1-cloud`; início da implementação dos 3 microsserviços satélites por estação do Módulo 2 (`kds-service` `:3001`, `caixa-service` `:3002`, `gestao-service` `:3003`).  
**Status do Épico 1:** 
- **Backend Fastify/Prisma (`vapt-pdv-core`):** 100% implementado e testado com **143 testes automatizados passando verde** (Stories 1 a 9 e 13 concluídas). Servindo estáticos compilados com fallback SPA para `/caixa`, `/garcom`, `/login`. Script de seed de produtos (`backend/prisma/seed-produtos.sql`) com 24 itens reais e carga idempotente.
- **Frontend Web/PWA:** 100% implementado, auditado via code review multi-camadas (Acceptance Auditor, Blind Hunter, Edge Case Hunter e Verification Gap) e testado em `frontend/` com React 19, TypeScript, Vite, Tailwind CSS, TanStack Query e Zustand (alinhado a `DESIGN.md` e WCAG 2.2 AA):
  - Story 10 (Setup, Tailwind, PWA, Lucide e Componentes Atômicos): `done`
  - Story 11 (API Client com TanStack Query e Zustand): `done`
  - Story 12 (Modo Garçom PWA - Salão, Comanda da Mesa com dupla validação de cancelamento e Cardápio Mobile): `done`
  - Tela de Login Operacional (`/login`) com alternância de tema e despacho por perfil (`garcom`, `caixa`, `gerente`, `cozinha`): `done`
  - Story 13 (Modo Caixa / Balcão com painel recolhível, fechamento com taxa, recebimento e impressão de recibo): `done` (código e testes 100% finalizados, aguardando apenas deploy final na EC2 e vídeo de entrega).
  - Design System & Brand: Logo VaptPDV SVG integrado, suporte completo a modo claro/escuro (`useThemeStore` com persistência e media query do sistema), tokens semânticos e área de toque acessível (`>= 44px`).
- **Infraestrutura AWS EC2:** Provisionada com sucesso pelos discentes.

---

## 1. Como retomar o trabalho em outra máquina / sessão

1. Leia [`AGENTS.md`](../AGENTS.md) na raiz (carregado automaticamente pelos agentes).
2. Consulte este [`STATUS.md`](STATUS.md), a árvore da iniciativa em [`_bmad-output/initiative-vapt-pdv/`](../_bmad-output/initiative-vapt-pdv/) e [`_bmad-output/implementation-artifacts/sprint-status.yaml`](../_bmad-output/implementation-artifacts/sprint-status.yaml) para saber o progresso da sprint.
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
- [x] Iniciativa e Árvore de Épicos/Stories: [`_bmad-output/initiative-vapt-pdv/`](../_bmad-output/initiative-vapt-pdv/)
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
| `"13"` | `1-13-modo-caixa-e-pagamento` | Modo Caixa / Balcão e Fechamento/Pagamento (Desktop 1440x900) | `done` *(aguardando deploy EC2/vídeo)* | [`stories/13-modo-caixa-e-pagamento.md`](../_bmad-output/specs/spec-vapt-pdv/stories/13-modo-caixa-e-pagamento.md) |

### Épico 2 — Módulo 2: Arquitetura de Microsserviços (`entrega-2-microsservicos` · Core Salão + 3 Satélites por Estação)

Conforme `ADR-01` (*Correct Course M2*), o Módulo 2 preserva o **`vapt-pdv-core` (`:3000`, `vaptpdv_db`)** como núcleo de Salão/Garçom e catálogo base (com rotas de fronteira `/usuarios/:id/validar-garcom`, `/produtos/:id/disponibilidade` e `/produtos/baixa-estoque`) e integra via HTTP REST síncrono (`AbortSignal.timeout(2000)`, degradação graciosa e fail-fast `503`) os **3 Microsserviços Satélites** com bancos exclusivos (`Database-per-Service`):

| ID | Serviço / Escopo | Porta e Banco Exclusivo | Status | Referência Arquitetural |
| :--- | :--- | :--- | :--- | :--- |
| `"14"` | Microsserviço **`kds-service`** (Fila de Cozinha/Bar `K01–K04`, SLA e `POST /kds/fichas`) | `:3001` (`kds_db`) | `done` (Stories 14.1 a 14.5 concluídas com 23 testes passando verde) | [`03-arquitetura-c4-model.md`](engenharia/03-arquitetura-c4-model.md) / [`05-contrato-apis-e-eventos.md`](engenharia/05-contrato-apis-e-eventos.md) |
| `"15"` | Microsserviço **`caixa-service`** (Fila de Recebimento `C04`, Fechamento 10% `C06`, Split Payment `C11`, Pagamento com Troco `C07`/`C10` e Recibo Operacional `.paper` `C12` — `RN19`) | `:3002` (`caixa_db`) | `backlog` | [`03-arquitetura-c4-model.md`](engenharia/03-arquitetura-c4-model.md) / [`05-contrato-apis-e-eventos.md`](engenharia/05-contrato-apis-e-eventos.md) |
| `"16"` | Microsserviço **`gestao-service`** (Estação `M01–M15`, Ingestão `POST /gestao/eventos`, Resumo Diário, Curva ABC, Desempenho de Garçons, Alertas de Estoque e Exportação) + Gateways HTTP Resilientes | `:3003` (`gestao_db`) | `backlog` | [`03-arquitetura-c4-model.md`](engenharia/03-arquitetura-c4-model.md) / [`05-contrato-apis-e-eventos.md`](engenharia/05-contrato-apis-e-eventos.md) |
| `"17"` | Deploy Multi-Serviço na AWS EC2, Diagrama C4 e Prova de Resiliência (`503` / Degradação Graciosa) do Módulo 2 | `:3000` a `:3003` | `backlog` | [`03-arquitetura-c4-model.md`](engenharia/03-arquitetura-c4-model.md) |

### Épico 3 — Módulo 3: Containers e Orquestração (`entrega-3-containers`)

| ID | Escopo | Status | Referência Arquitetural |
| :--- | :--- | :--- | :--- |
| `"18"` | `Dockerfile` multi-stage enxuto (`node:20-alpine`, `USER node`) para `vapt-pdv-core`, `kds-service`, `caixa-service` e `gestao-service` | `backlog` | [`03-arquitetura-c4-model.md — Seção 6.4`](engenharia/03-arquitetura-c4-model.md) |
| `"19"` | `docker-compose.yml` completo com os 4 serviços, bancos PostgreSQL (`vaptpdv_db`, `kds_db`, `caixa_db`, `gestao_db`), rede isolada `vaptpdv-net` e `healthcheck` (`service_healthy`) | `backlog` | [`03-arquitetura-c4-model.md — Seção 6.4`](engenharia/03-arquitetura-c4-model.md) |
| `"20"` | Documentação comparativa (VM Nativa M1 vs. Containers M3) e prova de persistência de volumes na AWS EC2 | `backlog` | [`03-arquitetura-c4-model.md`](engenharia/03-arquitetura-c4-model.md) |

### Épico 4 — Módulo 4: Mensageria e Streaming (`entrega-4-mensageria`)

| ID | Escopo | Status | Referência Arquitetural |
| :--- | :--- | :--- | :--- |
| `"21"` | Container `rabbitmq:3.13-management-alpine`, exchange `vaptpdv.eventos` (`topic`), DLX/DLQ e produtor com **Transactional Outbox (`outbox_eventos`)** (`ADR-09`) | `backlog` | [`03-arquitetura-c4-model.md — Seção 7.2`](engenharia/03-arquitetura-c4-model.md) |
| `"22"` | Consumidores idempotentes (`ADR-10`, `ack` manual) para `produtos.comanda.paga` (no módulo `produtos` do Core), `kds.item.lancado`, `pdv.item.pronto` e `gestao.eventos` | `backlog` | [`05-contrato-apis-e-eventos.md — Seção 6`](engenharia/05-contrato-apis-e-eventos.md) |
| `"23"` | Análise comparativa Mensageria (RabbitMQ) vs. Streaming (Kafka/Redpanda) e prova de tolerância a falhas assíncrona na AWS EC2 | `backlog` | [`03-arquitetura-c4-model.md — Seção 8`](engenharia/03-arquitetura-c4-model.md) |

---

## 5. Ações Humanas (Discentes)

- [x] **Infraestrutura Cloud IaaS:** Instância **AWS EC2** provisionada com Ubuntu LTS, Node.js e banco **PostgreSQL** local instalado na VM e testado com sucesso por Kaio e Mateus.
- [ ] **Homologação Final M1:** Subir a versão com o Frontend Web/PWA completo (Stories 10 a 13) na VM AWS EC2.
- [ ] **Gravação e Tag Git:** Gravar vídeo curto demonstrando o PDV Core funcionando na AWS EC2, publicar no YouTube (Não listado), inserir URL no `README.md` e criar a tag `entrega-1-cloud`.
