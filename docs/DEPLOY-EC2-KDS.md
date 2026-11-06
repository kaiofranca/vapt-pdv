# Guia de Deploy na AWS EC2: Ecossistema Completo VaptPDV

> **Trabalho prático - Sistemas Distribuídos (DCC / UERN)**  
> **Arquitetura Módulo 2:** PDV Core Salão (`:3000`) + 3 Microsserviços Satélites (`:3001`, `:3002`, `:3003`) + Frontend Web/PWA + 4 Bancos Isolados (`Database-per-Service`).

Este documento é o roteiro operacional oficial para implantar, configurar e gerenciar em produção na máquina virtual **AWS EC2 (Ubuntu Server LTS)** o ecossistema distribuído completo do **VaptPDV**:
- **PDV Core Salão (`vapt-pdv-core`):** Porta `:3000` / Banco `vapt_pdv` (e servidor SPA do Frontend Web/PWA)
- **KDS Service (`kds-service`):** Porta `:3001` / Banco `kds_db` (Cozinha e Bar)
- **Caixa Service (`caixa-service`):** Porta `:3002` / Banco `caixa_db` (Split Payment e Cobranças)
- **Gestão Service (`gestao-service`):** Porta `:3003` / Banco `gestao_db` (Analytics OLAP e BI)

---

## 1. Topologia da Instância AWS EC2 & Firewall (Security Group)

```mermaid
flowchart TD
    Internet(("🌐 Internet / Navegadores"))

    subgraph AWS["☁️ Instância AWS EC2 (Ubuntu Server LTS)"]
        subgraph SG["🔒 Security Group (Inbound Rules)"]
            P22["Porta 22 (SSH)"]
            P3000["Porta 3000 (PDV Core & Frontend Web/PWA)"]
            P3001["Porta 3001 (KDS Service)"]
            P3002["Porta 3002 (Caixa Service)"]
            P3003["Porta 3003 (Gestão Service)"]
        end

        subgraph PM2["⚙️ Gerenciador de Processos PM2"]
            Core["vapt-pdv-core (:3000)<br>• Salão, Mesas, Comandas<br>• Servindo SPA Frontend"]
            KDS["kds-service (:3001)<br>• Cozinha e Bar"]
            Caixa["caixa-service (:3002)<br>• Split Payment & Troco"]
            Gestao["gestao-service (:3003)<br>• BI, Curva ABC, Estoque"]
        end

        subgraph Postgres["🐘 PostgreSQL (:5432 - Acesso Local)"]
            DB1[("vapt_pdv")]
            DB2[("kds_db")]
            DB3[("caixa_db")]
            DB4[("gestao_db")]
        end
    end

    Internet --> P22
    Internet --> P3000
    Internet --> P3001
    Internet --> P3002
    Internet --> P3003

    P3000 --> Core
    P3001 --> KDS
    P3002 --> Caixa
    P3003 --> Gestao

    Core --- DB1
    KDS --- DB2
    Caixa --- DB3
    Gestao --- DB4

    Core -.->|"HTTP (Timeout 2s)"| KDS
    Caixa -.->|"HTTP (Baixa Estoque)"| Core
    Caixa -.->|"HTTP (Eventos Venda)"| Gestao
```

### Configuração Obrigatória do Security Group (AWS Console)
Antes ou logo após o deploy, certifique-se de liberar as seguintes **Regras de Entrada (Inbound Rules)** no console da AWS:

| Tipo | Protocolo | Intervalo de Portas | Origem | Finalidade |
| :--- | :---: | :---: | :---: | :--- |
| **SSH** | TCP | `22` | `Seu IP` ou `0.0.0.0/0` | Acesso administrativo remoto via terminal |
| **Custom TCP** | TCP | `3000` | `0.0.0.0/0` | **PDV Core** e **Frontend Web/PWA** (Garçom, Caixa, KDS, Gestão) |
| **Custom TCP** | TCP | `3001` | `0.0.0.0/0` | **KDS Service** (API e Swagger da Cozinha/Bar) |
| **Custom TCP** | TCP | `3002` | `0.0.0.0/0` | **Caixa Service** (API e Swagger do Fechamento e Split) |
| **Custom TCP** | TCP | `3003` | `0.0.0.0/0` | **Gestão Service** (API e Swagger de Analytics e BI) |

> ⚠️ **Nota de Segurança:** A porta do PostgreSQL (`5432`) **NÃO** deve ser aberta para o mundo (`0.0.0.0/0`). Os microsserviços e o banco rodam na mesma VM (ou na mesma rede interna Docker), conectando-se em `localhost:5432`.

---

## 2. Pré-requisito Vital na EC2: Memória Swap (Para Instâncias t2.micro / t3.micro)

Instâncias do Free Tier da AWS (`t2.micro` ou `t3.micro`) possuem apenas 1 GB de memória RAM. A compilação do TypeScript e o build do React 19 / Vite podem disparar o erro `JavaScript heap out of memory` caso não haja memória swap configurada.

Conecte-se via SSH na sua instância e execute:

