# VaptPDV

> Trabalho prático e incremental desenvolvido para a disciplina de **Sistemas Distribuídos**  
> **Departamento de Ciência da Computação (DCC / UERN)**  
> **Docentes:** Profa. Dra. Glaucia Melissa e Profa. Ma. Luiziane Paulino dos Santos  
> **Discentes:** Kaio França e Mateus Neri  

---

## 1. Visão geral do projeto

O **VaptPDV** é um sistema distribuído de Ponto de Venda (PDV) para bares, botecos e lanchonetes de pequeno e médio porte. Ele substitui comandas manuais de papel por registros digitais unificados e confiáveis:
- O **Garçom** abre comanda por mesa livre e lança pedidos com garantia de produto ativo e congelamento imediato de preço;
- A **Cozinha/Bar** recebe os pedidos para preparo;
- O **Caixa** fecha a conta aplicando opcionalmente a taxa de serviço de 10%, confere os valores e recebe o pagamento (`dinheiro`, `pix`, `cartao`);
- O **Estoque** tem baixa transacional, atômica e idempotente no ato do pagamento;
- O **Gerente** acompanha o histórico de consumo, faturamento e relatórios.

Neste **Módulo 1 (Computação em Nuvem / IaaS)**, o **PDV Core** foi construído e implantado em máquina virtual na nuvem (**AWS EC2**), acompanhado de um banco relacional **PostgreSQL** instalado diretamente na VM, arquitetura em camadas desacopladas (Entity, Repository, Service, Controller e Rotas), documentação interativa OpenAPI/Swagger pública e Frontend Web/PWA integrado (Modo Garçom mobile-first e Modo Caixa desktop) servido na própria raiz.

---

## 2. Aplicação em execução na nuvem (AWS EC2)

A API e interface do VaptPDV estão disponíveis publicamente na AWS:

* **Aplicação Web / PDV Core:** [http://54.234.157.236:3000](http://54.234.157.236:3000)
* **Documentação Interativa (Swagger / OpenAPI):** [http://54.234.157.236:3000/docs](http://54.234.157.236:3000/docs)
* **Verificação de Saúde (Health Check):** [http://54.234.157.236:3000/health](http://54.234.157.236:3000/health)

### Vídeo de demonstração (Módulo 1)
* [Pasta do Vídeo no Google Drive](https://drive.google.com/drive/folders/1GzLecg9bSraN3ZjB7usL9Mg3I03I1uzm?usp=sharing)  
*(Demonstra a aplicação publicada na AWS EC2 respondendo a requisições, conectando ao banco PostgreSQL e comprovando o acesso público).*

---

## 3. Stack tecnológica

* **Linguagem & Runtime:** [TypeScript 5](https://www.typescriptlang.org/) / [Node.js 20 LTS](https://nodejs.org/)
* **Framework Web:** [Fastify 5](https://fastify.dev/) (Alta performance e validação declarativa via TypeBox)
* **ORM & Banco de Dados:** [Prisma ORM 6](https://www.prisma.io/) com [PostgreSQL 16](https://www.postgresql.org/) (`NUMERIC(10,2)` para precisão monetária contábil)
* **Frontend Web/PWA:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand (Modo Garçom mobile-first, Modo Caixa desktop, Painel TV KDS para cozinha/bar e Painel Executivo de Gestão)
* **Testes Automatizados:** [Vitest](https://vitest.dev/) (**331 testes automatizados passando verde** no ecossistema: 180 no PDV Core, 75 no Frontend Web/PWA, 22 no `kds-service`, 39 no `caixa-service` e 15 no `gestao-service`)
* **Hospedagem Cloud (IaaS):** [AWS EC2](https://aws.amazon.com/ec2/) (Ubuntu Server LTS)
* **Gerenciador de Processos:** [PM2](https://pm2.keymetrics.io/)

---

## 4. Documentação oficial de engenharia

O projeto conta com documentação formal na pasta [`docs/engenharia/`](docs/engenharia/):

| Documento | Descrição |
| :--- | :--- |
| [01-visao-e-escopo.md](docs/engenharia/01-visao-e-escopo.md) | Problema, Personas, Matriz de Valor, KPIs e Divisão de Papéis |
| [02-especificacao-requisitos-srs.md](docs/engenharia/02-especificacao-requisitos-srs.md) | SRS IEEE 830: 33 RFs, 22 Regras de Negócio e 12 RNFs |
| [03-arquitetura-c4-model.md](docs/engenharia/03-arquitetura-c4-model.md) | Modelo C4 (Contexto, Contêineres, Componentes e Implantação) e ADRs |
| [04-modelo-dados-e-dominio.md](docs/engenharia/04-modelo-dados-e-dominio.md) | DDD, DER dos 4 Bancos, Dicionário de Dados e Índices Únicos Parciais |
| [05-contrato-apis-e-eventos.md](docs/engenharia/05-contrato-apis-e-eventos.md) | Contratos REST JSON e Catálogo de Eventos RabbitMQ |
| [08-ux-e-experiencia-frontend.md](docs/engenharia/08-ux-e-experiencia-frontend.md) | UX/UI Design System, 5 Telas Oficiais (Garçom, Caixa, KDS) e Mapeamento REST |

---

## 6. Instruções de execução local

### Pré-requisitos
* Node.js (v20 ou superior)
* PostgreSQL (v14 ou superior local ou Docker)

### Passo a Passo

1. **Instalar as dependências:**
   ```bash
   npm install
   ```

2. **Configurar as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```
   *Edite a variável `DATABASE_URL` no `.env` com os dados de conexão do seu PostgreSQL local.*

3. **Executar as migrações do banco (Prisma):**
   ```bash
   npx prisma migrate dev
   ```

4. **Executar a suíte de testes automatizados:**
   ```bash
   npm test
   ```

5. **Iniciar a aplicação em modo desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação em `http://localhost:3000` e a documentação interativa em `http://localhost:3000/docs`.

6. **Gerar build de produção:**
   ```bash
   npm run build
   npm start
   ```
