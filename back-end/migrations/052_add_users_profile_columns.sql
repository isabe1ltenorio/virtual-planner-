-- Faixa 050-059 (`User`, P-26.4).
--
-- Por que esta migration existe, se a 050 já "cria" users com estas colunas:
-- ela não cria. A 001 (faixa base) já criou `users`, então o
-- `CREATE TABLE IF NOT EXISTS` da 050 é um no-op em qualquer banco — a ordem de
-- aplicação é numérica e a 001 sempre roda antes. O resultado é que a tabela
-- fica só com `id`, e todo método de PostgresUserRepository falha com
-- `column "name" does not exist`: register, login e o perfil não funcionam
-- contra banco real. A 050 já está registrada em `schema_migrations`, e o
-- README deste diretório proíbe editar migration aplicada, então a correção
-- vem em arquivo novo.
--
-- Relação com a ADR-002 (P-22A): a ADR decidiu single-tenant sem senha e sem
-- credencial. Depois dela, a autenticação por sessão entrou na `main` e a porta
-- `persistence::UserRepository` passou a exigir `create(user, password_hash)` e
-- `find_credentials_by_email`. Este schema reflete o código que está na main
-- hoje, não o texto da ADR. A ADR precisa de emenda formal por Arquitetura —
-- `docs/architecture.md` está fora da área desta issue.
--
-- Reaplicar é seguro: toda alteração usa IF NOT EXISTS, o backfill é
-- condicionado por WHERE e o índice único é IF NOT EXISTS.

-- - Colunas de perfil e credencial.
--
-- Entram como NULL para que a tabela já povoada (a 001 semeia o usuário 1)
-- aceite o ALTER; o NOT NULL é aplicado no passo 3, depois do backfill.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL
                                           DEFAULT CURRENT_TIMESTAMP;

UPDATE users
SET name          = COALESCE(name, 'Usuario padrao'),
    email         = COALESCE(email, 'usuario-1@local.invalid'),
    password_hash = COALESCE(password_hash, '!')
WHERE name IS NULL
   OR email IS NULL
   OR password_hash IS NULL;

-- -NOT NULL.
--
-- `user_from_row` no adapter lê as três colunas com `as<std::string>()`, que
-- lança em NULL. NOT NULL no banco é o que garante que a leitura não quebra.
ALTER TABLE users
    ALTER COLUMN name          SET NOT NULL,
    ALTER COLUMN email         SET NOT NULL,
    ALTER COLUMN password_hash SET NOT NULL;

-- - Unicidade de e-mail.
--
-- Não é cosmético: `POST /api/auth/register` não checa e-mail repetido no
-- código da aplicação, e `find_credentials_by_email` lê `result.front()` sem
-- verificar quantas linhas vieram. Sem esta restrição, dois cadastros com o
-- mesmo e-mail passam e o login passa a resolver para uma linha arbitrária.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email);
