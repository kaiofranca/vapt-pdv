# =====================================================================
# Script para Iniciar todos os 4 Microsserviços do VaptPDV
# Cada serviço abrirá em sua própria janela de terminal para monitoramento
# =====================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Iniciando o Ecossistema VaptPDV (Core + 3 Microsserviços)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Core (:3000)
Write-Host "Iniciando Core (:3000) e Frontend Web/PWA..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot/backend'; Write-Host '>>> VaptPDV Core (:3000)' -ForegroundColor Green; npm run dev"

# 2. KDS (:3001)
Write-Host "Iniciando KDS Service (:3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot/services/kds-service'; Write-Host '>>> KDS Service (:3001)' -ForegroundColor Green; npm run dev"

# 3. Caixa (:3002)
Write-Host "Iniciando Caixa Service (:3002)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot/services/caixa-service'; Write-Host '>>> Caixa Service (:3002)' -ForegroundColor Green; npm run dev"

# 4. Gestão (:3003)
Write-Host "Iniciando Gestão Service (:3003)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot/services/gestao-service'; Write-Host '>>> Gestão Service (:3003)' -ForegroundColor Green; npm run dev"

Write-Host "`n>>> Todos os 4 processos foram disparados!" -ForegroundColor Green
Write-Host "Acesse no navegador: http://localhost:3000`n" -ForegroundColor Cyan
