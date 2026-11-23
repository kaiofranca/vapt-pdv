import { ClienteBanco } from '../prisma';
import { CriarFichaInput } from '../../modules/fichas/schemas';
import { FichasServico } from '../../modules/fichas/servico';
import { registrarConsumidorIdempotente } from './consumer.helper';
import { CanalAmqp, FILAS } from './topology';

export interface FichasServicoConsumidor {
  registrarFicha(dados: CriarFichaInput, tx?: ClienteBanco): Promise<unknown>;
  cancelarFichas(
    dados: { comanda_id?: number; item_comanda_id?: number },
    tx?: ClienteBanco,
  ): Promise<unknown>;
}

export interface LoggerConsumidorKds {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
}

function inteiroPositivoValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
}

function validarPayloadItemLancado(payload: Record<string, unknown>): CriarFichaInput {
  const camposInteiros = [
    'comanda_id',
    'item_comanda_id',
    'mesa',
    'garcom_id',
    'produto_id',
    'quantidade',
  ] as const;

  for (const campo of camposInteiros) {
    if (!inteiroPositivoValido(payload[campo])) {
      throw new Error(`Campo obrigatório inválido no evento item.lancado: ${campo}`);
    }
  }

  if (typeof payload.nome_produto !== 'string' || payload.nome_produto.trim().length === 0) {
    throw new Error('Campo obrigatório inválido no evento item.lancado: nome_produto');
  }

  const setorBruto =
    typeof payload.setor === 'string' && payload.setor.trim().length > 0
      ? payload.setor.trim()
      : typeof payload.estacao === 'string' && payload.estacao.trim().length > 0
        ? payload.estacao.trim()
        : 'cozinha';

  const nomeGarcom =
    typeof payload.nome_garcom === 'string'
      ? payload.nome_garcom
      : typeof payload.garcom_nome === 'string'
        ? payload.garcom_nome
        : undefined;

  const observacao =
    typeof payload.observacao === 'string'
      ? payload.observacao
      : payload.observacao === null
        ? null
        : undefined;

  return {
    comanda_id: payload.comanda_id as number,
    item_comanda_id: payload.item_comanda_id as number,
    mesa: payload.mesa as number,
    garcom_id: payload.garcom_id as number,
    nome_garcom: nomeGarcom,
    estacao: setorBruto as 'cozinha' | 'bar',
    setor: setorBruto as 'cozinha' | 'bar',
    produto_id: payload.produto_id as number,
    nome_produto: payload.nome_produto.trim(),
    quantidade: payload.quantidade as number,
    observacao,
  };
}

/**
 * Registra o consumidor idempotente do KDS na fila `kds.item.lancado`.
 */
export async function registrarConsumidorKds(
  canal: CanalAmqp,
  prisma: ClienteBanco,
  fichasServico: FichasServicoConsumidor,
  logger?: LoggerConsumidorKds,
): Promise<unknown> {
  return registrarConsumidorIdempotente<Record<string, unknown>>(canal, {
    fila: FILAS.KDS_ITEM_LANCADO,
    logger,
    processar: async (payload, meta) => {
      const { eventoId } = meta;
      const tipoEvento =
        (typeof payload.evento === 'string' && payload.evento.trim()) ||
        meta.msg.fields.routingKey;

      const executar = async (db: ClienteBanco): Promise<{ duplicado: boolean }> => {
        if (typeof db.eventoProcessado?.findUnique === 'function') {
          const jaProcessado = await db.eventoProcessado.findUnique({
            where: { eventoId },
          });
          if (jaProcessado) {
            return { duplicado: true };
          }
        }

        const ehServicoReal = fichasServico instanceof FichasServico;

        if (tipoEvento === 'item.lancado') {
          const dadosFicha = validarPayloadItemLancado(payload);
          if (ehServicoReal) {
            await fichasServico.registrarFicha(dadosFicha, db);
          } else {
            await fichasServico.registrarFicha(dadosFicha);
          }
        } else if (tipoEvento === 'comanda.cancelada') {
          if (!inteiroPositivoValido(payload.comanda_id)) {
            throw new Error('Campo obrigatório inválido no evento comanda.cancelada: comanda_id');
          }
          if (ehServicoReal) {
            await fichasServico.cancelarFichas({ comanda_id: payload.comanda_id }, db);
          } else {
            await fichasServico.cancelarFichas({ comanda_id: payload.comanda_id });
          }
        } else {
          throw new Error(
            `Tipo de evento não suportado na fila ${FILAS.KDS_ITEM_LANCADO}: ${tipoEvento}`,
          );
        }

        if (typeof db.eventoProcessado?.create === 'function') {
          await db.eventoProcessado.create({
            data: {
              eventoId,
              evento: tipoEvento,
            },
          });
        }

        return { duplicado: false };
      };

      try {
        if (typeof prisma.$transaction === 'function') {
          return await prisma.$transaction(async (tx) => executar(tx));
        }
        return await executar(prisma);
      } catch (erro: any) {
        if (erro?.code === 'P2002') {
          return { duplicado: true };
        }
        throw erro;
      }
    },
  });
}
