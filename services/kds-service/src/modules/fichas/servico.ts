import { FichasRepositorio, FichaRegistro } from './repositorio';
import { CriarFichaInput, FichaResposta, RespostaPendenciasComanda, StatusFicha } from './schemas';
import { ErroDominio } from '../../shared/erros';

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

  async atualizarStatus(
    id: number,
    novoStatus: StatusFicha,
    _alteradoPor?: string,
  ): Promise<FichaResposta> {
    const ficha = await this.repositorio.buscarPorId(id);
    if (!ficha) {
      throw ErroDominio.naoEncontrado(`Ficha de preparo #${id} não encontrada.`);
    }

    // Idempotência: transição para o mesmo status
    if (ficha.status === novoStatus) {
      return serializarFicha(ficha);
    }

    // Estados terminais imutáveis (RN20)
    if (ficha.status === 'entregue' || ficha.status === 'cancelado') {
      throw ErroDominio.transicaoInvalida(
        `Fichas no estado '${ficha.status}' são finais e não permitem novas transições.`,
      );
    }

    // Validação da máquina de estados linear + cancelamento pré-entrega
    const transicoesValidas: Record<string, string[]> = {
      recebido: ['em_preparo', 'cancelado'],
      em_preparo: ['pronto', 'cancelado'],
      pronto: ['entregue', 'cancelado'],
    };

    const permitidas = transicoesValidas[ficha.status] || [];
    if (!permitidas.includes(novoStatus)) {
      throw ErroDominio.transicaoInvalida(
        `Transição de estado inválida no KDS: não é permitido alterar de '${ficha.status}' para '${novoStatus}'.`,
      );
    }

    const agora = new Date();
    const camposData: { iniciadoEm?: Date; prontoEm?: Date; entregueEm?: Date } = {};

    if (novoStatus === 'em_preparo') {
      camposData.iniciadoEm = agora;
    } else if (novoStatus === 'pronto') {
      camposData.prontoEm = agora;
    } else if (novoStatus === 'entregue') {
      camposData.entregueEm = agora;
    }

    const atualizada = await this.repositorio.atualizarStatusFicha(id, novoStatus, camposData);
    return serializarFicha(atualizada);
  }

  async consultarPendenciasComanda(comandaId: number): Promise<RespostaPendenciasComanda> {
    const registros = await this.repositorio.buscarFichasPorComandaId(comandaId);

    const totais = {
      recebido: 0,
      em_preparo: 0,
      pronto: 0,
      entregue: 0,
      cancelado: 0,
    };

    if (registros.length === 0) {
      return {
        comanda_id: comandaId,
        mesa: 0,
        possui_pendencias: false,
        totais,
        itens: [],
      };
    }

    const mesa = registros[0].mesa;

    const itens = registros.map((reg) => {
      const statusKey = reg.status as keyof typeof totais;
      if (totais[statusKey] !== undefined) {
        totais[statusKey]++;
      }

      return {
        ficha_id: reg.id,
        item_comanda_id: reg.itemComandaId,
        nome_produto: reg.nomeProduto,
        quantidade: reg.quantidade,
        estacao: reg.setor,
        status: reg.status,
      };
    });

    const possui_pendencias = totais.recebido > 0 || totais.em_preparo > 0;

    return {
      comanda_id: comandaId,
      mesa,
      possui_pendencias,
      totais,
      itens,
    };
  }
}

