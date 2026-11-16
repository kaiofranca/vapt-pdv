#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT_DIR"

CORE_URL="${CORE_URL:-http://127.0.0.1:${CORE_PORT:-3000}}"
KDS_URL="${KDS_URL:-http://127.0.0.1:${KDS_PORT:-3001}}"
CAIXA_URL="${CAIXA_URL:-http://127.0.0.1:${CAIXA_PORT:-3002}}"
GESTAO_URL="${GESTAO_URL:-http://127.0.0.1:${GESTAO_PORT:-3003}}"

if command -v node >/dev/null 2>&1; then
  JSON_RUNTIME="node"
elif command -v python3 >/dev/null 2>&1 && python3 -c "import sys; sys.exit(0)" >/dev/null 2>&1; then
  JSON_RUNTIME="python3"
elif command -v python >/dev/null 2>&1 && python -c "import sys; sys.exit(0)" >/dev/null 2>&1; then
  JSON_RUNTIME="python"
else
  echo "[ERRO] É necessário ter 'node' ou 'python3' disponível no PATH para parsear JSON." >&2
  exit 1
fi

log() {
  printf '[persistencia-docker] %s\n' "$1"
}

fail() {
  printf '[ERRO] %s\n' "$1" >&2
  exit 1
}

json_field() {
  local path="$1"
  if [ "$JSON_RUNTIME" = "node" ]; then
    node -e '
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync(0, "utf8"));
      const parts = process.argv[1].split(".");
      let cur = data;
      for (const p of parts) {
        if (cur === null || cur === undefined) process.exit(1);
        cur = cur[p];
      }
      if (cur === null || cur === undefined) process.exit(1);
      process.stdout.write(String(cur));
    ' "$path"
  else
    "$JSON_RUNTIME" -c '
import json, sys
data = json.load(sys.stdin)
cur = data
for p in sys.argv[1].split("."):
    if isinstance(cur, list):
        cur = cur[int(p)]
    else:
        cur = cur[p]
if cur is None:
    sys.exit(1)
print(cur, end="")
' "$path"
  fi
}

escolher_mesa_livre() {
  local abertas_json="$1"
  printf '%s' "$abertas_json" | {
    if [ "$JSON_RUNTIME" = "node" ]; then
      node -e '
        const fs = require("fs");
        const arr = JSON.parse(fs.readFileSync(0, "utf8"));
        const ocupadas = new Set((Array.isArray(arr) ? arr : []).map(c => Number(c.mesa)));
        let mesa = 100 + Math.floor(Math.random() * 800);
        while (ocupadas.has(mesa)) mesa++;
        process.stdout.write(String(mesa));
      '
    else
      "$JSON_RUNTIME" -c '
import json, random, sys
arr = json.load(sys.stdin)
ocupadas = {int(c["mesa"]) for c in arr} if isinstance(arr, list) else set()
mesa = random.randint(100, 899)
while mesa in ocupadas:
    mesa += 1
print(mesa, end="")
'
    fi
  }
}

extrair_ficha_comanda() {
  local fichas_json="$1"
  local comanda_id="$2"
  local item_id="$3"
  printf '%s' "$fichas_json" | {
    if [ "$JSON_RUNTIME" = "node" ]; then
      node -e '
        const fs = require("fs");
        const data = JSON.parse(fs.readFileSync(0, "utf8"));
        const cid = Number(process.argv[1]);
        const iid = Number(process.argv[2]);
        const f = (data.fichas || []).find(
          x => Number(x.comanda_id) === cid && Number(x.item_comanda_id) === iid
        );
        if (!f) process.exit(1);
        process.stdout.write(`${f.id}:${f.status}`);
      ' "$comanda_id" "$item_id"
    else
      "$JSON_RUNTIME" -c '
import json, sys
data = json.load(sys.stdin)
cid = int(sys.argv[1])
iid = int(sys.argv[2])
for f in data.get("fichas", []):
    if int(f.get("comanda_id", 0)) == cid and int(f.get("item_comanda_id", 0)) == iid:
        print(f"{f[\"id\"]}:{f[\"status\"]}", end="")
        sys.exit(0)
sys.exit(1)
' "$comanda_id" "$item_id"
    fi
  }
}

