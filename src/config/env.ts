import 'dotenv/config';

export type AmbienteNode = 'development' | 'production' | 'test';
export type NivelLog = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface ConfigAmbiente {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: AmbienteNode;
  LOG_LEVEL: NivelLog;
}

const AMBIENTES_VALIDOS: ReadonlySet<AmbienteNode> = new Set([
  'development',
  'production',
  'test',
]);

const NIVEIS_LOG_VALIDOS: ReadonlySet<NivelLog> = new Set([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);

export function validarEnv(rawEnv: NodeJS.ProcessEnv = process.env): ConfigAmbiente {
  const databaseUrl = rawEnv.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      'Variável de ambiente obrigatória ausente: DATABASE_URL. Configure a string de conexão do PostgreSQL.',
    );
  }

  const nodeEnvRaw = (rawEnv.NODE_ENV?.trim() || 'development') as AmbienteNode;
  if (!AMBIENTES_VALIDOS.has(nodeEnvRaw)) {
    throw new Error(
      `Variável de ambiente inválida: NODE_ENV="${rawEnv.NODE_ENV}". Valores aceitos: development, production, test.`,
    );
  }

  const logLevelRaw = (rawEnv.LOG_LEVEL?.trim() || 'info') as NivelLog;
  if (!NIVEIS_LOG_VALIDOS.has(logLevelRaw)) {
    throw new Error(
      `Variável de ambiente inválida: LOG_LEVEL="${rawEnv.LOG_LEVEL}". Valores aceitos: fatal, error, warn, info, debug, trace, silent.`,
    );
  }

  const portRaw = rawEnv.PORT?.trim() || '3000';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Variável de ambiente inválida: PORT="${rawEnv.PORT}". Informe um número inteiro entre 1 e 65535.`,
    );
  }

  return {
    DATABASE_URL: databaseUrl,
    PORT: port,
    NODE_ENV: nodeEnvRaw,
    LOG_LEVEL: logLevelRaw,
  };
}

export function carregarEnv(
  rawEnv: NodeJS.ProcessEnv = process.env,
  encerrar: (codigo: number) => never = process.exit,
): ConfigAmbiente {
  try {
    return validarEnv(rawEnv);
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : 'Falha ao validar variáveis de ambiente.';
    console.error(`[Configuração] ${mensagem}`);
    return encerrar(1);
  }
}
