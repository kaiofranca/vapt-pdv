# VaptPDV - Sistema de Ponto de Venda (Módulo 1: Computação em Nuvem)

> Trabalho prático e incremental desenvolvido para a disciplina de **Sistemas Distribuídos**
>
> **Departamento de Ciência da Computação (DCC / UERN)**
>
> **Integrantes:** Kaio França e Mateus Neri

## Visão Geral do Projeto

O **VaptPDV** é um sistema de ponto de venda (PDV) para bares, botecos e lanchonetes de pequeno porte. Ele substitui comanda em papel por registros digitais unificados: o garçom abre uma comanda por mesa, lança o consumo, o caixa fecha a conta e registra o pagamento, e o gerente acompanha o histórico do estabelecimento.

Neste **Módulo 1 (Computação em Nuvem / IaaS)**, foi implantada a primeira versão funcional da API REST em uma instância de nuvem (AWS EC2), acompanhada de um banco de dados relacional PostgreSQL hospedado na própria máquina virtual, com variáveis de ambiente isoladas e documentação interativa OpenAPI/Swagger acessível publicamente.

## API em Execução na Nuvem

A API do VaptPDV está totalmente implantada e disponível publicamente na AWS:

* **Documentação Interativa (Swagger / OpenAPI):** <http://54.234.157.236:3000/docs>

* **Base URL da API:** `http://54.234.157.236:3000`

## Stack Tecnológica

* **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (Node.js v20 LTS)

* **Framework Web:** [Fastify](https://fastify.dev/) (Alta performance e validação declarativa de schemas)

* **ORM:** [Prisma ORM](https://www.prisma.io/)

* **Banco de Dados:** [PostgreSQL](https://www.postgresql.org/)

* **Documentação de API:** Swagger / OpenAPI (`@fastify/swagger` e `@fastify/swagger-ui`)

* **Testes Automatizados:** [Vitest](https://vitest.dev/)

* **Hospedagem / Nuvem (IaaS):** [AWS EC2](https://aws.amazon.com/ec2/) (Ubuntu Server)

* **Gerenciador de Processos:** [PM2](https://pm2.keymetrics.io/)

## Vídeo de Demonstração (Módulo 1)

> [Link do Vídeo](https://drive.google.com/drive/folders/1GzLecg9bSraN3ZjB7usL9Mg3I03I1uzm?usp=sharing)

*(O vídeo demonstra a API publicada na AWS EC2 respondendo a requisições de CRUD, conectando ao banco PostgreSQL e comprovando o acesso público via URL do servidor).*

## Instruções de Execução Local

### Pré-requisitos

* Node.js (v20 ou superior)

* NPM ou Yarn

* Instância local ou contêiner do PostgreSQL

### Passo a Passo

1. **Clonar o repositório:**

   ```
   git clone https://github.com/usuario/vapt-pdv.git
   cd vapt-pdv
   
   ```

2. **Instalar as dependências:**

   ```
   npm install
   
   ```

3. **Configurar o arquivo de ambiente:**

   ```
   cp .env.example .env
   
   ```

   *Ajuste a variável `DATABASE_URL` no `.env` conforme suas credenciais locais do PostgreSQL.*

4. **Executar as migrações do banco (Prisma):**

   ```
   npx prisma migrate dev
   
   ```

5. **Iniciar a aplicação em modo de desenvolvimento:**

   ```
   npm run dev
   
   ```

   A API estará acessível em `http://localhost:3000` e a documentação interativa em `http://localhost:3000/docs`.

## Executando os Testes Automatizados

Os testes automatizados foram construídos utilizando o **Vitest**.

Para executar a suíte completa de testes unitários e de integração:

```
npm run test

```

Para executar os testes em modo contínuo (*watch mode*):

```
npm run test:watch

```

## Infraestrutura e Deploy na Nuvem (IaaS)

1. Instância **AWS EC2** provisionada com sistema operacional Ubuntu Server.

2. Instalação e configuração manual do servidor de banco de dados **PostgreSQL**.

3. Liberação de regras de firewall nos *Security Groups* da AWS e `iptables` interno para a porta `3000`.

4. Gerenciamento do processo em background via **PM2** (`pm2 start dist/server.js --name vaptpdv-api`), garantindo *uptime* contínuo e reinicialização automática.