aguardar_servico() {
  local nome="$1"
  local url="$2"
  local tentativas=45
  local i=1

  while [ "$i" -le "$tentativas" ]; do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "${url}/health" || true)"
    if [ "$code" = "200" ]; then
      log "  OK ${nome} (${url}/health -> 200)"
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done

  fail "Serviço ${nome} (${url}/health) não respondeu 200 após $((tentativas * 2))s."
}

aguardar_todos_health() {
  log "Aguardando GET /health = 200 nos 4 microsserviços..."
  aguardar_servico "vapt-pdv-core" "$CORE_URL"
  aguardar_servico "kds-service" "$KDS_URL"
  aguardar_servico "caixa-service" "$CAIXA_URL"
  aguardar_servico "gestao-service" "$GESTAO_URL"
}

http_post_json() {
  local url="$1"
  local body="$2"
  curl -fsS -X POST "$url" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$body"
}

http_patch_json() {
  local url="$1"
  local body="$2"
  curl -fsS -X PATCH "$url" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "$body"
}

aguardar_todos_health

log "Criando garçom e produto de teste no Core (${CORE_URL})..."
SUFIXO="$(date +%s)"
GARCOM_JSON="$(http_post_json "${CORE_URL}/usuarios" "{\"nome\":\"Garcom Docker ${SUFIXO}\",\"perfil\":\"garcom\"}")"
GARCOM_ID="$(printf '%s' "$GARCOM_JSON" | json_field id)"
[ -n "$GARCOM_ID" ] || fail "Falha ao extrair garcom_id."

ESTOQUE_INICIAL=20
QTD_LANCADA=2
ESTOQUE_ESPERADO=$((ESTOQUE_INICIAL - QTD_LANCADA))

PRODUTO_JSON="$(http_post_json "${CORE_URL}/produtos" "{\"nome\":\"Burger Docker ${SUFIXO}\",\"categoria\":\"Lanches\",\"preco\":\"25.00\",\"estoque\":${ESTOQUE_INICIAL},\"estoque_minimo\":5}")"
PRODUTO_ID="$(printf '%s' "$PRODUTO_JSON" | json_field id)"
[ -n "$PRODUTO_ID" ] || fail "Falha ao extrair produto_id."

ABERTAS_JSON="$(curl -fsS "${CORE_URL}/comandas?status=aberta")"
MESA="$(escolher_mesa_livre "$ABERTAS_JSON")"
log "Abrindo comanda na mesa ${MESA} (garcom_id=${GARCOM_ID}, produto_id=${PRODUTO_ID})..."

COMANDA_JSON="$(http_post_json "${CORE_URL}/comandas" "{\"mesa\":${MESA},\"garcom_id\":${GARCOM_ID},\"nome_cliente\":\"Persistencia Docker\"}")"
COMANDA_ID="$(printf '%s' "$COMANDA_JSON" | json_field id)"
[ -n "$COMANDA_ID" ] || fail "Falha ao extrair comanda_id."

log "Lançando ${QTD_LANCADA}x produto #${PRODUTO_ID} na comanda #${COMANDA_ID}..."
ITEM_JSON="$(http_post_json "${CORE_URL}/comandas/${COMANDA_ID}/itens" "{\"produto_id\":${PRODUTO_ID},\"quantidade\":${QTD_LANCADA},\"observacao\":\"Teste persistencia\"}")"
ITEM_ID="$(printf '%s' "$ITEM_JSON" | json_field id)"
[ -n "$ITEM_ID" ] || fail "Falha ao extrair item_id."

log "Consultando ficha no KDS (${KDS_URL}/kds/fichas?mesa=${MESA})..."
FICHAS_JSON="$(curl -fsS "${KDS_URL}/kds/fichas?mesa=${MESA}")"
FICHA_INFO="$(extrair_ficha_comanda "$FICHAS_JSON" "$COMANDA_ID" "$ITEM_ID")" || fail "Ficha não encontrada no KDS para comanda=${COMANDA_ID}, item=${ITEM_ID}."
FICHA_ID="${FICHA_INFO%%:*}"
FICHA_STATUS="${FICHA_INFO##*:}"
log "  Ficha KDS #${FICHA_ID} encontrada (status inicial: ${FICHA_STATUS})."

