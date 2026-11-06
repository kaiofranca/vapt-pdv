export type PerfilUsuario = 'garcom' | 'caixa' | 'gerente' | 'cozinha';

export interface Usuario {
  id: number;
  nome: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Produto {
  id: number;
  nome: string;
  categoria: string;
  preco: string; // "12.50"
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export type StatusComanda = 'aberta' | 'fechada' | 'paga' | 'cancelada';

export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao';

export interface ItemComanda {
  id: number;
  comanda_id: number;
  produto_id: number;
  nome_copiado: string;
  preco_copiado: string; // "12.50"
  quantidade: number;
  observacao?: string | null;
}

export interface Comanda {
  id: number;
  mesa: number | string;
  nome_cliente: string | null;
  garcom_id: number;
  status: StatusComanda;
  subtotal: string | null;
  taxa_servico: string | null;
  total: string | null;
  forma_pagamento: FormaPagamento | null;
  aberta_em: string;
  fechada_em: string | null;
  paga_em: string | null;
  cancelada_em?: string | null;
  motivo_cancelamento?: string | null;
  itens?: ItemComanda[];
  integracao_caixa_pendente?: boolean;
  integracao_gestao_pendente?: boolean;
  avisos?: string[];
}

export interface ApiErrorDetail {
  codigo: string;
  mensagem: string;
  detalhes?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  erro: ApiErrorDetail;
}

// DTOs de Entrada de Usuários

export interface AtualizarUsuarioDto {
  nome?: string;
  perfil?: PerfilUsuario;
}
export interface CriarUsuarioDto {
  nome: string;
  perfil: PerfilUsuario;
}

export interface CriarProdutoDto {
  nome: string;
  categoria: string;
  preco: string;
  estoque: number;
  estoque_minimo?: number;
}

export interface AbrirComandaDto {
  mesa: string | number;
  garcom_id: number;
  nome_cliente?: string;
}

export interface LancarItemDto {
  produto_id: number;
  quantidade: number;
  observacao?: string | null;
}

export interface AjustarItemDto {
  quantidade: number;
}

export interface FecharComandaDto {
  aplicar_taxa_servico: boolean;
}

export interface CancelarComandaDto {
  motivo?: string;
}

export interface TransferirMesaDto {
  nova_mesa: number | string;
}

export interface MesclarComandaDto {
  comanda_origem_id: number;
}

export interface PagarComandaDto {
  forma_pagamento: FormaPagamento;
  documento_cliente?: string | null;
}

export interface ListarComandasFiltros {
  status?: StatusComanda;
  mesa?: string | number;
  de?: string;
  ate?: string;
  limit?: number;
  offset?: number;
}

export interface ListarProdutosFiltros {
  categoria?: string;
  ativo?: boolean;
}

export interface ListarUsuariosFiltros {
  perfil?: PerfilUsuario;
  ativo?: boolean;
}

export interface ResumoDiarioGestao {
  data: string;
  total_vendas: string;
  total_subtotal: string;
  total_taxa_servico: string;
  quantidade_pedidos: number;
  ticket_medio: string;
  por_forma_pagamento: {
    pix: string;
    cartao: string;
    dinheiro: string;
  };
}

export type ClasseABC = 'A' | 'B' | 'C';

export interface ItemRankingProduto {
  posicao: number;
  produto_id: number;
  nome_produto: string;
  categoria: string;
  quantidade_vendida: number;
  receita_gerada: string;
  percentual_receita: string;
  percentual_acumulado: string;
  classe_abc: ClasseABC;
}

export interface RankingProdutosResposta {
  receita_total_acumulada: string;
  produtos: ItemRankingProduto[];
}

export interface ItemDesempenhoGarcom {
  garcom_id: number;
  garcom_nome: string;
  comandas_atendidas: number;
  total_vendido: string;
  comissao_gerada: string;
  ticket_medio: string;
}

export interface DesempenhoGarconsResposta {
  garcons: ItemDesempenhoGarcom[];
}

export type NivelAlertaEstoque = 'baixo' | 'zerado';

export interface ItemAlertaEstoque {
  produto_id: number;
  nome_produto: string;
  categoria: string;
  estoque_atual: number;
  estoque_minimo: number;
  nivel: NivelAlertaEstoque;
  ultimo_movimento_em: string;
}

export interface AlertasEstoqueResposta {
  alertas: ItemAlertaEstoque[];
}

export interface ResumoDiarioFiltros {
  data?: string;
}

export interface RankingProdutosFiltros {
  limite?: number;
  categoria?: string;
}

export interface AlertasEstoqueFiltros {
  apenas_ativos?: boolean;
}

export type TipoRelatorioExportar = 'faturamento' | 'produtos' | 'garcons' | 'alertas';
export type FormatoRelatorioExportar = 'csv' | 'json';

export interface ExportarRelatorioFiltros {
  tipo?: TipoRelatorioExportar;
  formato?: FormatoRelatorioExportar;
  de?: string;
  ate?: string;
}

// Tipos do KDS (Cozinha & Bar)
export type SetorKds = 'cozinha' | 'bar';
export type StatusFichaKds = 'recebido' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';

export interface FichaKds {
  id: number;
  comanda_id: number;
  item_comanda_id: number;
  mesa: number;
  garcom_id: number;
  nome_garcom?: string | null;
  setor: SetorKds;
  produto_id: number;
  nome_produto: string;
  quantidade: number;
  observacao?: string | null;
  status: StatusFichaKds;
  recebido_em: string;
  iniciado_em?: string | null;
  pronto_em?: string | null;
  entregue_em?: string | null;
}

export interface PendenciasKdsResposta {
  comanda_id: number;
  possui_pendencias: boolean;
  total_pendencias: number;
  fichas_pendentes: Array<{
    id: number;
    nome_produto: string;
    setor: string;
    status: string;
  }>;
}


export interface ItemPendenciaKds {
  id: number;
  item_comanda_id: number;
  produto_id: number;
  nome_produto: string;
  setor: string;
  status: string;
  recebido_em: string;
  quantidade?: number;
}

export interface RespostaChecagemPendenciasKds {
  possui_pendencias: boolean;
  pendencias: ItemPendenciaKds[];
  offline?: boolean;
}
