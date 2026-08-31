-- Migration 050: perfil e credenciais do usuário (faixa 050-059, P-26.4).
--
-- A tabela `users` já nasce na migration 001 (apenas `id BIGSERIAL`). Esta
-- migration NÃO recria a tabela -- só acrescenta as colunas de perfil (name,
-- email) e de autenticação (password_hash), usadas pelo login/cadastro
-- (PostgresUserRepository::create / find_credentials_by_email).
--
-- Por que ALTER e não CREATE TABLE: `CREATE TABLE IF NOT EXISTS users` seria
-- ignorado inteiro porque a 001 já criou a tabela -- as colunas nunca seriam
-- adicionadas e o INSERT do cadastro quebraria em runtime.
--
-- A linha semeada pela 001 (id = 1) é retrocompatibilizada com DEFAULT '' e
-- depois o DEFAULT é removido, para que todo cadastro futuro seja obrigado a
-- informar name/email/password_hash. Mesmo padrão da 023.

ALTER TABLE users ADD COLUMN IF NOT EXISTS name          VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email         VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE users ALTER COLUMN name          DROP DEFAULT;
ALTER TABLE users ALTER COLUMN email         DROP DEFAULT;
ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;

-- e-mail é a chave de login (find_credentials_by_email).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);
