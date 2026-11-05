# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo, organizadas pelas entregas incrementais da disciplina de Sistemas Distribuídos (DCC/UERN).

## [0.4.0] — 2026-11-05 — Épico 2: KDS Frontend, Resiliência e Estações Satélites

### Adicionado
- **Frontend KDS — Habilitação de Cozinha e Painel TV de Preparo (Stories 2.1.6 e 2.1.7):**
  - Adicionado suporte operacional ao perfil `'cozinha'` na tela de seleção de operadores (`LoginPage.tsx`) com ícone temático `ChefHat`, persistência de último acesso e inserção do cozinheiro demonstrativo `"Chef Thiago"` no seed inicial.
  - Adicionado o modo operacional `'kds'` na store global (`useSessionStore.ts`) e roteamento condicional em `App.tsx` para `<ModoKdsPage />`.
  - Construído o Painel TV KDS para monitores 1920x1080 com cronômetro em tempo real `MM:SS`, cálculo dinâmico de SLA por faixas de criticidade visual (Verde `< 10 min`, Âmbar `10 a 15 min`, Vermelho `> 15 min` pulsante com badge `ATRASADO`).
  - Implementado cabeçalho `KdsHeader` com relógio do sistema, contadores automáticos por status (*Recebidos*, *Em preparo*, *Prontos*, *Atrasados*), filtros por setor (*Todas*, *Cozinha*, *Bar*) e botão de logout acessível.
  - Implementado `FichaCard` com botões táteis de ação rápida ($\ge 56\text{px}$) para avanço de status (*"Iniciar Preparo"*, *"Marcar Pronto"*, *"Entregue ao Salão"*), suporte visual a restrições e alergias em destaque e transições suaves.
  - Implementado cliente `kdsApi.ts` e hook TanStack Query `useKdsFichas.ts` com polling resiliente a cada 5 segundos e banner discreto de reconexão.
  - Suíte de 9 testes no Vitest cobrindo login de cozinha e painel de TV (`frontend/test/kds-login.test.tsx` e `frontend/test/kds-painel.test.tsx`).
- **Core Salão — Gateway Resiliente do KDS (Story 2.1.5):**
  - Implementado `HttpKdsGateway` em `backend/src/shared/gateways/kds.gateway.ts` com chamada HTTP POST ao `kds-service` (`:3001/kds/fichas`), timeout estrito de 2000ms (`AbortSignal.timeout(2000)`) e degradação graciosa com flag `integracao_pendente = true` sem bloquear operações do salão (`ADR-07`).
  - Suíte de testes unitários com mocks de sucesso, timeout e queda em `backend/test/kds-gateway.test.ts`.
- **Core Salão — Padronização de Mesa como Inteiro e Auditoria de Cancelamento (Story 2.4.4):**
  - Migrado campo `mesa` para `Int` no Prisma Schema do `vapt-pdv-core` com migração SQL `20261105180000_mesa_int_cancelamento_observacao`.
  - Atualizados schemas TypeBox e coerção em toda a API para inteiro positivo (`INTEGER > 0`), mantendo tolerância de entrada para string numérica.
  - Adicionados campos `cancelada_em (DateTime?)` e `motivo_cancelamento (VarChar(240)?)` na tabela `comandas`.
  - Endpoint `POST /comandas/:id/cancelar` atualizado para receber `{ "motivo": string }`, validar estado e gravar auditoria; retorno de `409 COMANDA_NAO_ABERTA` para cancelamento de comanda já encerrada.
  - Suíte de testes unitários em `backend/test/mesa-e-cancelamento.test.ts`.
- **Core Salão — Transferência de Mesa e Junção/Mesclagem de Comandas (Story 2.5.1):**
  - Endpoints transacionais `PATCH /comandas/:id/transferir-mesa` (com verificação de mesa livre e retorno `409 MESA_OCUPADA`) e `POST /comandas/:id/mesclar` (migração atômica de itens, recálculo de subtotal e cancelamento automático da comanda de origem).
  - Suíte de testes unitários em `backend/test/observacoes-e-transferencia.test.ts`.
- **Core Salão — Suporte a Observações de Preparo e Alergias (Story 2.1.8):**
  - Campo `observacao VarChar(240)` adicionado ao modelo `ItemComanda` e integrado aos DTOs de lançamento e consulta.
- **Frontend Gestão Executiva e BI (Stories 2.3.2 a 2.3.6):**
  - Shell gerencial com SideNav administrativa, cartões de KPI, gráfico de faturamento com barras em mostarda, Curva ABC de produtos (Pareto 80/15/5), ranking de comissões de garçons, alertas de estoque mínimo e exportador tabular CSV/JSON.
  - Telas de Equipe (`M12/M13`), Cardápio/Produtos (`M02/M03`) e Reposição com registro de movimentações (`M05/M06`).

### Modificado
- Total de testes automatizados do ecossistema expandido para **331 testes passando 100% verdes**:
  - `backend/` (`vapt-pdv-core`): 180 testes
  - `frontend/`: 75 testes
  - `kds-service`: 22 testes
  - `caixa-service`: 39 testes
  - `gestao-service`: 15 testes

