# VaptPDV

> **Trabalho prático e incremental desenvolvido para a disciplina de Sistemas Distribuídos**  
> **Departamento de Ciência da Computação (DCC) - Universidade do Estado do Rio Grande do Norte (UERN)**  
> **Docentes:** Profa. Dra. Glaucia Melissa e Profa. Ma. Luiziane Paulino dos Santos  
> **Discentes:** Kaio França e Mateus Neri  

[![Módulo 1: Cloud IaaS](https://img.shields.io/badge/Módulo%201-Cloud%20IaaS%20(AWS%20EC2)-success)](docs/engenharia/01-visao-e-escopo.md)
[![Módulo 2: Microsserviços](https://img.shields.io/badge/Módulo%202-Microsserviços%20Satélites-success)](docs/engenharia/03-arquitetura-c4-model.md)
[![Módulo 3: Containers](https://img.shields.io/badge/Módulo%203-Docker%20Compose%20(8%20Containers)-success)](docs/engenharia/03-arquitetura-c4-model.md)
[![Bancos Isolados](https://img.shields.io/badge/Arquitetura-Database--per--Service-blue)](docs/engenharia/04-modelo-dados-e-dominio.md)
---

## 1. Visão Geral

O **VaptPDV** é um ecossistema distribuído de Ponto de Venda (PDV) e gestão operacional voltado para bares, lanchonetes e restaurantes. O sistema substitui o controle arcaico de comandas em papel por registros digitais unificados, atômicos e auditáveis, eliminando perdas financeiras, pedidos extraviados e atritos entre salão, cozinha e frente de caixa.

O produto foi concebido para atender quatro perfis operacionais especializados:
- **Garçom:** Abertura rápida de mesas livres, consulta ao cardápio com validação em tempo real e lançamento ágil de pedidos com congelamento imediato de preços e registro de observações/alergias.
- **Cozinha e Bar (KDS):** Fila de produção em tempo real com controle visual de tempos decorridos e alertas dinâmicos de SLA.
- **Frente de Caixa:** Fechamento de contas com aplicação opcional de taxa de serviço (10%), conferência de pendências da cozinha, suporte a *Split Payment* (divisão de conta sem perda de centavos) e emissão de recibo térmico.
- **Gerente:** Monitoramento de faturamento diário, Curva ABC de produtos (Pareto 80/15/5), alertas preditivos de ruptura de estoque e ranking de produtividade da equipe.

Para aprofundamento nos requisitos formais, modelos de domínio e decisões arquiteturais, consulte a pasta [`docs/engenharia/`](docs/engenharia/).

---

## 2. Evolução Arquitetural: Módulo 1 (Cloud IaaS) vs. Módulo 2 (Microsserviços)

O projeto segue uma progressão didática e prática, partindo de uma arquitetura em nuvem monolítica e evoluindo para um ecossistema de microsserviços distribuídos orientados a domínios de negócio.

### Diagrama Comparativo de Evolução

```mermaid
flowchart TD
    subgraph M1["Módulo 1: Núcleo Monolítico em Nuvem (AWS EC2)"]
        direction TB
        M1_Core["vapt-pdv-core (:3000)<br>• Salão, Comandas e Garçom<br>• Catálogo e Estoque Central<br>• Caixa e Fechamento Acoplados"]
        M1_DB[("Banco Único<br>PostgreSQL: vaptpdv_db")]
        M1_Core --- M1_DB
    end

    subgraph M2["Módulo 2: Ecossistema de Microsserviços"]
        direction TB
        M2_Core["Core Salão / PDV (:3000)<br>• Garçom PWA & Comandas<br>• Catálogo & Usuários"]
        M2_KDS["kds-service (:3001)<br>• Cozinha & Bar<br>• Kanban TV & SLA Dinâmico"]
        M2_Caixa["caixa-service (:3002)<br>• Split Payment & Troco<br>• Recibo Térmico .paper"]
        M2_Gestao["gestao-service (:3003)<br>• Curva ABC (Pareto)<br>• Alertas & Comissões"]

        DB_Core[("vapt_pdv")]
        DB_KDS[("kds_db")]
        DB_Caixa[("caixa_db")]
        DB_Gestao[("gestao_db")]

        M2_Core --- DB_Core
        M2_KDS --- DB_KDS
        M2_Caixa --- DB_Caixa
        M2_Gestao --- DB_Gestao

        M2_Core -.->|"HTTP REST (Timeout 2s)"| M2_KDS
        M2_Core -.->|"HTTP REST (Timeout 2s)"| M2_Caixa
        M2_Core -.->|"Reconciliação / BI"| M2_Gestao
    end
```

### Tabela Comparativa de Dimensões de Engenharia

| Dimensão de Engenharia | Módulo 1 - Computação em Nuvem (IaaS) | Módulo 2 - Microsserviços | Ganho Arquitetural e Operacional |
| :--- | :--- | :--- | :--- |
| **Topologia da Aplicação** | Monólito modularizado em processo único (`:3000`). | PDV (`:3000`) + 3 microsserviços (`:3001`, `:3002`, `:3003`). | Desacoplamento de responsabilidades por estação física de trabalho (Salão, Cozinha, Caixa, Gestão). |
| **Padrão de Dados** | Banco relacional único (`vaptpdv_db`) compartilhado por todas as entidades. | Padrão estrito **Database-per-Service** com 4 bancos isolados (`vapt_pdv`, `kds_db`, `caixa_db`, `gestao_db`). | Independência transacional; manutenção ou lentidão em um serviço não afeta as demais bases. |
| **Comunicação e Fronteiras** | Chamadas diretas em memória entre módulos internos. | Comunicação via **Gateways HTTP REST** com isolamento de contexto e contratos JSON estritos. | Fronteiras claras de domínio; preparação direta para mensageria assíncrona. |
| **Cozinha e Bar (KDS)** | Consultas manuais diretamente nas tabelas de itens do salão. | **`kds-service` dedicado** com Painel TV, SLA dinâmico por faixas de cor e observações de preparo/alergias. | Fila de produção fluida e visibilidade em tempo real sem concorrência no banco do salão. |
| **Frente de Caixa** | Fechamento básico em cota única de pagamento. | **`caixa-service` dedicado** com *Split Payment* exato (conservação total de centavos), cálculo de troco e recibo `.paper`. | Segurança contábil, integridade nos fechamentos e flexibilidade de cobrança fracionada. |
| **Gestão e BI** | Relatórios básicos concorrendo com transações de venda. | **`gestao-service` analítico (OLAP)** com Curva ABC de vendas (Pareto 80/15/5), monitor de estoque crítico e comissões. | Processamento de consultas agregadas complexas isolado do tráfego operacional do PDV. |
| **Frontend Web/PWA** | Interface simplificada para Garçom e Caixa básico. | **5 modos especializados** (`/login`, `/garcom`, `/caixa`, `/kds`, `/gestao`) cobrindo 4 perfis operacionais. | Ergonomia focada na função de cada colaborador, desde smartphones a televisores widescreen. |
---

## 3. Topologia Distribuída e Portas dos Microsserviços (ADR-01)

Adotou-se a decisão arquitetural canônica: ao invés de fragmentar o núcleo operacional em microsserviços CRUD artificiais, preservou-se a alta coesão do **PDV Core** para operações de salão e extraíram-se três satélites de domínio vertical:

| Serviço / Módulo | Diretório | Porta | Banco de Dados | Responsabilidade Principal |
| :--- | :--- | :---: | :--- | :--- |
| **PDV Core (`vapt-pdv-core`)** | `backend/` | `:3000` | `vapt_pdv` | Salão, abertura de mesas, comandas, catálogo de produtos, perfis e coordenação geral. |
| **KDS Service (`kds-service`)** | `services/kds-service/` | `:3001` | `kds_db` | Gestão da fila de produção da cozinha/bar, fichas técnicas e monitoramento de SLA. |
| **Caixa Service (`caixa-service`)** | `services/caixa-service/` | `:3002` | `caixa_db` | Processamento de pagamentos, divisão de conta (*split payment*), troco e emissão de comprovantes. |
| **Gestão Service (`gestao-service`)** | `services/gestao-service/` | `:3003` | `gestao_db` | Inteligência analítica (OLAP), Curva ABC de Pareto, gestão de reposição e comissões de garçons. |
| **Frontend Web/PWA** | `frontend/` | `:5173` / `:3000` | - | Interface unificada em React 19 servida via Vite Dev Gateway (`:5173`) ou estáticos compilados (`:3000`). |

---

## 4. Aplicação na Nuvem (AWS EC2), Swagger/OpenAPI e Vídeos

A infraestrutura oficial do projeto está provisionada em máquina virtual **AWS EC2 (Ubuntu LTS)** gerenciada via **PM2**:

### Endpoints da Aplicação e Documentação Swagger/OpenAPI
* **Aplicação Web / PDV Core:** [http://54.234.157.236:3000](http://54.234.157.236:3000)
  * Swagger / OpenAPI do Core: [http://54.234.157.236:3000/docs](http://54.234.157.236:3000/docs)
  * Health Check do Core: [http://54.234.157.236:3000/health](http://54.234.157.236:3000/health)
* **KDS Service (Cozinha/Bar):** [http://54.234.157.236:3001](http://54.234.157.236:3001)
  * Swagger / OpenAPI do KDS: [http://54.234.157.236:3001/docs](http://54.234.157.236:3001/docs)
  * Health Check do KDS: [http://54.234.157.236:3001/health](http://54.234.157.236:3001/health)
* **Caixa Service (Split Payment):** [http://54.234.157.236:3002](http://54.234.157.236:3002)
  * Swagger / OpenAPI do Caixa: [http://54.234.157.236:3002/docs](http://54.234.157.236:3002/docs)
  * Health Check do Caixa: [http://54.234.157.236:3002/health](http://54.234.157.236:3002/health)
* **Gestão Service (Analytics & BI):** [http://54.234.157.236:3003](http://54.234.157.236:3003)
  * Swagger / OpenAPI da Gestão: [http://54.234.157.236:3003/docs](http://54.234.157.236:3003/docs)
  * Health Check da Gestão: [http://54.234.157.236:3003/health](http://54.234.157.236:3003/health)

### Vídeos: [Pasta dos vídeos](https://drive.google.com/drive/folders/1GzLecg9bSraN3ZjB7usL9Mg3I03I1uzm?usp=sharing) 

---

## 5. Catálogo das Interfaces do Frontend Web/PWA (5 Modos)

A interface do VaptPDV foi projetada como uma Single Page Application (SPA/PWA) adaptativa, implementada em React 19 e Tailwind CSS, seguindo rigorosamente a identidade visual de `docs/DESIGN.md` (Mostarda `#F2A81D`, café `#2B2019` e creme `#FBF7F1`, sem neon, sem emojis na interface e com conformidade de acessibilidade WCAG 2.2 AA).

### 1. Autenticação Unificada (`/login`)
- Seleção direta entre os 4 perfis do sistema (`garcom`, `caixa`, `cozinha`, `gerente`) com operadores ativos cadastrados no banco.
- Login otimizado sem fricção de senhas para agilidade em turnos movimentados, mantendo a rastreabilidade por ID de operador em todas as ações.

### 2. Modo Garçom Mobile-First (`/garcom`)
- **Mapa Visual de Mesas:** Exibição da ocupação do salão em tempo real (mesas livres, abertas/ocupadas ou com conta pedida/aguardando pagamento).
- **Lançamento Ágil de Pedidos:** Abertura de comandas com validação de mesa livre (`RN07`), adição de itens com congelamento imediato de preço (`RN04`), transferência de mesa (`PATCH /comandas/:id/transferir-mesa`) e mesclagem de comandas (`POST /comandas/:id/mesclar`).
- **Observações e Alergias (`G04`):** Bottom sheet mobile com seleção rápida de modificadores (ex.: *"Sem cebola"*, *"Ponto da carne: bem passada"*, *"Alérgico a glúten"*).

### 3. Painel TV da Cozinha / KDS (`/kds`)
- **Layout Kanban Widescreen:** Desenvolvido especificamente para monitores industriais ou smart TVs fixadas na cozinha/bar.
- **SLA de Preparo Dinâmico:** Fichas de produção com cronômetro em tempo real e sinalização semafórica de urgência:
  - **Verde:** Tempo decorrido `< 10 min` (dentro do prazo regular).
  - **Amarelo:** Tempo decorrido de `10 a 15 min` (alerta de atenção).
  - **Vermelho:** Tempo decorrido `> 15 min` com badge `ATRASADO` (urgência crítica).
- **Ciclo de Preparo em 1 Toque:** Botões táteis largos (>= 44x44px) para avançar pedidos de `recebido` ➔ `em_preparo` ➔ `pronto` ➔ `entregue`.

### 4. Modo Frente de Caixa Desktop (`/caixa`)
- **Visão Geral do Salão:** Painel desktop (1440x900) para visualização rápida das comandas prontas para fechamento.
- **Taxa de Serviço Opcional:** Aplicação ou dispensa parametrizada dos 10% do garçom no ato da conferência.
- **Trava de Segurança KDS (`C04`):** Bloqueio/aviso preventivo caso existam itens da mesa que ainda não foram marcados como prontos pela cozinha.
- **Split Payment Flexível:** Divisão de conta em até *N* cotas por mesa, garantindo 100% de conservação dos centavos (soma das cotas estritamente igual ao total da comanda).
- **Troco e Recibo Térmico:** Cálculo de troco exato em `DECIMAL(10,2)` e emissão de comprovante em formato `.paper` padronizado para impressoras de 80mm/58mm.

### 5. Portal Gerencial e Analytics (`/gestao`)
- **Resumo Executivo Diário:** Faturamento bruto, ticket médio e volume de comandas atendidas no dia.
- **Curva ABC de Vendas (Pareto):** Classificação automática dos produtos mais rentáveis em Classe A (80% da receita), Classe B (15%) e Classe C (5%).
- **Controle de Ruptura e Reposição de Estoque (`M05/M06`):** Painel de alertas para produtos esgotados (venda bloqueada) ou abaixo da margem de segurança, com modal de reposição de estoque (`M06` via `POST /produtos/:id/repor`).
- **Cardápio/Produtos (`M02/M03`) e Equipe/Usuários (`M12/M13`):** Gerenciamento completo do catálogo de produtos (criação, edição e ativação/inativação lógica) e cadastro de colaboradores por perfil.
- **Produtividade da Equipe:** Relatório consolidado com total vendido e rateio da taxa de serviço de 10% acumulada por garçom.

---

## 6. Stack Tecnológica Consolidada

* **Linguagem e Runtime:** [TypeScript 5](https://www.typescriptlang.org/) sobre [Node.js 20 LTS](https://nodejs.org/).
* **Framework Web:** [Fastify 5](https://fastify.dev/) 
* **ORM e Persistência:** [Prisma ORM 6](https://www.prisma.io/) com [PostgreSQL 16](https://www.postgresql.org/) 
* **Frontend Web/PWA:** [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [TanStack Query v5](https://tanstack.com/query), [Zustand](https://zustand-demo.pmnd.rs/) e [Lucide React](https://lucide.dev/).
* **Containers & Orquestração:** [Docker](https://www.docker.com/) (`node:20-alpine` multi-stage, `USER node`, `postgres:16-alpine`) e [Docker Compose](https://docs.docker.com/compose/) (rede `vaptpdv-net` e volumes nomeados `pgdata_*`).
* **Infraestrutura:** AWS EC2, Docker Compose e PM2.

---

## 7. Guia Passo a Passo de Execução (Containers & Desenvolvimento Local)

### Modo A: Orquestração Completa em Containers (Docker Compose — Módulo 3)

Este modo sobe todos os **8 containers** do ecossistema (`4` microsserviços Node.js + `4` instâncias PostgreSQL 16 isoladas na rede `vaptpdv-net` com volumes persistentes nomeados e migrações Prisma aplicadas automaticamente):

#### Pré-requisitos
* **Docker Engine** e **Docker Compose v2** (`docker compose`).
* **Git** e **Bash** (Linux, macOS, WSL ou Git Bash no Windows) para executar o script de persistência.

#### Passo 1: Configurar Variáveis de Ambiente
Copie o template seguro da raiz (nenhum segredo real é versionado):
```bash
cp .env.docker.example .env
```

#### Passo 2: Construir as Imagens Multi-Stage e Subir os 8 Containers
```bash
docker compose up -d --build
docker compose ps
```
> Todos os 8 serviços (`postgres-core`, `postgres-kds`, `postgres-caixa`, `postgres-gestao`, `vapt-pdv-core`, `kds-service`, `caixa-service`, `gestao-service`) utilizam `healthcheck` e `depends_on: condition: service_healthy`, subindo em estado `healthy` com usuário não-root (`USER node`) e imagens enxutas (`117MB` no Core e `76–77.6MB` nos satélites).

#### Passo 3: Validar Persistência de Dados Pós-Ciclo `down` -> `up`
O script automatizado abaixo cria um garçom e produto no Core, abre comanda, lança item (gerando ficha no KDS), avança até `entregue`, fecha a comanda, quita via PIX no Caixa (baixando estoque no Core, emitindo recibo `.paper` e registrando no Gestão), executa `docker compose down` seguido de `docker compose up -d` e comprova que 100% dos registros foram preservados nos 4 volumes (`pgdata_core`, `pgdata_kds`, `pgdata_caixa`, `pgdata_gestao`):
```bash
bash scripts/testar-persistencia-docker.sh
```

*(Opcional — carregar catálogo demonstrativo no Core em container: `docker compose exec -T postgres-core psql -U vaptpdv -d vaptpdv_db < backend/prisma/seed-produtos.sql`)*

---

### Modo B: Execução Manual em Desenvolvimento Local (Node.js + TSX Watch)

#### Pré-requisitos
* **Node.js:** versão 20 LTS ou superior.
* **Docker e Docker Compose** (para subir apenas os bancos PostgreSQL 16).

1. **Subir apenas os bancos de dados:**
   ```bash
   docker compose up -d postgres-core postgres-kds postgres-caixa postgres-gestao
   ```
2. **Aplicar migrações Prisma nos 4 serviços** (apontando `DATABASE_URL` no `.env` de cada serviço) e iniciar em terminais separados:
   ```bash
   # Terminal 1: PDV Core Salão (:3000) e Frontend Integrado
   cd backend && npm run dev

   # Terminal 2: KDS Cozinha e Bar (:3001)
   cd services/kds-service && npm run dev

   # Terminal 3: Caixa Service (:3002)
   cd services/caixa-service && npm run dev

   # Terminal 4: Gestão e Analytics (:3003)
   cd services/gestao-service && npm run dev

   # Terminal 5 (Opcional): Frontend Vite Dev Server (:5173 com proxies)
   cd frontend && npm run dev
   ```

---

### Interfaces e Documentações (Local ou Container)

* **Frontend Web/PWA Integrado:** [http://localhost:3000](http://localhost:3000) *(ou [http://localhost:5173](http://localhost:5173) no modo Vite dev)*
* **Swagger Core Salão:** [http://localhost:3000/docs](http://localhost:3000/docs)
* **Swagger KDS Cozinha:** [http://localhost:3001/docs](http://localhost:3001/docs)
* **Swagger Caixa Service:** [http://localhost:3002/docs](http://localhost:3002/docs)
* **Swagger Gestão Service:** [http://localhost:3003/docs](http://localhost:3003/docs)

---

## 8. Comparativo Técnico: Deploy Direto na VM EC2 (Módulos 1–2) vs. Containers Docker Compose (Módulo 3)

| Dimensão | Deploy Direto na VM EC2 (PM2 + PostgreSQL Nativo) | Orquestração em Containers (Docker Compose Multi-Stage) |
| :--- | :--- | :--- |
| **Reprodutibilidade de Ambiente** | Dependente de pacotes instalados no SO da VM (versão global de Node.js, PostgreSQL, OpenSSL e PATH). | Imutável e idêntica entre máquina local e AWS EC2 via imagens `node:20-alpine` e `postgres:16-alpine`. |
| **Isolamento de Bancos (`ADR-01`)** | 4 databases lógicos compartilhando o mesmo processo e porta `5432` do PostgreSQL da VM. | **4 containers PostgreSQL independentes** (`postgres-core`, `postgres-kds`, `postgres-caixa`, `postgres-gestao`), sem compartilhamento de memória/locks e com portas internas isoladas na rede `vaptpdv-net`. |
| **Segurança e Privilégios** | Processos gerenciados pelo usuário de deploy do SO e arquivos-fonte presentes no diretório de execução. | Execução estrita sem privilégios de root (`USER node`), builds multi-stage sem `devDependencies`/testes/código `.ts` na imagem final (`117MB` no Core e `76–77.6MB` nos satélites). |
| **Inicialização e Migrações** | Ordem de subida controlada manualmente no PM2; risco de corrida se o serviço iniciar antes do banco. | Subida determinística via `depends_on: condition: service_healthy` (`pg_isready`) e execução automática de `npx prisma migrate deploy` antes do servidor HTTP. |
| **Persistência e Orçamento de RAM** | Dados em diretório padrão do SO sem cota individual por serviço/banco. | Persistência garantida por 4 volumes nomeados (`pgdata_*`) sobrevivendo a `docker compose down`/`up` e limites explícitos de CPU/RAM compatíveis com EC2 `t3.small`/`t3.medium`. |