for PROXIMO_STATUS in em_preparo pronto entregue; do
  RESP_KDS="$(http_patch_json "${KDS_URL}/kds/fichas/${FICHA_ID}/status" "{\"status\":\"${PROXIMO_STATUS}\",\"alterado_por\":\"Teste Docker\"}")"
  STATUS_ATUAL="$(printf '%s' "$RESP_KDS" | json_field status)"
  [ "$STATUS_ATUAL" = "$PROXIMO_STATUS" ] || fail "Esperado status KDS '${PROXIMO_STATUS}', obtido '${STATUS_ATUAL}'."
done
log "  Ficha KDS #${FICHA_ID} avançada até status 'entregue'."

log "Fechando comanda #${COMANDA_ID} no Core..."
FECHAR_JSON="$(http_post_json "${CORE_URL}/comandas/${COMANDA_ID}/fechar" "{\"aplicar_taxa_servico\":true}")"
STATUS_FECHADA="$(printf '%s' "$FECHAR_JSON" | json_field status)"
[ "$STATUS_FECHADA" = "fechada" ] || fail "Esperado status 'fechada' após fechamento, obtido '${STATUS_FECHADA}'."

log "Quitando comanda #${COMANDA_ID} no Caixa (${CAIXA_URL}) via PIX..."
PAGAR_CAIXA_JSON="$(http_post_json "${CAIXA_URL}/caixa/comandas/${COMANDA_ID}/pagar" "{\"forma_pagamento\":\"pix\",\"operador_nome\":\"Operador Docker\"}")"
STATUS_CAIXA="$(printf '%s' "$PAGAR_CAIXA_JSON" | json_field status)"
CODIGO_RECIBO="$(printf '%s' "$PAGAR_CAIXA_JSON" | json_field recibo.codigo_autenticacao)"
[ "$STATUS_CAIXA" = "paga" ] || fail "Esperado status 'paga' no Caixa, obtido '${STATUS_CAIXA}'."
case "$CODIGO_RECIBO" in
  VAPT-*) ;;
  *) fail "Código de recibo inválido: '${CODIGO_RECIBO}' (esperado prefixo VAPT-)." ;;
esac
log "  Recibo emitido no Caixa: ${CODIGO_RECIBO}."

PAGAR_CORE_JSON="$(http_post_json "${CORE_URL}/comandas/${COMANDA_ID}/pagar" "{\"forma_pagamento\":\"pix\"}")"
STATUS_CORE_PRE="$(printf '%s' "$PAGAR_CORE_JSON" | json_field status)"
[ "$STATUS_CORE_PRE" = "paga" ] || fail "Esperado status 'paga' no Core, obtido '${STATUS_CORE_PRE}'."

PROD_PRE_JSON="$(curl -fsS "${CORE_URL}/produtos/${PRODUTO_ID}")"
ESTOQUE_PRE="$(printf '%s' "$PROD_PRE_JSON" | json_field estoque)"
[ "$ESTOQUE_PRE" = "$ESTOQUE_ESPERADO" ] || fail "Estoque pré-restart esperado=${ESTOQUE_ESPERADO}, obtido=${ESTOQUE_PRE}."

RESUMO_PRE_JSON="$(curl -fsS "${GESTAO_URL}/gestao/resumo-diario")"
DATA_RESUMO="$(printf '%s' "$RESUMO_PRE_JSON" | json_field data)"
TOTAL_VENDAS_PRE="$(printf '%s' "$RESUMO_PRE_JSON" | json_field total_vendas)"
QTD_PEDIDOS_PRE="$(printf '%s' "$RESUMO_PRE_JSON" | json_field quantidade_pedidos)"
[ "$QTD_PEDIDOS_PRE" -ge 1 ] || fail "Esperado quantidade_pedidos >= 1 no Gestão pré-restart, obtido ${QTD_PEDIDOS_PRE}."

log "Baseline pré-restart validado:"
log "  Core   -> comanda #${COMANDA_ID} status=${STATUS_CORE_PRE}, produto #${PRODUTO_ID} estoque=${ESTOQUE_PRE}"
log "  KDS    -> ficha #${FICHA_ID} status=entregue"
log "  Caixa  -> recibo=${CODIGO_RECIBO}"
log "  Gestão -> data=${DATA_RESUMO}, pedidos=${QTD_PEDIDOS_PRE}, total_vendas=${TOTAL_VENDAS_PRE}"

log "Executando 'docker compose down' (preservando volumes nomeados)..."
docker compose down

log "Executando 'docker compose up -d'..."
docker compose up -d

