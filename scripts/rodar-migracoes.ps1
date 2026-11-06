# =====================================================================
# Script para Aplicar Migrações e Schemas em todos os 4 bancos locais
# =====================================================================

Write-Host ">>> [1/4] Aplicando migrações do Core (vapt_pdv)..." -ForegroundColor Yellow
cmd /c "npm run prisma:generate --prefix backend"
cmd /c "npm run prisma:deploy --prefix backend"

Write-Host "`n>>> [2/4] Aplicando migrações do KDS (kds_db)..." -ForegroundColor Yellow
cmd /c "npm run prisma:generate --prefix services/kds-service"
cmd /c "npm run prisma:deploy --prefix services/kds-service"

Write-Host "`n>>> [3/4] Aplicando migrações do Caixa (caixa_db)..." -ForegroundColor Yellow
cmd /c "npm run prisma:generate --prefix services/caixa-service"
cmd /c "npm run prisma:deploy --prefix services/caixa-service"

Write-Host "`n>>> [4/4] Aplicando migrações da Gestão (gestao_db)..." -ForegroundColor Yellow
cmd /c "npm run prisma:generate --prefix services/gestao-service"
cmd /c "npm run prisma:deploy --prefix services/gestao-service"

# Tenta carregar o catálogo de produtos no container Docker se estiver ativo
try {
    if (docker ps -q -f name=vapt-postgres) {
        Write-Host "`n>>> Inserindo catálogo de 24 produtos no banco vapt_pdv..." -ForegroundColor Yellow
        Get-Content "backend/prisma/seed-produtos.sql" | docker exec -i vapt-postgres psql -U postgres -d vapt_pdv
    }
} catch {}

Write-Host "`n>>> Migrações e Schemas concluídos com sucesso!" -ForegroundColor Green
