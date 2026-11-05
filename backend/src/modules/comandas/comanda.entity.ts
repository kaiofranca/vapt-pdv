import { Prisma } from '@prisma/client';
import { ErroDominio } from '../../shared/erros';
import { FormaPagamentoTipo, StatusComandaTipo } from './schemas';

export { FormaPagamentoTipo, StatusComandaTipo };

export interface ItemComandaEntidade {
  id: number;
  produto_id: number;
  nome_copiado: string;
  preco_copiado: string;
  quantidade: number;
}

export interface ComandaEntidade {
  id: number;
  mesa: string;
  nome_cliente: string | null;
  garcom_id: number;
  status: StatusComandaTipo;
  subtotal: string | null;
  taxa_servico: string | null;
  total: string | null;
  forma_pagamento: FormaPagamentoTipo | null;
  aberta_em: Date;
  fechada_em: Date | null;
  paga_em: Date | null;
  itens: ItemComandaEntidade[];
  integracao_caixa_pendente?: boolean;
  integracao_gestao_pendente?: boolean;
  avisos?: string[];
}

export interface CriarComandaDados {
  mesa: string | number;
  garcom_id: number;
  nome_cliente?: string | null;
}

export interface LancarItemDados {
  produto_id: number;
  quantidade: number;
}

export interface AjustarItemDados {
  quantidade: number;
}

export interface FecharComandaDados {
  aplicar_taxa_servico: boolean;
}

export interface PagarComandaDados {
  forma_pagamento: FormaPagamentoTipo;
  documento_cliente?: string | null;
}

export interface FiltrosListagemComandas {
  status?: StatusComandaTipo;
  mesa?: string;
  de?: string;
  ate?: string;
  limit?: number;
  offset?: number;
}

export interface RegistroItemComandaBanco {
  id: number;
  comanda_id?: number;
  produto_id: number;
  nome_copiado: string;
  preco_copiado: unknown;
  quantidade: number;
}

export interface RegistroComandaBanco {
  id: number;
  mesa: string;
  nome_cliente: string | null;
  garcom_id: number;
  status: StatusComandaTipo;
  subtotal: unknown;
  taxa_servico: unknown;
  total: unknown;
  forma_pagamento: FormaPagamentoTipo | null;
  aberta_em: Date;
  fechada_em: Date | null;
  paga_em: Date | null;
  itens?: RegistroItemComandaBanco[];
}

export function formatarValorMonetario(valor: unknown): string {
  if (
    valor !== null &&
    typeof valor === 'object' &&
    'toFixed' in (valor as Record<string, unknown>) &&
    typeof (valor as { toFixed?: unknown }).toFixed === 'function'
  ) {
    return (valor as { toFixed: (casas: number) => string }).toFixed(2);
  }
  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (/^-?\d+(\.\d{1,2})?$/.test(texto)) {
      const [inteiro, decimal = ''] = texto.split('.');
      return `${inteiro}.${decimal.padEnd(2, '0')}`;
    }
    return new Prisma.Decimal(texto).toFixed(2);
  }
  throw ErroDominio.interno('Valor monetário em formato inválido ao serializar comanda.');
}

export function formatarValorMonetarioOpcional(valor: unknown): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  return formatarValorMonetario(valor);
}

export function normalizarMesa(mesa: string | number): string {
  if (typeof mesa === 'number') {
    if (!Number.isFinite(mesa) || !Number.isInteger(mesa) || mesa < 1 || mesa > 2147483647) {
      throw ErroDominio.validacao(
        'O número da mesa deve ser um inteiro maior ou igual a 1.',
        {
          mesa: 'O número da mesa deve ser um inteiro maior ou igual a 1.',
        },
      );
    }
    return String(mesa);
  }

  if (typeof mesa === 'string') {
    const mesaLimpa = mesa.trim();
    if (!mesaLimpa) {
      throw ErroDominio.validacao('A identificação da mesa não pode ser vazia.', {
        mesa: 'O campo não pode ser vazio.',
      });
    }
    if (mesaLimpa.length > 50) {
      throw ErroDominio.validacao(
        'A identificação da mesa não pode exceder 50 caracteres.',
        {
          mesa: 'O campo deve ter no máximo 50 caracteres.',
        },
      );
    }
    if (/^(?:[+-]?(?:0+(?:\.\d+)?|\d+\.\d+)|-\d+)$/.test(mesaLimpa)) {
      throw ErroDominio.validacao(
        'O número da mesa deve ser um inteiro maior ou igual a 1.',
        {
          mesa: 'O número da mesa deve ser um inteiro maior ou igual a 1.',
        },
      );
    }
    return mesaLimpa;
  }

  throw ErroDominio.validacao('A identificação da mesa é inválida.', {
    mesa: 'Informe uma string não vazia ou um número inteiro positivo.',
  });
}

