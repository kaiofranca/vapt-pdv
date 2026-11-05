# Guia Passo a Passo: Deploy do `kds-service` e Banco `kds_db` na AWS EC2

Este documento descreve como configurar o banco de dados `kds_db` e colocar o microsserviço **`kds-service` (Porta `:3001`)** em produção na máquina virtual **AWS EC2 (Ubuntu Server LTS)** onde o **VaptPDV Core (`:3000`)** já está rodando.

---

## Entendendo a Diferença entre seu Ambiente Local e a VM EC2

- **No seu computador local:** Como o PostgreSQL não estava instalado nativamente no Linux, você subiu um contêiner Docker (`vaptpdv-postgres`) e criou o banco `kds_db` dentro dele.
- **Na VM AWS EC2:** Existem **dois caminhos** possíveis dependendo de como o banco do Módulo 1 foi configurado lá:
  - **Caminho A (Mais comum no Módulo 2 — Sem Docker):** O PostgreSQL já está instalado diretamente no Ubuntu da EC2 (via `apt`). Basta criar o database `kds_db` nessa mesma instância nativa do PostgreSQL e subir o `kds-service` com o **PM2**.
  - **Caminho B (Com Docker na EC2 — Já preparando para o Módulo 3):** Instalar o Docker na EC2 e usar o contêiner PostgreSQL compartilhado para todos os microsserviços.

Abaixo estão os dois roteiros completos.

---

## Verifique Antes na EC2: O PostgreSQL lá é Nativo ou Docker?

Conecte-se via SSH na sua instância EC2 e rode:

```bash
# Verifica se o PostgreSQL está rodando nativamente no Ubuntu
sudo systemctl status postgresql

# Verifica se há Docker instalado e contêineres rodando
docker ps
```

- Se `systemctl status postgresql` mostrar **`active (running)`**, siga o **Caminho A**.
- Se você preferir usar **Docker** na EC2, siga o **Caminho B**.

---

## Caminho A: PostgreSQL Nativo na VM EC2 + PM2 (Recomendado para o Módulo 2)

Neste cenário, você **não precisa instalar Docker agora**. O mesmo servidor PostgreSQL nativo da VM que já guarda os dados do `backend/` vai guardar também o `kds_db` (`Database-per-Service` lógico).

### Passo 1: Descobrir o usuário e a URL de conexão atuais do `backend` na EC2
Veja como o seu `backend/.env` está configurado na VM:
```bash
cat ~/vapt-pdv/backend/.env
```
*(Anote o `USUARIO`, `SENHA` e `PORTA` que estão na `DATABASE_URL` do backend).*

### Passo 2: Criar o banco `kds_db` no PostgreSQL da EC2
No Ubuntu com PostgreSQL nativo, o usuário administrador padrão `postgres` existe no sistema. Execute:

```bash
# Cria o banco de dados exclusivo do KDS
sudo -u postgres psql -c "CREATE DATABASE kds_db;"

# (Opcional) Caso seu usuário do .env não seja 'postgres', garanta permissão a ele:
# Substitua SEU_USUARIO pelo usuário que você viu no backend/.env
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kds_db TO SEU_USUARIO;"
sudo -u postgres psql -d kds_db -c "GRANT ALL ON SCHEMA public TO SEU_USUARIO;"
```

Para confirmar que os dois bancos coexistem na VM:
```bash
sudo -u postgres psql -c "\l"
```

### Passo 3: Atualizar o código do repositório na EC2
```bash
cd ~/vapt-pdv
git fetch origin
git checkout feature/kds-service   # ou a branch principal após o merge
git pull
```

### Passo 4: Configurar o `.env` do `kds-service`
```bash
cd ~/vapt-pdv/services/kds-service
cp .env.example .env
nano .env
```
Preencha usando as **mesmas credenciais** do `backend/.env`, alterando apenas a porta do serviço para `3001` e o nome do banco no final para `/kds_db`:
```env
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://SEU_USUARIO:SUA_SENHA@localhost:5432/kds_db?schema=public"
```

