import type {
  Usuario,
  PerfilUsuario,
  CriarUsuarioDto,
  AtualizarUsuarioDto,
  ListarUsuariosFiltros,
  Produto,
  CriarProdutoDto,
  ListarProdutosFiltros,
} from '../../types/api';

export type {
  Usuario,
  PerfilUsuario,
  CriarUsuarioDto,
  AtualizarUsuarioDto,
  ListarUsuariosFiltros,
  Produto,
  CriarProdutoDto,
  ListarProdutosFiltros,
};

export type FiltroPerfilEquipe = 'todos' | PerfilUsuario;
export type FiltroStatusEquipe = 'todos' | 'ativo' | 'inativo';

export type CategoriaProduto = 'comida' | 'bebida' | 'sobremesa' | 'outros';
export type FiltroCategoriaCardapio = 'todas' | CategoriaProduto;
export type FiltroStatusCardapio = 'todos' | 'ativo' | 'inativo';

export interface AtualizarProdutoDto {
  nome?: string;
  categoria?: string;
  preco?: string;
  estoque?: number;
  estoque_minimo?: number;
}
