export interface ProdutoEntidade {
  id: number;
  nome: string;
  categoria: string;
  preco: string;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

export interface DisponibilidadeProduto {
  id: number;
  nome: string;
  preco: string;
  ativo: boolean;
  estoque: number;
  disponivel: boolean;
}

export interface CriarProdutoDados {
  nome: string;
  categoria: string;
  preco: string | number;
  estoque: number;
  estoque_minimo?: number;
}

export interface AtualizarProdutoDados {
  nome?: string;
  categoria?: string;
  preco?: string | number;
  estoque?: number;
  estoque_minimo?: number;
}

export interface FiltrosListagemProdutos {
  categoria?: string;
  ativo?: boolean;
  limit?: number;
  offset?: number;
}

export interface ItemBaixaEstoque {
  produto_id: number;
  quantidade: number;
}

export interface BaixaEstoqueDados {
  comanda_id: number;
  itens: ItemBaixaEstoque[];
  motivo?: string;
}

export interface MovimentoEstoqueEntidade {
  id: number;
  produto_id: number;
  quantidade: number;
  motivo: string;
  tipo?: string | null;
  comanda_id?: number | null;
  criado_em: Date;
}
