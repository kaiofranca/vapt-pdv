import { Type } from '@sinclair/typebox';

export const RespostaErroSchema = Type.Object(
  {
    erro: Type.Object({
      codigo: Type.String({ description: 'Código padronizado do erro em UPPER_SNAKE_CASE' }),
      mensagem: Type.String({ description: 'Mensagem explicativa legível para humanos' }),
      detalhes: Type.Optional(
        Type.Array(
          Type.Object({
            campo: Type.String(),
            mensagem: Type.String(),
          }),
        ),
      ),
    }),
  },
  { description: 'Envelope de erro padronizado da API' },
);

export class ErroDominio extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly detalhes?: Array<{ campo: string; mensagem: string }>,
  ) {
    super(mensagem);
    this.name = 'ErroDominio';
  }

  static servicoIndisponivel(campo: string, mensagem: string): ErroDominio {
    return new ErroDominio(503, 'SERVICO_INDISPONIVEL', mensagem, [
      { campo, mensagem },
    ]);
  }

  static naoEncontrado(mensagem: string): ErroDominio {
    return new ErroDominio(404, 'NAO_ENCONTRADO', mensagem);
  }

  static transicaoInvalida(mensagem: string): ErroDominio {
    return new ErroDominio(422, 'TRANSICAO_KDS_INVALIDA', mensagem);
  }

  static validacao(detalhes: Array<{ campo: string; mensagem: string }>): ErroDominio {
    return new ErroDominio(400, 'VALIDACAO', 'Erro de validação dos dados enviados.', detalhes);
  }
}