```bash
# 1. Cria um arquivo de swap de 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 2. Torna o swap permanente após reboots da máquina
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Confirma se o swap está ativo (deve mostrar ~2GB)
free -h
```

---

## 3. Caminho A: PostgreSQL Nativo na VM EC2 + PM2 (Padrão Recomendado M2)

Neste caminho, o PostgreSQL roda nativamente no Ubuntu da EC2 (via `systemctl`), e os 4 bancos isolados coexistem na mesma instância do SGBD com segurança.

### Passo 1: Atualizar o Repositório na VM EC2
```bash
cd ~/vapt-pdv
git fetch origin
git pull origin main
```

---

### Passo 2: Criar os 4 Bancos de Dados Isolados no PostgreSQL
No PostgreSQL nativo da EC2, execute com o usuário administrador `postgres`:

```bash
# Criação dos 4 bancos de dados isolados (Database-per-Service)
sudo -u postgres psql -c "CREATE DATABASE vapt_pdv;"
sudo -u postgres psql -c "CREATE DATABASE kds_db;"
sudo -u postgres psql -c "CREATE DATABASE caixa_db;"
sudo -u postgres psql -c "CREATE DATABASE gestao_db;"

# (Opcional) Caso use um usuário dedicado da aplicação (ex: userkaio ou vaptuser), conceda permissão total:
# Substitua 'SEU_USUARIO' pelo usuário configurado no seu banco
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vapt_pdv TO SEU_USUARIO;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kds_db TO SEU_USUARIO;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE caixa_db TO SEU_USUARIO;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gestao_db TO SEU_USUARIO;"
```

Para verificar se os 4 bancos foram criados:
```bash
sudo -u postgres psql -c "\l"
```

---

### Passo 3: Configurar os Arquivos `.env` dos 4 Serviços

#### 1. PDV Core (`backend/.env`):
```bash
cd ~/vapt-pdv/backend
cp .env.example .env
nano .env
```
Conteúdo do `backend/.env`:
```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://SEU_USUARIO:SUA_SENHA@localhost:5432/vapt_pdv?schema=public"
KDS_SERVICE_URL="http://localhost:3001"
```

#### 2. KDS Service (`services/kds-service/.env`):
```bash
cd ~/vapt-pdv/services/kds-service
cp .env.example .env
nano .env
```
Conteúdo do `services/kds-service/.env`:
```env
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://SEU_USUARIO:SUA_SENHA@localhost:5432/kds_db?schema=public"
```

#### 3. Caixa Service (`services/caixa-service/.env`):
```bash
cd ~/vapt-pdv/services/caixa-service
cp .env.example .env
nano .env
```
Conteúdo do `services/caixa-service/.env`:
```env
PORT=3002
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://SEU_USUARIO:SUA_SENHA@localhost:5432/caixa_db?schema=public"
CORE_API_URL="http://localhost:3000"
GESTAO_API_URL="http://localhost:3003"
```

#### 4. Gestão Service (`services/gestao-service/.env`):
```bash
cd ~/vapt-pdv/services/gestao-service
cp .env.example .env
nano .env
```
Conteúdo do `services/gestao-service/.env`:
```env
PORT=3003
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://SEU_USUARIO:SUA_SENHA@localhost:5432/gestao_db?schema=public"
```

---

### Passo 4: Instalar Dependências e Aplicar Migrações Prisma nos 4 Bancos

Em ambiente de produção, utilizamos estritamente `npx prisma migrate deploy` para aplicar as migrações versionadas sem confirmações interativas:

```bash
# 1. Migrações do PDV Core
cd ~/vapt-pdv/backend
npm install
npx prisma generate
npx prisma migrate deploy

# 2. Migrações do KDS Service
cd ~/vapt-pdv/services/kds-service
npm install
npx prisma generate
npx prisma migrate deploy

# 3. Migrações do Caixa Service
cd ~/vapt-pdv/services/caixa-service
npm install
npx prisma generate
npx prisma migrate deploy

# 4. Migrações do Gestão Service
cd ~/vapt-pdv/services/gestao-service
npm install
npx prisma generate
npx prisma migrate deploy
```

#### Carga Inicial do Catálogo de Produtos Reais (24 Produtos):
Insira o cardápio oficial no banco do PDV Core:
```bash
sudo -u postgres psql -d vapt_pdv < ~/vapt-pdv/backend/prisma/seed-produtos.sql
```

---

### Passo 5: Compilar o Frontend Web/PWA e Gerar os Estáticos

O PDV Core (`:3000`) serve os arquivos estáticos compilados do frontend com fallback SPA para `/garcom`, `/caixa`, `/kds`, `/gestao` e `/login`:

```bash
cd ~/vapt-pdv/frontend
npm install
npm run build
```
*(O build do Vite compila a interface e publica os artefatos diretamente na pasta `backend/public/`).*

---

### Passo 6: Compilar os Códigos TypeScript de Produção

Compile o TypeScript dos 4 backends:

