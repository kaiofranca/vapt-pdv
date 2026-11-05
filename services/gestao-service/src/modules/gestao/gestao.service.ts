import { Prisma } from '@prisma/client';
import { GestaoRepository, ResumoDiarioDto, ProdutoAbcDto, DesempenhoGarcomDto, AlertaEstoqueDto } from './gestao.repository';
import { EnvelopeEventoOperacional } from './schemas';
import { ErroDominio } from '../../shared/erros';

export interface RespostaProcessamentoEvento {
  evento_id: string;
  evento: string;
  processado: boolean;
  duplicado: boolean;
  processado_em: string;
}

export class GestaoService {
  constructor(private readonly repository: GestaoRepository) {}

  async processarEvento(evento: EnvelopeEventoOperacional): Promise<RespostaProcessamentoEvento> {
    if (!evento.evento_id || !evento.evento) {
      throw ErroDominio.validacao('Os campos evento_id e evento são obrigatórios.');
    }

    const jaProcessado = await this.repository.eventoJaProcessado(evento.evento_id);
    if (jaProcessado) {
      return {
        evento_id: evento.evento_id,
        evento: evento.evento,
        processado: true,
        duplicado: true,
        processado_em: new Date().toISOString(),
      };
    }

    const timestamp = evento.ocorrido_em
      ? new Date(evento.ocorrido_em)
      : evento.data_hora
        ? new Date(evento.data_hora)
        : evento.timestamp
          ? new Date(evento.timestamp)
          : new Date();

    // 1. Registrar o processamento do evento (idempotência)
    await this.repository.registrarEventoProcessado(evento.evento_id, evento.evento, timestamp);

    // 2. Despachar para processamento de agregação de acordo com o tipo
    if (evento.evento === 'comanda.paga') {
      const dataRef = evento.paga_em
        ? new Date(evento.paga_em)
        : evento.data_hora
          ? new Date(evento.data_hora)
          : evento.ocorrido_em
            ? new Date(evento.ocorrido_em)
            : timestamp;
      const itensFormatados = (evento.itens || []).map((i) => ({
        produto_id: i.produto_id,
        nome: i.nome || i.nome_copiado || `Produto #${i.produto_id}`,
        categoria: i.categoria || 'Geral',
        quantidade: i.quantidade,
        subtotal:
          i.subtotal ||
          new Prisma.Decimal(i.preco_unitario || i.preco_copiado || '0.00')
            .mul(i.quantidade)
            .toFixed(2),
      }));

      await this.repository.processarComandaPaga({
        dataReferencia: dataRef,
        subtotal: evento.subtotal || evento.valor_subtotal || '0.00',
        taxaServico: evento.taxa_servico || '0.00',
        total: evento.total || evento.valor_total || '0.00',
        formaPagamento: evento.forma_pagamento || 'dinheiro',
        garcomId: evento.garcom_id,
        garcomNome: evento.garcom_nome,
        itens: itensFormatados,
      });
    } else if (evento.evento === 'comanda.cancelada') {
      const dataRef = timestamp;
      await this.repository.processarComandaCancelada(dataRef);
    } else if (evento.evento === 'estoque.movimentado') {
      if (evento.produto_id !== undefined && evento.estoque_atual !== undefined && evento.estoque_minimo !== undefined) {
        await this.repository.processarMovimentoEstoque({
          produtoId: evento.produto_id,
          nome: evento.nome_produto || `Produto #${evento.produto_id}`,
          categoria: evento.categoria || 'Geral',
          estoqueAtual: evento.estoque_atual,
          estoqueMinimo: evento.estoque_minimo,
          timestamp,
        });
      }
    }

    return {
      evento_id: evento.evento_id,
      evento: evento.evento,
      processado: true,
      duplicado: false,
      processado_em: new Date().toISOString(),
    };
  }