## [0.3.2] — 2026-10-23 — Camada de API REST e Estado Global TanStack Query + Zustand (Story 11)

### Adicionado
- **Camada de Integração REST e Estado Global em `frontend/src/`:**
  - Tipos e DTOs TypeScript completos em [`src/types/api.ts`](frontend/src/types/api.ts) cobrindo usuários, produtos, comandas, itens, status, meios de pagamento e envelope padronizado de erro (`ApiErrorResponse`).
  - Cliente HTTP tipado com classe customizada `ApiError` em [`src/services/apiClient.ts`](frontend/src/services/apiClient.ts) tratando falhas de rede (`503`), erros de validação (`400`), conflitos (`409`) e entidades não encontradas (`404`).
  - Módulos de serviço da API: [`usuarios.ts`](frontend/src/services/usuarios.ts), [`produtos.ts`](frontend/src/services/produtos.ts) e [`comandas.ts`](frontend/src/services/comandas.ts) (com abertura, lançamento individual e em lote, ajuste, remoção, fechamento e pagamento).
  - Custom Hooks TanStack Query v5: [`useUsuarios.ts`](frontend/src/hooks/useUsuarios.ts), [`useProdutos.ts`](frontend/src/hooks/useProdutos.ts) e [`useComandas.ts`](frontend/src/hooks/useComandas.ts) com invalidação automática de cache pós-mutação e polling de atualização no salão.
  - Stores globais Zustand desacopladas: [`useSessionStore.ts`](frontend/src/stores/useSessionStore.ts) (sessão e modo operacional) e [`useComandaStore.ts`](frontend/src/stores/useComandaStore.ts) (mesa ativa e carrinho de lote para cozinha).
  - Integração do `QueryClientProvider` em [`src/main.tsx`](frontend/src/main.tsx) e consumo das queries e mutações em [`src/App.tsx`](frontend/src/App.tsx).
  - 141 testes automatizados do backend passando 100% verdes e build de produção verificado em 900ms.

## [0.3.1] — 2026-10-23 — Setup da Aplicação SPA/PWA em React 19 + Vite (Story 10)

### Adicionado
- **Aplicação Frontend React 19 + TypeScript + Vite em `frontend/`:**
  - Configuração do Tailwind CSS e PostCSS com tokens exatos de `DESIGN.md` (Creme `#FBF7F1`, Mostarda `#F2A81D`, Café `#2B2019`, Manjericão `#2F7D4F`, Tomate `#C4391D`, `tabular-nums` e alvos de toque $\ge 44$px).
  - PWA nativo configurado via `vite-plugin-pwa` com suporte a standalone e tema `#2B2019`.
  - Iconografia semântica limpa com `lucide-react` (sem emojis decorativos).
  - Componentes atômicos reutilizáveis em `frontend/src/components/common/`: `Button`, `Input`, `Badge`, `Card`, `Modal`, `Stepper`, `ToggleSwitch`.
  - Interface interativa demonstrativa `frontend/src/App.tsx` com tabs para Design System, preview Modo Garçom e preview Modo Caixa, além de verificação de proxy síncrono com `/health` da API Fastify (`:3000`).
  - Scripts no `frontend/package.json` (`dev`, `build`, `typecheck`) e comandos unificados no backend (`dev:frontend`, `build:frontend`, `build:all`, `typecheck:frontend`).
  - Build de produção verificado gerando `frontend/dist/` com service worker e precache de ativos.

## [0.3.0] — 2026-10-23 — Planejamento e Especificação da Interface Web/PWA do PDV Core

### Adicionado
- **Interface Web/PWA Oficial do PDV Core (`public/`):**
  - Servida estaticamente pelo Fastify via `@fastify/static` nas rotas `/`, `/garcom` e `/caixa`.
  - Design System completo baseado em `DESIGN.md`: Fundo Creme (`#FBF7F1`), Mostarda (`#F2A81D`), Café (`#2B2019`), Manjericão (`#2F7D4F`) e Tomate (`#C4391D`).
  - **Modo Garçom (Mobile-first):** Visão do Salão em grid de mesas (`Livre`, `Ocupada`, `Conta pedida`), FAB de abertura rápida de mesa, comanda da mesa com carrossel de categorias, steppers de quantidade, bloqueio de produtos esgotados e botões `Enviar para a cozinha` e `Pedir a conta`.
  - **Modo Caixa (Desktop/Tablet):** Catálogo de produtos com busca em tempo real (Atalho F2), painel lateral da comanda (440px) com conferência de itens, switch de gorjeta 10% recalculando via API, modal de pagamento com opções PIX (QR Code e expiração), Dinheiro (cálculo de troco) e Cartão, e liberação atômica da mesa pós-quitação.
  - **Painel de Cadastros Rápidos:** Criação de novos produtos e colaboradores em tempo de execução para testes autônomos.
  - Suíte de 6 testes automatizados adicionada em [`test/frontend.test.ts`](test/frontend.test.ts), totalizando **141 testes automatizados passando 100% verdes**.
  - Épico 1 (Módulo 1: Nuvem IaaS) marcado como **100% concluído (`done`)** em `sprint-status.yaml` e `STATUS.md`.

