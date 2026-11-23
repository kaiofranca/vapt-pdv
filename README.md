<div align="center">

# VaptPDV

**Ecossistema Distribuído de Ponto de Venda (PDV) e Gestão Operacional para Bares e Restaurantes**

![Arquitetura: Microsserviços](https://img.shields.io/badge/Arquitetura-Microsservi%C3%A7os-0A66C2?style=for-the-badge)
![Dados: Database-per-Service](https://img.shields.io/badge/Dados-Database--per--Service-1D4ED8?style=for-the-badge)
![Mensageria: RabbitMQ 3.13 + Outbox](https://img.shields.io/badge/Mensageria-RabbitMQ%203.13%20%2B%20Outbox-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![Orquestração: 9 Containers Docker](https://img.shields.io/badge/Orquestra%C3%A7%C3%A3o-9%20Containers%20Isolados-0284C7?style=for-the-badge&logo=docker&logoColor=white)
![Cloud: AWS EC2 IaaS](https://img.shields.io/badge/Cloud-AWS%20EC2%20%28IaaS%29-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)

[![Node.js 20](https://img.shields.io/badge/Node.js-20%20LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify 5](https://img.shields.io/badge/Fastify-5-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![Prisma 6](https://img.shields.io/badge/Prisma-6.4-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS 3.4](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## Sumário

- [Visão Geral](#visão-geral)
- [Contexto Acadêmico e Entregas Git](#contexto-acadêmico-e-entregas-git)
- [Evolução da Arquitetura nos Módulos](#evolução-da-arquitetura-nos-módulos)
- [Arquitetura Atual do Sistema](#arquitetura-atual-do-sistema)
- [Microsserviços e Topologia de Containers](#microsserviços-e-topologia-de-containers)
- [Estudo Comparativo: Mensageria (RabbitMQ) vs. Streaming (Kafka / Redpanda)](#estudo-comparativo-mensageria-rabbitmq-vs-streaming-kafka--redpanda)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Guia Passo a Passo de Execução](#guia-passo-a-passo-de-execução)
- [Testes Documentados e Verificação dos Módulos](#testes-documentados-e-verificação-dos-módulos)

---

## Visão Geral

O **VaptPDV** é um sistema distribuído de Ponto de Venda (PDV) e operação em tempo real desenvolvido para bares, lanchonetes e restaurantes. A plataforma substitui comandas manuais por registros digitais atômicos, auditáveis e sincronizados entre **salão, cozinha/bar, frente de caixa e gerência**.

### Acesso na Nuvem (AWS EC2), OpenAPI e Vídeos

- **Aplicação Web / PDV Core (`:3000`):** [http://54.234.157.236:3000](http://54.234.157.236:3000) | **Swagger:** `http://54.234.157.236:3000/docs` | **Health:** `http://54.234.157.236:3000/health`
- **KDS Service (`:3001`):** `http://54.234.157.236:3001/docs` | **Health:** `http://54.234.157.236:3001/health` *(endpoints `/kds/*`)*
- **Caixa Service (`:3002`):** `http://54.234.157.236:3002/docs` | **Health:** `http://54.234.157.236:3002/health`
- **Gestão Service (`:3003`):** `http://54.234.157.236:3003/docs` | **Health:** `http://54.234.157.236:3003/health`
- **RabbitMQ Management UI (`:15672`):** `http://54.234.157.236:15672` *(AMQP `:5672`, exchange `vaptpdv.eventos` e DLX `vaptpdv.eventos.dlx`)*
- **Vídeos Demonstrativos (Cloud e Containers):** [Acervo no Google Drive](https://drive.google.com/drive/folders/1GzLecg9bSraN3ZjB7usL9Mg3I03I1uzm?usp=sharing)

### Perfis Operacionais e Interface (SPA/PWA)

A interface web é uma SPA/PWA construída em **React 19**, **TypeScript**, **Vite 8** e **Tailwind CSS**, empacotada dentro do `vapt-pdv-core` (`backend/public/`) e centralizada via _API Gateway_ na porta `:3000`:

- **Login Operacional (`/login`):** Seleção rápida de operador ativo por perfil.
- **Garçom (`/garcom`):** Abertura de mesas livres, consulta de cardápio, lançamento de itens com congelamento de preço unitário, registro de observações/alergias, transferência de mesa e mesclagem de comandas.
- **Cozinha e Bar - KDS (`/kds`):** Fila de produção Kanban para televisores e monitores, com separação por setor (`cozinha` e `bar`), cronômetro por ficha, alertas semafóricos de SLA (`< 10 min` verde, `10–15 min` amarelo, `> 15 min` vermelho/`ATRASADO`) e transição tátil (`recebido` ➔ `em_preparo` ➔ `pronto` ➔ `entregue`).
- **Frente de Caixa (`/caixa`):** Fechamento assistido com verificação preventiva de pendências na cozinha, taxa de serviço opcional (10%), _Split Payment_ exato por mesa (conservação integral dos centavos), cálculo de troco, estorno de parcelas parciais e emissão de recibo térmico em formato `.paper`.
- **Gerente (`/gestao`):** Resumo executivo do turno (faturamento e ticket médio), Curva ABC de faturamento (Pareto 80/15/5), alertas de ruptura e reposição de estoque, CRUD de cardápio e colaboradores, além de ranking de comissões por garçom.

### Princípios Arquiteturais do Sistema

- **Database-per-Service Estrito:** Cada contexto de negócio mantém sua própria base PostgreSQL isolada, evitando acoplamento transacional e contenção de locks entre salão, cozinha, caixa e BI.
- **Core Coeso + Gateway Unificado:** O núcleo operacional (`vapt-pdv-core`) centraliza o atendimento no salão, serve a interface React compilada e atua como _API Gateway_ para os microsserviços satélites com timeouts explícitos (`2s` na Gestão e `5s` nos proxies KDS/Caixa) e degradação graciosa (`503`).
- **Comunicação Híbrida (HTTP Síncrono + RabbitMQ / Transactional Outbox):** Consultas bloqueantes em tempo real (validação de garçom/estoque, verificação preventiva de pendências no KDS e divisão/recibo) utilizam HTTP REST; toda propagação de eventos de domínio pós-commit utiliza **Transactional Outbox (`outbox_eventos`)**, **RabbitMQ** (`vaptpdv.eventos`), consumidores idempotentes (`eventos_processados`), confirmação manual (`ack`) pós-commit e **Dead Letter Queues (`.dlq`)** após 3 tentativas.
- **Integridade Contábil e de Preço:** Preços são congelados no instante do lançamento do item; divisões de conta e troco operam em decimal exato sem perda de centavos.

---

## Contexto Acadêmico e Entregas Git

Projeto prático e incremental desenvolvido na disciplina de **Sistemas Distribuídos** do **Departamento de Ciência da Computação (DCC)** da **Universidade do Estado do Rio Grande do Norte (UERN)**.

- **Docentes:** Profa. Dra. Glaucia Melissa e Profa. Ma. Luiziane Paulino dos Santos
- **Discentes:** Kaio França e Mateus Neri
- **Branches de Entrega por Módulo:**
  - `entrega-1-cloud` — Módulo 1 (Computação em Nuvem: monólito inicial na AWS EC2)
  - `entrega-2-microsservicos` — Módulo 2 (Serviços e Microsserviços: decomposição em Core + 3 satélites sob PM2)
  - `entrega-3-containers` — Módulo 3 (Containers: conteinerização multi-stage e orquestração de 8 containers via Docker Compose)
  - `entrega-4-mensageria` — Módulo 4 (Mensageria Assíncrona: RabbitMQ 3.13, Transactional Outbox, consumidores idempotentes com `ack` manual e DLQ)

---

## Evolução da Arquitetura nos Módulos

```mermaid
flowchart TD
    subgraph M1["Módulo 1 - Cloud IaaS (Monólito na AWS EC2)"]
        M1_Core["vapt-pdv (:3000) - Salão, Cozinha, Caixa e Gestão"]
        M1_DB[("PostgreSQL Único (vaptpdv_db)")]
        M1_Core --> M1_DB
    end

    subgraph M2["Módulo 2 - Microsserviços Satélites (PM2 na VM)"]
        M2_Core["vapt-pdv-core (:3000) - SPA, Salão e API Gateway"]
        M2_KDS["kds-service (:3001) - Cozinha e SLA"]
        M2_Caixa["caixa-service (:3002) - Split Payment e Recibo"]
        M2_Gestao["gestao-service (:3003) - Curva ABC e Estoque"]
        M2_DB[("PostgreSQL da VM (4 Bancos Lógicos)")]

        M2_Core -->|HTTP REST| M2_KDS
        M2_Core -->|HTTP REST| M2_Caixa
        M2_Core -->|HTTP REST| M2_Gestao
        M2_Core --> M2_DB
        M2_KDS --> M2_DB
        M2_Caixa --> M2_DB
        M2_Gestao --> M2_DB
    end

    M1_DB -.->|"Extração de Domínios"| M2_Core
    M2_DB -.->|"Conteinerização e Isolamento Físico (Módulo 3)"| M3_Ref["8 Containers Docker (4 APIs + 4 PostgreSQL)"]
    M3_Ref -.->|"Desacoplamento Assíncrono (Módulo 4)"| M4_Ref["Topologia Atual: 9 Containers (RabbitMQ + Transactional Outbox + DLQ)"]
```

- **Módulo 1 — Cloud IaaS:** Toda a aplicação rodava como um único processo Node.js (`:3000`) conectado a um único banco PostgreSQL (`vaptpdv_db`) na EC2. Simples para validar o MVP na nuvem, porém com acoplamento em memória entre domínios.
- **Módulo 2 — Microsserviços Satélites:** Preservou-se o salão no **PDV Core** (`:3000`) e extraíram-se `kds-service` (`:3001`), `caixa-service` (`:3002`) e `gestao-service` (`:3003`) gerenciados via **PM2**, com 4 bancos lógicos (`vaptpdv_db`, `kds_db`, `caixa_db`, `gestao_db`) na VM e **API Gateway e Clientes HTTP** com timeouts e fallback `503`.
- **Módulo 3 — Orquestração em Containers:** Toda a topologia foi empacotada em **8 containers Docker** (`4` APIs + `4` instâncias `postgres:16-alpine`) no `docker-compose.yml`, com isolamento físico dos bancos em volumes `pgdata_*`, builds **multi-stage não-root (`USER node`)**, rede privada **`vaptpdv-net`** e boot determinístico (`service_healthy` + `prisma migrate deploy`).
- **Módulo 4 — Mensageria Assíncrona (Atual):** Adicionou-se o 9º container (**`rabbitmq:3.13-management-alpine`**) com volume `rabbitmq_data` (`1.760 MB` de limite somado no Compose). Eventos pós-commit deixaram de depender de chamadas HTTP ponto a ponto e passaram a ser gravados atomicamente na tabela `outbox_eventos`, publicados no exchange topic `vaptpdv.eventos` e processados com `prefetch(10)`, `eventos_processados`, `ack` manual pós-commit e Dead Letter Queues (`vaptpdv.eventos.dlx` ➔ `*.dlq`) após 3 falhas.

### Comparativo entre os Quatro Módulos

| Dimensão de Engenharia   | Módulo 1 (Cloud IaaS)                    | Módulo 2 (Microsserviços PM2)            | Módulo 3 (Docker Compose)                                       | Módulo 4 (RabbitMQ + Outbox)                                              |
| :----------------------- | :--------------------------------------- | :--------------------------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **Unidade de Deploy**    | Monólito único na VM (`:3000`).          | 4 processos Node.js no PM2.              | 8 containers independentes (4 APIs + 4 Postgres).               | **9 containers independentes** (4 APIs + 4 Postgres + RabbitMQ 3.13).     |
| **Isolamento de Dados**  | 1 banco único (`vaptpdv_db`).            | 4 databases lógicos no mesmo PostgreSQL. | **4 instâncias PostgreSQL isoladas** com volumes `pgdata_*`.    | 4 instâncias PostgreSQL (`pgdata_*`) + volume broker (`rabbitmq_data`).   |
| **Comunicação Eventos**  | Em memória no mesmo processo.            | HTTP ponto a ponto pós-commit.           | HTTP ponto a ponto na rede `vaptpdv-net`.                       | **Híbrida:** HTTP síncrono para decisão + **AMQP + Transactional Outbox**. |
| **Resiliência e Falhas** | Indisponibilidade total em queda.        | Timeout `2s`/`5s` + degradação graciosa. | Reinício isolado + `service_healthy`.                           | **At-least-once sem perda**, desduplicação em banco e **DLQ (3 falhas)**. |
| **Portabilidade / User** | Dependente de Node/Postgres do SO da VM. | Dependente do ambiente da VM e PM2.      | `USER node` (não-root) + 100% reproduzível.                     | `USER node` + topologia RabbitMQ auto-declarada no boot dos serviços.     |

---

## Arquitetura Atual do Sistema

O diagrama abaixo representa a topologia híbrida em execução no **Módulo 4 (9 containers)**:

```mermaid
flowchart TD
    Cliente["Navegador / PWA (Garçom, KDS, Caixa e Gerente)"] -->|"HTTP :3000 (SPA + API + Gateway)"| Core

    subgraph Rede["Rede Docker Bridge: vaptpdv-net"]
        Core["vapt-pdv-core (:3000) - Salão, Cardápio, Outbox e Gateway"]
        KDS["kds-service (:3001) - Cozinha/Bar, Outbox e SLA"]
        Caixa["caixa-service (:3002) - Split Payment, Outbox e Recibo"]
        Gestao["gestao-service (:3003) - Curva ABC, Estoque e BI"]
        MQ{{"rabbitmq (:5672 / :15672)\nvaptpdv.eventos + DLX *.dlq"}}

        PG_Core[("postgres-core (vaptpdv_db)")]
        PG_KDS[("postgres-kds (kds_db)")]
        PG_Caixa[("postgres-caixa (caixa_db)")]
        PG_Gestao[("postgres-gestao (gestao_db)")]
        MQ_Vol[("rabbitmq_data")]

        Core -->|"/kds/*, /caixa/*, /gestao/* (HTTP Síncrono)"| KDS
        Core -->|"/caixa/* (HTTP Síncrono)"| Caixa
        Core -->|"/gestao/* (HTTP Síncrono)"| Gestao

        Core ==>|"AMQP Outbox (item.lancado, comanda.fechada,\ncomanda.cancelada, estoque.movimentado)"| MQ
        KDS ==>|"AMQP Outbox (item.pronto)"| MQ
        Caixa ==>|"AMQP Outbox (comanda.paga)"| MQ

        MQ -->|"kds.item.lancado"| KDS
        MQ -->|"pdv.item.pronto / produtos.comanda.paga"| Core
        MQ -->|"caixa.comanda.fechada"| Caixa
        MQ -->|"gestao.eventos (#)"| Gestao

        Core --> PG_Core
        KDS --> PG_KDS
        Caixa --> PG_Caixa
        Gestao --> PG_Gestao
        MQ --> MQ_Vol
    end
```

---

## Microsserviços e Topologia de Containers

| Container / Serviço | Papel e Rotas Principais | Imagem Base | Porta Host / Rede | Volume / Banco | Limites (CPU / RAM) |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **`vapt-pdv-core`** | Salão, mesas, cardápio, SPA, Gateway (`/kds/*`, `/caixa/*`, `/gestao/*`), Outbox Publisher e consumidor de `pdv.item.pronto` + `produtos.comanda.paga` | `node:20-alpine` (Multi-Stage) | `3000:3000` | — | `0.50` / `256 MB` |
| **`kds-service`** | Fila de preparo cozinha/bar, Outbox (`item.pronto`), consumidor `kds.item.lancado` e Swagger `/docs` | `node:20-alpine` (Multi-Stage) | `3001:3001` | — | `0.25` / `160 MB` |
| **`caixa-service`** | Split Payment, troco, recibo `.paper`, Outbox (`comanda.paga`), consumidor `caixa.comanda.fechada` e `/docs` | `node:20-alpine` (Multi-Stage) | `3002:3002` | — | `0.25` / `160 MB` |
| **`gestao-service`** | BI/OLAP, Curva ABC, estoque crítico, comissões e consumidor universal `gestao.eventos` (`#`) | `node:20-alpine` (Multi-Stage) | `3003:3003` | — | `0.30` / `192 MB` |
| **`rabbitmq`** | Broker AMQP 0-9-1 (`vaptpdv.eventos`, DLX `vaptpdv.eventos.dlx`, 5 filas + 5 DLQs) e Management UI | `rabbitmq:3.13-management-alpine` | `5672:5672` / `15672:15672` | `rabbitmq_data` | `0.50` / `256 MB` |
| **`postgres-core`** | Persistência do núcleo PDV (`vaptpdv_db` + `outbox_eventos` / `eventos_processados`) | `postgres:16-alpine` | `127.0.0.1:5432:5432` | `pgdata_core` | `0.50` / `256 MB` |
| **`postgres-kds`** | Persistência das fichas de preparo (`kds_db` + `outbox_eventos` / `eventos_processados`) | `postgres:16-alpine` | Interna (`vaptpdv-net`) | `pgdata_kds` | `0.25` / `128 MB` |
| **`postgres-caixa`** | Persistência de cobranças, parcelas, recibos e Outbox (`caixa_db`) | `postgres:16-alpine` | Interna (`vaptpdv-net`) | `pgdata_caixa` | `0.25` / `160 MB` |
| **`postgres-gestao`** | Persistência analítica e desduplicação de eventos (`gestao_db`) | `postgres:16-alpine` | Interna (`vaptpdv-net`) | `pgdata_gestao` | `0.30` / `192 MB` |

### Filas AMQP, Routing Keys e Dead Letter Queues (`vaptpdv.eventos` / `vaptpdv.eventos.dlx`)

| Fila Principal (`durable: true`) | Routing Keys (`vaptpdv.eventos`) | DLQ (`vaptpdv.eventos.dlx`) | Consumidor | Efeito Idempotente |
| :--- | :--- | :--- | :--- | :--- |
| **`kds.item.lancado`** | `item.lancado`, `comanda.cancelada` | `kds.item.lancado.dlq` | `kds-service` | Cria ficha (`recebido`) por `item_comanda_id` ou cancela fichas ativas da comanda. |
| **`pdv.item.pronto`** | `item.pronto` | `pdv.item.pronto.dlq` | `vapt-pdv-core` | Marca `status_preparo = 'pronto'` no item correspondente em `itens_comanda`. |
| **`caixa.comanda.fechada`** | `comanda.fechada` | `caixa.comanda.fechada.dlq` | `caixa-service` | Cria ou recalcula a cobrança em `cobrancas_comanda` (`aguardando_pagamento`). |
| **`produtos.comanda.paga`** | `comanda.paga` | `produtos.comanda.paga.dlq` | `vapt-pdv-core` | Executa baixa atômica e idempotente de estoque, quita comanda e emite `estoque.movimentado`. |
| **`gestao.eventos`** | `#` *(todos os eventos)* | `gestao.eventos.dlq` | `gestao-service` | Alimenta projeções OLAP (faturamento diário, Curva ABC, garçons e alertas de estoque). |

---

## Estudo Comparativo: Mensageria (RabbitMQ) vs. Streaming (Kafka / Redpanda)

| Dimensão Arquitetural | Mensageria Tradicional: **RabbitMQ (AMQP 0-9-1)** *(Escolhido)* | Streaming de Eventos: **Apache Kafka / Redpanda** | Impacto no Domínio VaptPDV |
| :--- | :--- | :--- | :--- |
| **Modelo do Broker e Consumidor** | *Smart Broker / Dumb Consumer*: o broker roteia por chaves (`Topic Exchange`), gerencia filas independentes, retentativas e Dead Letter Exchanges (`DLX`). | *Dumb Broker / Smart Consumer*: log distribuído particionado (*append-only*); consumidores controlam cursores (*offsets*) em *Consumer Groups*. | O VaptPDV exige roteamento seletivo por evento (`kds`, `caixa`, `produtos`) com cópia total (`#`) para `gestao-service`, o que a `Topic Exchange` resolve nativamente. |
| **Confirmação (`ACK`) e DLQ** | Confirmação individual por mensagem (`ack` / `nack`). Uma falha é isolada na `.dlq` sem travar as demais mensagens da fila. | Confirmação sequencial por *offset* da partição. Uma mensagem venenosa (*poison pill*) pode bloquear a partição ou requer produtor auxiliar de DLQ. | Se uma baixa de estoque falhar após 3 tentativas, apenas aquela comanda vai para `produtos.comanda.paga.dlq`, mantendo as outras mesas fluindo normalmente. |
| **Retenção e *Event Replay*** | Transitória: a mensagem sai da fila após o `ack` manual pós-commit. | Persistente por retenção configurável (dias/meses), permitindo *Event Replay* desde o `offset = 0`. | Como cada serviço persiste seu estado consolidado em PostgreSQL próprio (`kds_db`, `caixa_db`, `gestao_db`), não há necessidade de replay histórico no broker. |
| **Latência e Throughput** | Latência baixíssima (`< 5ms` a `20ms`) com throughput de dezenas de milhares de msg/s. | Throughput massivo (centenas de milhares a milhões de eventos/s) com ordenação por chave de partição. | A operação de bar/restaurante gera dezenas de eventos por minuto e prioriza entrega imediata à cozinha/caixa com baixa complexidade. |
| **Pegada na AWS EC2** | **~100 MB a 150 MB de RAM** em repouso (limite `256 MB` com UI de gerência inclusa). | **500 MB a > 1.5 GB de RAM** (mesmo sem ZooKeeper ou com Redpanda). | Na EC2 com 4 APIs Node.js e 4 bancos PostgreSQL, o RabbitMQ preserva folga de memória sem risco de *OOM*. |

**Conclusão Arquitetural:** O **RabbitMQ** aliado ao padrão **Transactional Outbox** e desduplicação por `evento_id` entrega semântica *at-least-once* confiável, roteamento flexível via `Topic Exchange` e isolamento nativo de falhas em `.dlq` com menor consumo de memória para o porte operacional do VaptPDV. O Kafka/Redpanda passaria a ser a escolha superior caso o sistema evoluísse para ingestão em alta escala (milhares de lojas simultâneas) ou exigisse *Event Sourcing / Replay* completo de logs analíticos.

---

## Tecnologias Utilizadas

| Categoria               | Tecnologia                                         | Justificativa Técnica                                                                                                      |
| :---------------------- | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Web/PWA**    | React 19, TypeScript 5.7, Vite 8, Tailwind CSS 3.4 | Interface modular e responsiva, com tipagem estática e empacotamento PWA (`vite-plugin-pwa`).                              |
| **Estado e Dados (UI)** | TanStack Query v5 & Zustand v5                     | Sincronização automática de estado remoto (polling de mesas/KDS) e estado global leve no cliente.                          |
| **Runtime & APIs**      | Node.js 20 LTS, Fastify 5, TypeBox                 | Alta vazão com baixo consumo de memória, validação estrita de schemas em runtime e tipagem ponta a ponta.                  |
| **Documentação de API** | `@fastify/swagger` & `@fastify/swagger-ui`         | Geração interativa de contratos OpenAPI diretamente a partir dos schemas TypeBox nos 4 serviços.                           |
| **ORM e Persistência**  | Prisma ORM 6.4 & PostgreSQL 16                     | Migrações versionadas (`prisma migrate deploy`), integridade transacional e isolamento completo _Database-per-Service_.    |
| **Mensageria & Outbox** | RabbitMQ 3.13, `amqplib` & Transactional Outbox    | Broker AMQP 0-9-1 com exchange `topic`, DLX/DLQ após 3 falhas, `ack` manual pós-commit e desduplicação por `evento_id`.   |
| **Containers**          | Docker (Multi-Stage) & Docker Compose v2           | Imagens minimalistas sem privilégios de root (`USER node`), rede privada e volumes persistentes para paridade local/nuvem. |
| **Testes e Linting**    | Vitest & Oxlint                                    | Suíte de testes unitários/integração por serviço e verificação estática rápida no frontend.                                |

---

## Estrutura do Repositório

```text
vapt-pdv/
├── README.md                           # Documentação principal e guia de execução
├── docker-compose.yml                  # Orquestração dos 9 containers (4 APIs + 4 Postgres + RabbitMQ)
├── .env.docker.example                 # Template seguro de variáveis para execução em containers
├── .dockerignore                       # Exclusões para builds Docker enxutos
│
├── backend/                            # PDV Core (Salão, Comandas, Catálogo, Gateway e SPA Host)
│   ├── Dockerfile                      # Build multi-stage (compila frontend + backend -> USER node)
│   ├── .env.example                    # Template de variáveis para execução local
│   ├── prisma/                         # Schema (vaptpdv_db), migrações e seed-produtos.sql
│   ├── public/                         # Build estático compilado do frontend
│   ├── src/                            # app.ts, server.ts, gateways e módulos (comandas, produtos, usuarios, saude)
│   └── test/                           # Suíte Vitest
│
├── frontend/                           # Aplicação Web/PWA (React 19 + Vite 8 + Tailwind CSS)
│   ├── vite.config.ts                  # Proxy de dev para /comandas, /produtos, /usuarios, /kds, /caixa, /gestao
│   └── src/                            # features (auth, garcom, kds, caixa, gestao), hooks, services, stores
│
└── services/                           # Microsserviços Satélites Independentes
    ├── kds-service/                    # Cozinha & Bar (:3001) - fichas, SLA e /docs
    ├── caixa-service/                  # Frente de Caixa (:3002) - split payment, estorno, recibo .paper e /docs
    └── gestao-service/                 # Gestão & Analytics (:3003) - Curva ABC, comissões e /docs
```

---

## Guia Passo a Passo de Execução

### Modo A: Orquestração Completa em Containers (Módulo 4 - Recomendado)

Sobe todos os **9 containers** (4 APIs + 4 instâncias PostgreSQL + RabbitMQ Management) com migrações Prisma automáticas, topologia AMQP declarativa, healthchecks e volumes persistentes.

#### Pré-requisitos

- **Docker Engine** e **Docker Compose v2** (`docker compose version`)
- **Git**

#### Passo 1 — Criar o arquivo `.env` na raiz a partir de [`.env.docker.example`](./.env.docker.example)

- **Linux / macOS / Git Bash:**
  ```bash
  cp .env.docker.example .env
  ```
- **Windows PowerShell:**
  ```powershell
  Copy-Item .env.docker.example .env
  ```

#### Passo 2 — Construir as imagens e iniciar os 9 containers

```bash
docker compose up -d --build
```

#### Passo 3 — Verificar saúde dos serviços

Confirme que todos os 9 containers atingiram o estado `healthy`:

```bash
docker compose ps
```

Valide os endpoints de saúde das quatro APIs:

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

#### Passo 4 — *(Opcional)* Carregar cardápio inicial de demonstração

- **Linux / macOS / Git Bash:**
  ```bash
  docker compose exec -T postgres-core psql -U vaptpdv -d vaptpdv_db < backend/prisma/seed-produtos.sql
  ```
- **Windows PowerShell:**
  ```powershell
  Get-Content backend/prisma/seed-produtos.sql -Raw | docker compose exec -T postgres-core psql -U vaptpdv -d vaptpdv_db
  ```

#### Passo 5 — Acessar a aplicação e documentações locais

- **Frontend Web/PWA:** [http://localhost:3000](http://localhost:3000)
- **Swagger PDV Core:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **Swagger KDS Service:** [http://localhost:3001/docs](http://localhost:3001/docs)
- **Swagger Caixa Service:** [http://localhost:3002/docs](http://localhost:3002/docs)
- **Swagger Gestão Service:** [http://localhost:3003/docs](http://localhost:3003/docs)
- **RabbitMQ Management UI:** [http://localhost:15672](http://localhost:15672) *(usuário e senha padrão definidos em [`.env.docker.example`](./.env.docker.example): `vaptpdv` / `vaptpdv_secret`)*

---

### Modo B: Execução Local para Desenvolvimento (Node.js + TSX Watch)

Indicado para desenvolvimento com _hot reload_ fora de containers.

#### Pré-requisitos

- **Node.js 20 LTS ou superior**
- **PostgreSQL 16** com os quatro bancos criados (`vaptpdv_db`, `kds_db`, `caixa_db`, `gestao_db`)
  > **Importante:** No `docker-compose.yml`, apenas `postgres-core` expõe `127.0.0.1:5432` para o host; `postgres-kds`, `postgres-caixa` e `postgres-gestao` ficam isolados dentro da rede `vaptpdv-net`. Para rodar os satélites fora de containers, utilize uma instância PostgreSQL local.

#### Passo 1 — Configurar `.env` locais e instalar dependências

Configure os arquivos `.env` individuais de cada serviço (`backend/.env`, `services/kds-service/.env`, `services/caixa-service/.env` e `services/gestao-service/.env`, tomando como base os respectivos `.env.example`, incluindo `RABBITMQ_URL` se quiser ativar o broker localmente) e execute `npm install` em `backend/`, `frontend/` e nos três diretórios de `services/`.

#### Passo 2 — Gerar clientes Prisma e aplicar migrações

Execute em cada um dos quatro serviços backend:

```bash
npx prisma generate
npx prisma migrate deploy
```

#### Passo 3 — Subir os serviços em terminais separados

```bash
# Terminal 1 - PDV Core (:3000)
cd backend && npm run dev

# Terminal 2 - KDS Service (:3001)
cd services/kds-service && npm run dev

# Terminal 3 - Caixa Service (:3002)
cd services/caixa-service && npm run dev

# Terminal 4 - Gestão Service (:3003)
cd services/gestao-service && npm run dev

# Terminal 5 (Opcional) - Frontend Vite Dev Server (:5173)
cd frontend && npm run dev
```

---

## Testes Documentados e Verificação dos Módulos

### 1. Módulo 1 — API REST Pública (CRUD em Nuvem)

Substitua `http://localhost:3000` por `http://54.234.157.236:3000` para validar diretamente contra a instância publicada na AWS EC2:

```bash
# 1. Healthcheck do núcleo e banco PostgreSQL
curl -s http://54.234.157.236:3000/health
# Resposta esperada (200 OK):
# {"status":"ok","servico":"vapt-pdv-core","banco":"conectado","timestamp":"..."}

# 2. Criar produto (Create)
curl -s -X POST http://54.234.157.236:3000/produtos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Porção de Fritas","categoria":"Porções","preco":"25.00","estoque":30,"estoque_minimo":5}'

# 3. Listar produtos (Read)
curl -s http://54.234.157.236:3000/produtos

# 4. Atualizar produto (Update)
curl -s -X PATCH http://54.234.157.236:3000/produtos/1 \
  -H "Content-Type: application/json" \
  -d '{"preco":"27.50"}'

# 5. Inativar produto (Delete lógico)
curl -s -X POST http://54.234.157.236:3000/produtos/1/inativar
```

### 2. Módulo 2 — Comunicação HTTP entre Microsserviços e Degradação Graciosa

```bash
# 1. Consultar fila de preparo do KDS através do API Gateway do Core (:3000 -> :3001)
curl -s http://localhost:3000/kds/fichas

# 2. Consultar resumo financeiro do Gestão através do API Gateway (:3000 -> :3003)
curl -s http://localhost:3000/gestao/resumo-diario

# 3. Simular indisponibilidade de um satélite (ex.: parar kds-service) e validar resposta amigável 503:
docker compose stop kds-service
curl -i http://localhost:3000/kds/fichas
# Resposta esperada (503 Service Unavailable):
# {"erro":{"codigo":"SERVICO_INDISPONIVEL","mensagem":"O microsserviço satélite solicitado está temporariamente indisponível.","detalhes":{"destino":"http://kds-service:3001/kds/fichas"}}}

# Restaurar o serviço após o teste:
docker compose start kds-service
```

### 3. Módulo 3 — Persistência em Volumes e Suítes Automatizadas

A persistência dos dados entre ciclos `docker compose down` e `docker compose up -d` (preservando os volumes `pgdata_*`) é demonstrada no vídeo da entrega do Módulo 3 ([Acervo no Google Drive](https://drive.google.com/drive/folders/1GzLecg9bSraN3ZjB7usL9Mg3I03I1uzm?usp=sharing)).

Para executar a suíte de testes automatizados e verificação de tipos em todos os módulos localmente:

```bash
npm --prefix backend test
npm --prefix services/kds-service test
npm --prefix services/caixa-service test
npm --prefix services/gestao-service test
npm --prefix frontend test
```

### 4. Módulo 4 — Mensageria RabbitMQ, Outbox, Idempotência e DLQ

Com o ambiente em execução via `docker compose up -d`, valide a topologia e a entrega garantida mesmo sob queda temporária de um consumidor:

```bash
# 1. Conferir os 9 containers saudáveis e inspecionar filas/mensagens no broker
docker compose ps
docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers

# 2. Simular indisponibilidade temporária do kds-service mantendo a venda no PDV Core:
docker compose stop kds-service

# Lance um item na comanda (via UI :3000/garcom ou POST /comandas/:id/itens)
# O Core gravará o evento em vaptpdv_db.outbox_eventos e o publicará em vaptpdv.eventos;
# a mensagem permanecerá acumulada na fila durável "kds.item.lancado":
docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers

# 3. Subir o kds-service novamente e observar o consumo automático + ack manual:
docker compose start kds-service
docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers
```

No painel web **RabbitMQ Management** (`http://localhost:15672`), é possível acompanhar em **Exchanges** (`vaptpdv.eventos` e `vaptpdv.eventos.dlx`) e **Queues and Streams** as 5 filas principais, as 5 filas `.dlq` e o fluxo em tempo real de `Publish` / `Deliver (manual ack)` sem perda de eventos.
