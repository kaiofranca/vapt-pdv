SELECT 'CREATE DATABASE caixa_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'caixa_db')\gexec

SELECT 'CREATE DATABASE gestao_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'gestao_db')\gexec

SELECT 'CREATE DATABASE kds_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kds_db')\gexec