## [0.2.0-refactor] — 2026-10-23 — Refatoração de Arquitetura em Camadas do PDV Core

### Modificado
- **Módulo de Comandas (`src/modules/comandas`):**
  - Desacoplamento do arquivo monolítico `servico.ts` (1.072 linhas) na arquitetura em camadas oficial do projeto:
    - [`comanda.entity.ts`](src/modules/comandas/comanda.entity.ts): Entidades de domínio (`ComandaEntidade`, `ItemComandaEntidade`), DTOs e helpers de validação/formatação monetária.
    - [`comandas.repository.ts`](src/modules/comandas/comandas.repository.ts): Interface `IComandasRepository` e implementação `ComandasRepositoryPrisma` com transações e consultas SQL.
    - [`comandas.service.ts`](src/modules/comandas/comandas.service.ts): Interface `ServicoComandas` e classe de regras de negócio `ComandasService`.
    - [`comandas.controller.ts`](src/modules/comandas/comandas.controller.ts): Classe `ComandasController` orquestrando requisições e respostas HTTP e serialização.
    - [`rotas.ts`](src/modules/comandas/rotas.ts): Atualizado para delegar endpoints diretamente ao `ComandasController`.
    - [`servico.ts`](src/modules/comandas/servico.ts): Mantido como adaptador retrocompatível `ServicoComandasPrisma extends ComandasService`.
    - [`index.ts`](src/modules/comandas/index.ts): Injeção de dependências e reexportações unificadas.
  - Todos os 135 testes automatizados (Vitest) continuam passando verdes em ~4.4s.

## [0.1.0] — 2026-10-22 — Módulo 1: Nuvem IaaS (`entrega-1-cloud`)

### Adicionado
- **Deploy em Nuvem IaaS na AWS EC2:**
  - Instância AWS EC2 com Ubuntu LTS, Node.js 20 LTS e PostgreSQL nativo instalado na máquina virtual gerenciada por PM2.
  - Regras de segurança de firewall no Security Group (portas 22 e 3000 liberadas; porta 5432 isolada em `localhost`).
- **Módulo de Comandas (`src/modules/comandas`):**
  - Abertura de comanda (`POST /comandas`) com validação de garçom via interface `ServicoUsuarios`.
  - Bloqueio de mesa ocupada com índice único condicional no PostgreSQL (`CREATE UNIQUE INDEX "comandas_mesa_aberta_unique_idx" ON "comandas"("mesa") WHERE "status" = 'aberta'`) retornando `409 MESA_OCUPADA`.
  - Lançamento de itens (`POST /comandas/:id/itens`) com cópia de snapshot do nome e preço unitário do produto (`RN04`).
  - Ajuste de quantidade (`PATCH /comandas/:id/itens/:itemId`) e remoção de itens (`DELETE /comandas/:id/itens/:itemId`).
  - Fechamento com cálculo de subtotal e taxa de serviço opcional de 10% com arredondamento seguro (`POST /comandas/:id/fechar`).
  - Cancelamento de comanda aberta sem impacto no estoque (`POST /comandas/:id/cancelar`).
  - Pagamento com seleção de forma de pagamento (`POST /comandas/:id/pagar`), gravação de data UTC de quitação e baixa de estoque atômica e idempotente via `ServicoProdutos.baixarEstoque`.
  - Listagem com filtros combinados (`status`, `mesa`, `de`, `ate`, `limit`, `offset`) e ordenação decrescente (`GET /comandas`).
  - Detalhamento de comanda com lista completa de itens (`GET /comandas/:id`).
- **Módulo de Produtos e Estoque (`src/modules/produtos`):**
  - CRUD completo de produtos: cadastro (`POST /produtos`), listagem paginada (`GET /produtos`), detalhamento (`GET /produtos/:id`), atualização parcial (`PATCH /produtos/:id`) e inativação idempotente (`POST /produtos/:id/inativar`).
  - Modelo financeiro estrito com `Decimal(10, 2)` (Prisma Decimal / PostgreSQL NUMERIC).
  - Consulta interna de disponibilidade (`GET /produtos/:id/disponibilidade`) para congelamento no lançamento de itens.
  - Baixa de estoque transacional e idempotente por `comanda_id` (`POST /produtos/baixa-estoque`) com histórico contábil na tabela `movimentos_estoque`.
- **Módulo de Usuários (`src/modules/usuarios`):**
  - CRUD completo de usuários com enum de perfil (`garcom`, `caixa`, `gerente`) e inativação lógica idempotente (`POST /usuarios/:id/inativar`).
  - Validação interna de garçom ativo (`GET /usuarios/:id/validar-garcom`).
- **Infraestrutura Base e Qualidade:**
  - Fastify com TypeBox e tratamento uniforme de erros em `{ "erro": { "codigo", "mensagem", "detalhes" } }`.
  - Health check da aplicação e conectividade com banco via `SELECT 1` em `GET /health`.
  - Documentação interativa OpenAPI/Swagger UI em `GET /docs`.
