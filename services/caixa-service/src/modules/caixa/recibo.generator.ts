import crypto from 'node:crypto';

export interface ItemReciboPaper {
  nome: string;
  quantidade: number;
  preco_unitario: string;
  subtotal: string;
}

export interface PagamentoReciboPaper {
  numero_parcela: number;
  pagador_rotulo?: string | null;
  forma_pagamento: string;
  valor_aplicado: string;
  valor_recebido: string;
  troco: string;
}

export interface DadosReciboPaper {
  comanda_id: number;
  mesa: number;
  garcom_nome: string;
  operador_caixa?: string;
  codigo_autenticacao: string;
  emitido_em: string;
  subtotal: string;
  taxa_servico: string;
  total: string;
  troco_total: string;
  itens: ItemReciboPaper[];
  pagamentos: PagamentoReciboPaper[];
}

/**
 * Gera código de autenticação único no formato VAPT-YYYYMMDD-MESA-XXXX
 * Exemplo: VAPT-20261104-M04-98F2 ou VAPT-20261104-M12-A3D8
 */
export function gerarCodigoAutenticacao(mesa: number, data: Date = new Date()): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const yyyymmdd = `${ano}${mes}${dia}`;
  const mesaFormatada = `M${String(mesa).padStart(2, '0')}`;
  const sufixoHex = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `VAPT-${yyyymmdd}-${mesaFormatada}-${sufixoHex}`;
}

/**
 * Gera o texto do recibo térmico operacional (.paper) em largura fixa de 40 colunas
 */
export function gerarTextoReciboPaper(dados: DadosReciboPaper): string {
  const LARGURA = 40;
  const linhaDupla = '='.repeat(LARGURA);
  const linhaSimples = '-'.repeat(LARGURA);

  const centralizar = (texto: string) => {
    if (texto.length >= LARGURA) return texto.slice(0, LARGURA);
    const espacos = Math.max(0, Math.floor((LARGURA - texto.length) / 2));
    return ' '.repeat(espacos) + texto;
  };

  const duasColunas = (esq: string, dir: string) => {
    const espacoDisponivel = LARGURA - esq.length - dir.length;
    if (espacoDisponivel <= 0) {
      return `${esq.slice(0, LARGURA - dir.length - 1)} ${dir}`;
    }
    return esq + ' '.repeat(espacoDisponivel) + dir;
  };

  const linhas: string[] = [
    linhaDupla,
    centralizar('VAPT PDV - BAR & RESTAURANTE'),
    centralizar('COMPROVANTE OPERACIONAL DE VENDA'),
    linhaDupla,
    duasColunas(`Mesa: ${dados.mesa}`, `Comanda: #${dados.comanda_id}`),
    `Atendente: ${dados.garcom_nome}`,
  ];

  if (dados.operador_caixa) {
    linhas.push(`Operador: ${dados.operador_caixa}`);
  }

  linhas.push(`Data: ${dados.emitido_em}`);
  linhas.push(linhaSimples);
  linhas.push(duasColunas('QTD  ITEM', 'VALOR'));
  linhas.push(linhaSimples);

  for (const item of dados.itens) {
    const rotuloItem = `${String(item.quantidade).padStart(2, ' ')}x  ${item.nome}`;
    linhas.push(duasColunas(rotuloItem, `R$ ${item.subtotal}`));
  }

  linhas.push(linhaSimples);
  linhas.push(duasColunas('Subtotal:', `R$ ${dados.subtotal}`));
  linhas.push(duasColunas('Taxa de Servico (10%):', `R$ ${dados.taxa_servico}`));
  linhas.push(duasColunas('TOTAL A PAGAR:', `R$ ${dados.total}`));
  linhas.push(linhaSimples);
  linhas.push('PAGAMENTOS:');

  for (const p of dados.pagamentos) {
    const rotulo = p.pagador_rotulo ? ` (${p.pagador_rotulo})` : '';
    const forma = p.forma_pagamento.toUpperCase();
    linhas.push(duasColunas(` ${p.numero_parcela}. ${forma}${rotulo}`, `R$ ${p.valor_aplicado}`));
    if (p.forma_pagamento.toLowerCase() === 'dinheiro') {
      linhas.push(
        duasColunas(`    Recebido: R$ ${p.valor_recebido}`, `Troco: R$ ${p.troco}`),
      );
    }
  }

  linhas.push(linhaSimples);
  linhas.push(duasColunas('Troco Total Devolvido:', `R$ ${dados.troco_total}`));
  linhas.push(linhaSimples);
  linhas.push('Codigo de Autenticacao:');
  linhas.push(centralizar(dados.codigo_autenticacao));
  linhas.push(linhaDupla);
  linhas.push(centralizar('Obrigado pela preferencia!'));
  linhas.push(centralizar('Volte sempre!'));
  linhas.push(linhaDupla);

  return linhas.join('\n');
}
