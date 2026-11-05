import dotenv from 'dotenv';
import path from 'path';

export type AmbienteNode = 'development' | 'test' | 'production';
export type NivelLog = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface VariaveisAmbiente {
  PORT: number;
  NODE_ENV: AmbienteNode;
  LOG_LEVEL: NivelLog;
  DATABASE_URL: string;
}

export function carregarEnv(): VariaveisAmbiente {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const rawPort = process.env.PORT;
  const parsedPort = rawPort ? Number(rawPort) : 3001;
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3001;

  const nodeEnv: AmbienteNode =
    process.env.NODE_ENV === 'production'
      ? 'production'
      : process.env.NODE_ENV === 'test'
        ? 'test'
        : 'development';

  const niveisPermitidos: NivelLog[] = [
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ];

  const logLevel: NivelLog = niveisPermitidos.includes(process.env.LOG_LEVEL as NivelLog)
    ? (process.env.LOG_LEVEL as NivelLog)
    : 'info';

  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/kds_db?schema=public';

  return {
    PORT: port,
    NODE_ENV: nodeEnv,
    LOG_LEVEL: logLevel,
    DATABASE_URL: databaseUrl,
  };
}