  async obterResumoDiario(data?: string): Promise<ResumoDiarioDto> {
    const dataAlvo = data || new Date().toISOString().split('T')[0];
    const resumo = await this.repository.obterResumoDiario(dataAlvo);

    if (resumo) {
      return resumo;
    }

    return {
      data: dataAlvo,
      total_vendas: '0.00',
      total_subtotal: '0.00',
      total_taxa_servico: '0.00',
      quantidade_pedidos: 0,
      ticket_medio: '0.00',
      por_forma_pagamento: {
        pix: '0.00',
        cartao: '0.00',
        dinheiro: '0.00',
      },
    };
  }

  async obterRankingProdutos(
    limite = 20,
    categoria?: string,
  ): Promise<{ receita_total_acumulada: string; produtos: ProdutoAbcDto[] }> {
    const res = await this.repository.obterRankingProdutos(limite, categoria);
    return {
      receita_total_acumulada: res.receitaTotalAcumulada,
      produtos: res.produtos,
    };
  }

  async obterDesempenhoGarcons(): Promise<{ garcons: DesempenhoGarcomDto[] }> {
    const garcons = await this.repository.obterDesempenhoGarcons();
    return { garcons };
  }

  async obterAlertasEstoque(_apenasAtivos = true): Promise<{ alertas: AlertaEstoqueDto[] }> {
    const alertas = await this.repository.obterAlertasEstoque();
    return { alertas };
  }

  async exportarRelatorio(
    tipo: 'faturamento' | 'produtos' | 'garcons' | 'alertas' = 'faturamento',
    formato: 'csv' | 'json' = 'csv',
    de?: string,
    ate?: string,
  ): Promise<{ dados: unknown; contentType: string; filename: string }> {
    let registros: Record<string, unknown>[] = [];
    let colunas: string[] = [];

    if (tipo === 'faturamento') {
      registros = await this.repository.obterFaturamentoHistorico(de, ate);
      colunas = [
        'data',
        'comandas_pagas',
        'comandas_canceladas',
        'faturamento_subtotal',
        'total_taxa_servico',
        'faturamento_total',
        'ticket_medio',
        'pix',
        'cartao',
        'dinheiro',
      ];
    } else if (tipo === 'produtos') {
      const res = await this.repository.obterRankingProdutos(100);
      registros = res.produtos.map((p) => ({ ...p }));
      colunas = [
        'posicao',
        'produto_id',
        'nome_produto',
        'categoria',
        'quantidade_vendida',
        'receita_gerada',
        'percentual_receita',
        'percentual_acumulado',
        'classe_abc',
      ];
    } else if (tipo === 'garcons') {
      const garcons = await this.repository.obterDesempenhoGarcons();
      registros = garcons.map((g) => ({ ...g }));
      colunas = [
        'garcom_id',
        'garcom_nome',
        'comandas_atendidas',
        'total_vendido',
        'comissao_gerada',
        'ticket_medio',
      ];
    } else if (tipo === 'alertas') {
      const alertas = await this.repository.obterAlertasEstoque();
      registros = alertas.map((a) => ({ ...a }));
      colunas = [
        'produto_id',
        'nome_produto',
        'categoria',
        'estoque_atual',
        'estoque_minimo',
        'nivel',
        'ultimo_movimento_em',
      ];
    } else {
      throw ErroDominio.parametroInvalido(`Tipo de relatório inválido: ${tipo}`);
    }

    if (formato === 'json') {
      return {
        dados: registros,
        contentType: 'application/json; charset=utf-8',
        filename: `relatorio-${tipo}.json`,
      };
    }

    // Formatar CSV (RFC 4180)
    const linhasCsv: string[] = [];
    linhasCsv.push(colunas.join(','));

    for (const reg of registros) {
      const linha = colunas.map((col) => {
        const val = reg[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      linhasCsv.push(linha.join(','));
    }

    const csvContent = linhasCsv.join('\r\n');
    return {
      dados: csvContent,
      contentType: 'text/csv; charset=utf-8',
      filename: `relatorio-${tipo}.csv`,
    };
  }
}