### Passo 5: Instalar dependências, aplicar Migrations e gerar Build
> **Nota importante:** Em produção usamos `prisma migrate deploy` (que aplica as migrações já committadas na pasta `prisma/migrations/` sem pedir confirmação interativa).

```bash
cd ~/vapt-pdv/services/kds-service
npm install
npx prisma migrate deploy
npm run build
```

Confirme se as tabelas `fichas_preparo` e `eventos_processados` foram criadas no `kds_db`:
```bash
sudo -u postgres psql -d kds_db -c "\dt"
```

### Passo 6: Iniciar o `kds-service` em background com PM2
```bash
cd ~/vapt-pdv/services/kds-service
pm2 start dist/server.js --name kds-service
pm2 save
```

Verifique se os dois serviços (`vapt-pdv` na `:3000` e `kds-service` na `:3001`) estão online:
```bash
pm2 status
curl -X GET http://localhost:3001/health
```

---

## Caminho B: Instalando Docker na VM EC2 e Usando Contêiner Compartilhado

Se a VM não tem Docker instalado e você deseja rodar o banco (ou a pilha toda) via Docker:

### Passo 1: Instalar o Docker no Ubuntu Server (AWS EC2)
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

# Adicionar o usuário ubuntu ao grupo docker (para não precisar de sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### Passo 2: Subir o Contêiner PostgreSQL (caso ainda não exista)
> **Atenção:** Se o PostgreSQL nativo estiver rodando na porta `5432` da EC2, pare-o antes (`sudo systemctl stop postgresql && sudo systemctl disable postgresql`) para liberar a porta `5432` para o Docker.

```bash
docker run -d \
  --name vaptpdv-postgres \
  --restart always \
  -e POSTGRES_USER=userkaio \
  -e POSTGRES_PASSWORD=SUA_SENHA \
  -e POSTGRES_DB=vaptpdv_db \
  -p 5432:5432 \
  -v vaptpdv_pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Passo 3: Criar os Bancos dos Microsserviços no Mesmo Contêiner
Exatamente como você fez na sua máquina local, conecte-se ao banco inicial (`postgres` ou `vaptpdv_db`) usando `-d` e crie o `kds_db` (e opcionalmente já deixe criados o `caixa_db` e `gestao_db`):

```bash
# Criar banco do KDS (:3001)
docker exec -it vaptpdv-postgres psql -U userkaio -d vaptpdv_db -c "CREATE DATABASE kds_db;"

# (Opcional) Já criar os bancos do Caixa (:3002) e Gestão (:3003) no mesmo contêiner
docker exec -it vaptpdv-postgres psql -U userkaio -d vaptpdv_db -c "CREATE DATABASE caixa_db;"
docker exec -it vaptpdv-postgres psql -U userkaio -d vaptpdv_db -c "CREATE DATABASE gestao_db;"

# Verificar todos os bancos criados no contêiner
docker exec -it vaptpdv-postgres psql -U userkaio -d vaptpdv_db -c "\l"
```

Depois disso, basta executar os **Passos 4, 5 e 6 do Caminho A** para rodar `npx prisma migrate deploy`, `npm run build` e subir no PM2!

---

## Passo Extra na AWS: Security Group (Firewall da EC2)

Caso você ou o Frontend precisem acessar o `kds-service` diretamente pelo IP público da EC2 (`http://54.234.157.236:3001`):
1. Acesse o console da **AWS EC2** ➔ **Security Groups**.
2. Edite as **Inbound Rules (Regras de Entrada)** do Security Group da sua instância.
3. Adicione uma regra:
   - **Type:** Custom TCP
   - **Port Range:** `3001` (e futuramente `3002` e `3003`)
   - **Source:** `0.0.0.0/0`
4. Teste do seu computador:
   ```bash
   curl http://54.234.157.236:3001/health
   ```