```bash
# Build do Core
cd ~/vapt-pdv/backend && npm run build

# Build do KDS
cd ~/vapt-pdv/services/kds-service && npm run build

# Build do Caixa
cd ~/vapt-pdv/services/caixa-service && npm run build

# Build da Gestão
cd ~/vapt-pdv/services/gestao-service && npm run build
```

---

### Passo 7: Gerenciar e Subir os 4 Microsserviços com PM2

Inicie os 4 processos em background gerenciados pelo PM2:

```bash
# 1. Iniciar PDV Core (:3000)
cd ~/vapt-pdv/backend
pm2 start dist/server.js --name vapt-pdv-core

# 2. Iniciar KDS Service (:3001)
cd ~/vapt-pdv/services/kds-service
pm2 start dist/server.js --name kds-service

# 3. Iniciar Caixa Service (:3002)
cd ~/vapt-pdv/services/caixa-service
pm2 start dist/server.js --name caixa-service

# 4. Iniciar Gestão Service (:3003)
cd ~/vapt-pdv/services/gestao-service
pm2 start dist/server.js --name gestao-service

# Salva a lista de processos para auto-start no boot do sistema
pm2 save
pm2 startup
```
*(Se o `pm2 startup` exibir um comando `sudo env PATH=...`, copie e execute-o conforme instruído na tela).*

---

## 4. Caminho B: Docker Compose na AWS EC2 (Preparatório Módulo 3)

Se você optar por rodar a infraestrutura de banco de dados via Docker na própria EC2:

### Passo 1: Instalar Docker e Docker Compose na EC2
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

> ⚠️ Se o PostgreSQL nativo estiver rodando, pare-o para liberar a porta `5432`:
> ```bash
> sudo systemctl stop postgresql && sudo systemctl disable postgresql
> ```

### Passo 2: Subir os 4 Bancos com Docker Compose
Na raiz do repositório (`~/vapt-pdv`):
```bash
cd ~/vapt-pdv
docker compose up -d
```
*(O script `docker/init-multi-db.sql` criará automaticamente os 4 bancos `vapt_pdv`, `kds_db`, `caixa_db` e `gestao_db` no boot do container).*

Em seguida, execute os **Passos 3, 4, 5, 6 e 7 do Caminho A** normalmente para aplicar migrações, compilar e subir os serviços via PM2!

---

## 5. Verificação de Saúde e Testes em Produção

### 1. Status dos Processos no PM2
Execute na VM:
```bash
pm2 status
```
Todos os 4 serviços devem exibir status **`online`**:
- `vapt-pdv-core` (`:3000`)
- `kds-service` (`:3001`)
- `caixa-service` (`:3002`)
- `gestao-service` (`:3003`)

### 2. Health Checks Internos (via `curl` na VM)
```bash
curl -X GET http://localhost:3000/health
curl -X GET http://localhost:3001/health
curl -X GET http://localhost:3002/health
curl -X GET http://localhost:3003/health
```
*(Todos devem responder com `{ "status": "ok" }`).*

### 3. Validação Externa pelo Navegador (Substitua pelo IP Público da sua EC2)
- **Aplicação Web / PWA Completa:** `http://54.234.157.236:3000`
  - `/login`: Seleção de perfis (Garçom, Caixa, Cozinha, Gerente)
  - `/garcom`: Comandas e Mesas mobile-first
  - `/caixa`: Fechamento, Split Payment e Recibo Térmico
  - `/kds`: Painel TV da Cozinha com SLA semafórico
  - `/gestao`: Dashboard Executivo e Curva ABC
- **Swagger / OpenAPI dos 4 Microsserviços:**
  - Core Salão: `http://54.234.157.236:3000/docs`
  - KDS Cozinha: `http://54.234.157.236:3001/docs`
  - Caixa Service: `http://54.234.157.236:3002/docs`
  - Gestão Service: `http://54.234.157.236:3003/docs`

---

## 6. Rotina Operacional: Como Fazer Deploy de Novas Versões

Sempre que commitar melhorias ou correções no repositório, basta rodar na VM:

```bash
cd ~/vapt-pdv
git pull origin develop

# Rebuild do frontend (se houver alterações de UI)
cd ~/vapt-pdv/frontend && npm install && npm run build

# Atualizar migrações e rebuild dos serviços alterados
cd ~/vapt-pdv/backend && npm install && npx prisma migrate deploy && npm run build
cd ~/vapt-pdv/services/kds-service && npm install && npx prisma migrate deploy && npm run build
cd ~/vapt-pdv/services/caixa-service && npm install && npx prisma migrate deploy && npm run build
cd ~/vapt-pdv/services/gestao-service && npm install && npx prisma migrate deploy && npm run build

# Reiniciar todos os processos no PM2
pm2 restart all
```

### Comandos Úteis de Monitoramento
```bash
# Monitorar logs em tempo real de todos os microsserviços
pm2 logs

# Monitorar logs de um serviço específico
pm2 logs kds-service
pm2 logs caixa-service
pm2 logs gestao-service
pm2 logs vapt-pdv-core

# Monitoramento de consumo de CPU e RAM
pm2 monit
```