aguardar_todos_health

log "Reconsultando os 4 serviços para comprovar persistência após down -> up..."

COMANDA_POS_JSON="$(curl -fsS "${CORE_URL}/comandas/${COMANDA_ID}")"
STATUS_CORE_POS="$(printf '%s' "$COMANDA_POS_JSON" | json_field status)"
MESA_POS="$(printf '%s' "$COMANDA_POS_JSON" | json_field mesa)"
[ "$STATUS_CORE_POS" = "paga" ] || fail "Persistência Core falhou: status='${STATUS_CORE_POS}' (esperado 'paga')."
[ "$MESA_POS" = "$MESA" ] || fail "Persistência Core falhou: mesa='${MESA_POS}' (esperado '${MESA}')."

PROD_POS_JSON="$(curl -fsS "${CORE_URL}/produtos/${PRODUTO_ID}")"
ESTOQUE_POS="$(printf '%s' "$PROD_POS_JSON" | json_field estoque)"
[ "$ESTOQUE_POS" = "$ESTOQUE_ESPERADO" ] || fail "Persistência Estoque falhou: estoque='${ESTOQUE_POS}' (esperado '${ESTOQUE_ESPERADO}')."

FICHAS_POS_JSON="$(curl -fsS "${KDS_URL}/kds/fichas?mesa=${MESA}")"
FICHA_POS_INFO="$(extrair_ficha_comanda "$FICHAS_POS_JSON" "$COMANDA_ID" "$ITEM_ID")" || fail "Persistência KDS falhou: ficha #${FICHA_ID} não encontrada após restart."
FICHA_POS_ID="${FICHA_POS_INFO%%:*}"
FICHA_POS_STATUS="${FICHA_POS_INFO##*:}"
[ "$FICHA_POS_ID" = "$FICHA_ID" ] || fail "Persistência KDS falhou: id='${FICHA_POS_ID}' (esperado '${FICHA_ID}')."
[ "$FICHA_POS_STATUS" = "entregue" ] || fail "Persistência KDS falhou: status='${FICHA_POS_STATUS}' (esperado 'entregue')."

RECIBO_POS_JSON="$(curl -fsS "${CAIXA_URL}/caixa/recibos/${COMANDA_ID}")"
CODIGO_RECIBO_POS="$(printf '%s' "$RECIBO_POS_JSON" | json_field codigo_autenticacao)"
[ "$CODIGO_RECIBO_POS" = "$CODIGO_RECIBO" ] || fail "Persistência Caixa falhou: recibo='${CODIGO_RECIBO_POS}' (esperado '${CODIGO_RECIBO}')."

RESUMO_POS_JSON="$(curl -fsS "${GESTAO_URL}/gestao/resumo-diario?data=${DATA_RESUMO}")"
TOTAL_VENDAS_POS="$(printf '%s' "$RESUMO_POS_JSON" | json_field total_vendas)"
QTD_PEDIDOS_POS="$(printf '%s' "$RESUMO_POS_JSON" | json_field quantidade_pedidos)"
[ "$TOTAL_VENDAS_POS" = "$TOTAL_VENDAS_PRE" ] || fail "Persistência Gestão falhou: total_vendas='${TOTAL_VENDAS_POS}' (esperado '${TOTAL_VENDAS_PRE}')."
[ "$QTD_PEDIDOS_POS" = "$QTD_PEDIDOS_PRE" ] || fail "Persistência Gestão falhou: quantidade_pedidos='${QTD_PEDIDOS_POS}' (esperado '${QTD_PEDIDOS_PRE}')."

log "============================================================================"
log "SUCESSO: 100% dos dados persistiram nos 4 bancos PostgreSQL após down -> up!"
log "  - vaptpdv_db : comanda #${COMANDA_ID} (status=${STATUS_CORE_POS}, mesa=${MESA_POS}), produto #${PRODUTO_ID} (estoque=${ESTOQUE_POS})"
log "  - kds_db     : ficha #${FICHA_POS_ID} (status=${FICHA_POS_STATUS})"
log "  - caixa_db   : recibo ${CODIGO_RECIBO_POS}"
log "  - gestao_db  : resumo ${DATA_RESUMO} (pedidos=${QTD_PEDIDOS_POS}, total_vendas=${TOTAL_VENDAS_POS})"
log "============================================================================"