export function normalizarNomeCliente(nomeCliente?: string | null): string | null {
  if (nomeCliente === undefined || nomeCliente === null) {
    return null;
  }

  const nomeLimpo = nomeCliente.trim();
  if (!nomeLimpo) {
    return null;
  }

  if (nomeLimpo.length > 100) {
    throw ErroDominio.validacao(
      'O nome do cliente não pode exceder 100 caracteres.',
      {
        nome_cliente: 'O campo deve ter no máximo 100 caracteres.',
      },
    );
  }

  return nomeLimpo;
}

const REGEX_ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2})))?$/;

export function parsearDataIso8601(valor: string, campo: 'de' | 'ate'): Date {
  const texto = valor.trim();
  const match = REGEX_ISO_8601.exec(texto);

  if (!match) {
    throw ErroDominio.validacao(
      `O parâmetro "${campo}" deve estar em formato ISO 8601 válido.`,
      {
        [campo]: 'Data em formato ISO 8601 inválido.',
      },
    );
  }

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const possuiHorario = match[4] !== undefined;
  const hora = possuiHorario ? Number(match[4]) : 0;
  const minuto = possuiHorario ? Number(match[5]) : 0;
  const segundo = possuiHorario ? Number(match[6]) : 0;
  const offsetHora = match[10] !== undefined ? Number(match[10]) : 0;
  const offsetMinuto = match[11] !== undefined ? Number(match[11]) : 0;

  if (
    mes < 1 ||
    mes > 12 ||
    dia < 1 ||
    dia > 31 ||
    hora > 23 ||
    minuto > 59 ||
    segundo > 59 ||
    offsetHora > 23 ||
    offsetMinuto > 59
  ) {
    throw ErroDominio.validacao(
      `O parâmetro "${campo}" contém componentes de data/hora fora dos limites válidos.`,
      {
        [campo]: 'Data em formato ISO 8601 inválido.',
      },
    );
  }

  const verificacaoCalendario = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    verificacaoCalendario.getUTCFullYear() !== ano ||
    verificacaoCalendario.getUTCMonth() !== mes - 1 ||
    verificacaoCalendario.getUTCDate() !== dia
  ) {
    throw ErroDominio.validacao(
      `O parâmetro "${campo}" representa uma data de calendário inexistente.`,
      {
        [campo]: 'Data de calendário inválida.',
      },
    );
  }

  if (!possuiHorario) {
    if (campo === 'ate') {
      return new Date(Date.UTC(ano, mes - 1, dia, 23, 59, 59, 999));
    }
    return new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0));
  }

  const milissegundos =
    match[7] !== undefined ? match[7].slice(0, 3).padEnd(3, '0') : '000';
  const isoNormalizado = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${milissegundos}${match[8]}`;

  const data = new Date(isoNormalizado);
  if (Number.isNaN(data.getTime())) {
    throw ErroDominio.validacao(
      `O parâmetro "${campo}" deve estar em formato ISO 8601 válido.`,
      {
        [campo]: 'Data em formato ISO 8601 inválido.',
      },
    );
  }

  return data;
}

export function ehErroUnicidadePrisma(erro: unknown): boolean {
  if (
    !erro ||
    typeof erro !== 'object' ||
    !('code' in erro) ||
    (erro as { code?: unknown }).code !== 'P2002'
  ) {
    return false;
  }

  const meta = (erro as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;

  if (typeof target === 'string') {
    return (
      target.includes('mesa') ||
      target.includes('comandas_mesa_aberta_unique_idx')
    );
  }

  if (Array.isArray(target)) {
    return target.some(
      (item) =>
        typeof item === 'string' &&
        (item.includes('mesa') ||
          item.includes('comandas_mesa_aberta_unique_idx')),
    );
  }

  return true;
}
