import { ErroDominio } from '../../shared/erros';

export {
  IGestaoGateway,
  GestaoGateway,
  HttpGestaoGateway,
  RespostaNotificacaoGestao,
} from '../../shared/gateways/gestao.gateway';

export interface ItemBaixaEstoque {
  produto_id: number;
  quantidade: number;
}

export interface EstoqueCoreGateway {
  baixarEstoque(comandaId: number, itens: ItemBaixaEstoque[]): Promise<void>;
}

export class HttpEstoqueCoreGateway implements EstoqueCoreGateway {
  constructor(private readonly coreApiUrl: string) {}

  async baixarEstoque(comandaId: number, itens: ItemBaixaEstoque[]): Promise<void> {
    const url = `${this.coreApiUrl.replace(/\/$/, '')}/produtos/baixa-estoque`;
    let res: Response;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comanda_id: comandaId,
          itens,
        }),
        signal: AbortSignal.timeout(2000),
      });
    } catch (erro: any) {
      throw ErroDominio.servicoIndisponivel(
        'vapt-pdv-core',
        `Falha na comunicação com o Core para baixa de estoque: ${erro?.message || 'erro de rede ou timeout'}`,
      );
    }

    if (!res.ok) {
      if (res.status >= 500) {
        throw ErroDominio.servicoIndisponivel(
          'vapt-pdv-core',
          `Core retornou status HTTP ${res.status} durante baixa de estoque.`,
        );
      }
      if (res.status === 409) {
        const corpo = (await res.json().catch(() => ({}))) as any;
        throw ErroDominio.conflito(
          corpo?.erro?.mensagem || 'Estoque insuficiente no estoque central do PDV.',
          corpo?.erro?.detalhes || {},
        );
      }
      const corpo = (await res.json().catch(() => ({}))) as any;
      throw ErroDominio.validacao(
        corpo?.erro?.mensagem || `Erro retornado pelo Core (${res.status}).`,
        corpo?.erro?.detalhes || {},
      );
    }
  }
}


