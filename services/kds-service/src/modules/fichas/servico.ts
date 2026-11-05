import { FichasRepositorio, FichaRegistro } from './repositorio';
import { CriarFichaInput, FichaResposta } from './schemas';

export interface FichaFilaItem extends FichaResposta {
  tempo_decorrido_segundos: number;
  sla_status: 'normal' | 'atencao' | 'atrasado';
}

export interface RespostaFila {
  fichas: FichaFilaItem[];
  resumo: Record<string, number>;
}

export function calcularSlaStatus(tempoSegundos: number): 'normal' | 'atencao' | 'atrasado' {
  if (tempoSegundos < 480) {
    return 'normal';
  }
  if (tempoSegundos <= 900) {
    return 'atencao';
  }
  return 'atrasado';
}

export function serializarFicha(ficha: FichaRegistro): FichaResposta {
  return {
    id: ficha.id,
    comanda_id: ficha.comandaId,
    item_comanda_id: ficha.itemComandaId,
    produto_id: ficha.produtoId,
    mesa: ficha.mesa,
    garcom_nome: ficha.nomeGarcom,
    nome_produto: ficha.nomeProduto,
    estacao: ficha.setor,
    quantidade: ficha.quantidade,
    observacao: ficha.observacao,
    status: ficha.status,
    recebido_em: ficha.recebidoEm instanceof Date ? ficha.recebidoEm.toISOString() : new Date(ficha.recebidoEm).toISOString(),
    iniciado_em: ficha.iniciadoEm ? (ficha.iniciadoEm instanceof Date ? ficha.iniciadoEm.toISOString() : new Date(ficha.iniciadoEm).toISOString()) : null,
    pronto_em: ficha.prontoEm ? (ficha.prontoEm instanceof Date ? ficha.prontoEm.toISOString() : new Date(ficha.prontoEm).toISOString()) : null,
    entregue_em: ficha.entregueEm ? (ficha.entregueEm instanceof Date ? ficha.entregueEm.toISOString() : new Date(ficha.entregueEm).toISOString()) : null,
    cancelado_em: null,
  };
}

export class FichasServico {
  constructor(private readonly repositorio: FichasRepositorio) {}

  async registrarFicha(dados: CriarFichaInput): Promise<{ criada: boolean; ficha: FichaResposta }> {
    const resultado = await this.repositorio.criarOuObterFicha(dados);
    return {
      criada: resultado.criada,
      ficha: serializarFicha(resultado.ficha),
    };
  }

  async consultarFila(
    filtros: {
      estacao?: string;
      setor?: string;
      status?: string;
      mesa?: number;
    },
    dataReferencia: Date = new Date(),
  ): Promise<RespostaFila> {
    const setorFiltro = filtros.estacao || filtros.setor;
    const statusList = filtros.status
      ? filtros.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const registros = await this.repositorio.listarFichas({
      setor: setorFiltro,
      statusList,
      mesa: filtros.mesa,
    });

    const agoraMs = dataReferencia.getTime();

    const fichas: FichaFilaItem[] = registros.map((reg) => {
      const serializada = serializarFicha(reg);
      const recebidoMs = reg.recebidoEm instanceof Date ? reg.recebidoEm.getTime() : new Date(reg.recebidoEm).getTime();
      const tempoDecorrido = Math.max(0, Math.floor((agoraMs - recebidoMs) / 1000));
      const sla = calcularSlaStatus(tempoDecorrido);

      return {
        ...serializada,
        tempo_decorrido_segundos: tempoDecorrido,
        sla_status: sla,
      };
    });

    const resumo = await this.repositorio.contarPorStatus({ setor: setorFiltro });

    return {
      fichas,
      resumo,
    };
  }
}

