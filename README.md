# VaptPDV

Sistema Distribuído de Ponto de Venda para Bares e Lanchonetes — Projeto incremental da 3ª Unidade de Sistemas Distribuídos (DCC/UERN).

## Pré-requisitos

- **Node.js** `>=20` (recomendado usar a versão definida em `.nvmrc`)
- **PostgreSQL** (local ou instalado na instância AWS EC2)

## Configuração Local

1. Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env
```

2. Preencha `DATABASE_URL` no arquivo `.env` com a string de conexão do seu banco PostgreSQL.

3. Instale as dependências e gere o cliente Prisma:

```bash
npm install
npm run prisma:generate
```

> **Nota para Windows PowerShell:** caso a execução de scripts `.ps1` esteja bloqueada na sua sessão, utilize `npm.cmd` no lugar de `npm` (ex.: `npm.cmd install`, `npm.cmd test`).

## Comandos Principais

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor em modo de desenvolvimento com recarregamento automático (`tsx watch`) |
| `npm run build` | Compila o projeto TypeScript para `dist/` |
| `npm start` | Executa a versão compilada (`node dist/server.js`) |
| `npm run typecheck` | Valida tipos TypeScript sem emitir arquivos (`tsc --noEmit`) |
| `npm test` | Executa a suíte de testes automatizados (Vitest) |
| `npm run prisma:generate` | Gera o cliente do Prisma (`@prisma/client`) |
| `npm run prisma:migrate` | Cria e aplica migrações em ambiente de desenvolvimento |
| `npm run prisma:deploy` | Aplica migrações pendentes em produção |

## Endpoints de Infraestrutura

- `GET /health` — Verificação de saúde da aplicação e conectividade com o banco de dados (`SELECT 1`).
- `GET /docs` — Documentação interativa OpenAPI / Swagger UI.

## Arquitetura (Monólito Modular em Nuvem)

O código-fonte segue fronteiras explícitas de contexto em `src/modules/{usuarios,produtos,comandas}`, preparando a evolução para microsserviços nos módulos seguintes.
