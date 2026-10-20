import { FastifyError } from 'fastify';
import { Type } from '@sinclair/typebox';

export const RespostaErroSchema = Type.Object(
  {
    erro: Type.Object({
      codigo: Type.String(),
      mensagem: Type.String(),
      detalhes: Type.Record(Type.String(), Type.Unknown()),
    }),
  },
  { description: 'Erro padronizado da API' },
);

export type CodigoErro =
  | 'VALIDACAO'
  | 'NAO_ENCONTRADO'
  | 'MESA_OCUPADA'
  | 'COMANDA_NAO_ABERTA'
  | 'COMANDA_NAO_FECHADA'
  | 'COMANDA_SEM_ITENS'
  | 'COMANDA_IMUTAVEL'
  | 'ESTOQUE_INSUFICIENTE'
  | 'PRODUTO_INATIVO'
  | 'GARCOM_INVALIDO'
  | 'SERVICO_INDISPONIVEL'
  | 'ERRO_INTERNO';

export interface DetalhesErro {
  [chave: string]: unknown;
}

export interface RespostaErro {
  erro: {
    codigo: CodigoErro | string;
    mensagem: string;
    detalhes: DetalhesErro;
  };
}

export class ErroDominio extends Error {
  public readonly codigo: CodigoErro | string;
  public readonly statusHttp: number;
  public readonly detalhes: DetalhesErro;

  constructor(
    codigo: CodigoErro | string,
    mensagem: string,
    statusHttp = 400,
    detalhes: DetalhesErro = {},
  ) {
    super(mensagem);
    this.name = 'ErroDominio';
    this.codigo = codigo;
    this.statusHttp = statusHttp;
    this.detalhes = detalhes;
  }

  static validacao(mensagem: string, detalhes: DetalhesErro = {}): ErroDominio {
    return new ErroDominio('VALIDACAO', mensagem, 400, detalhes);
  }

  static naoEncontrado(mensagem = 'Recurso não encontrado.', detalhes: DetalhesErro = {}): ErroDominio {
    return new ErroDominio('NAO_ENCONTRADO', mensagem, 404, detalhes);
  }

  static conflito(
    codigo: CodigoErro | string,
    mensagem: string,
    detalhes: DetalhesErro = {},
  ): ErroDominio {
    return new ErroDominio(codigo, mensagem, 409, detalhes);
  }

  static regraNegocio(
    codigo: CodigoErro | string,
    mensagem: string,
    detalhes: DetalhesErro = {},
  ): ErroDominio {
    return new ErroDominio(codigo, mensagem, 422, detalhes);
  }

  static servicoIndisponivel(
    servico: string,
    mensagem = `O serviço "${servico}" está temporariamente indisponível.`,
    detalhes: DetalhesErro = {},
  ): ErroDominio {
    return new ErroDominio('SERVICO_INDISPONIVEL', mensagem, 503, {
      servico,
      ...detalhes,
    });
  }

  static interno(mensagem = 'Ocorreu um erro interno no servidor.'): ErroDominio {
    return new ErroDominio('ERRO_INTERNO', mensagem, 500, {});
  }
}

export function formatarRespostaErro(
  codigo: CodigoErro | string,
  mensagem: string,
  detalhes: DetalhesErro = {},
): RespostaErro {
  return {
    erro: {
      codigo,
      mensagem,
      detalhes,
    },
  };
}

interface ItemValidacaoFastify {
  instancePath?: string;
  keyword?: string;
  params?: Record<string, unknown>;
  message?: string;
}

export function extrairDetalhesValidacao(erro: FastifyError): DetalhesErro {
  const erroComContexto = erro as FastifyError & {
    validation?: ItemValidacaoFastify[];
    validationContext?: string;
  };
  const validacoes = erroComContexto.validation;
  if (!Array.isArray(validacoes) || validacoes.length === 0) {
    return {};
  }

  const contextoPadrao = erroComContexto.validationContext || 'corpo';
  const detalhes: DetalhesErro = {};

  for (const item of validacoes) {
    const caminhoBase = item.instancePath
      ? item.instancePath.replace(/^\//, '').replace(/\//g, '.')
      : '';

    const propriedadeFaltante =
      item.keyword === 'required' && typeof item.params?.missingProperty === 'string'
        ? item.params.missingProperty
        : undefined;

    const campo = propriedadeFaltante
      ? caminhoBase
        ? `${caminhoBase}.${propriedadeFaltante}`
        : propriedadeFaltante
      : caminhoBase || contextoPadrao;

    if (!(campo in detalhes)) {
      if (propriedadeFaltante) {
        detalhes[campo] = 'Campo obrigatório ausente.';
      } else {
        detalhes[campo] = item.message || 'Valor inválido.';
      }
    }
  }

  return detalhes;
}
