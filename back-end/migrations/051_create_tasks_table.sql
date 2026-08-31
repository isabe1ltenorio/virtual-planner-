-- Migration 051: sem efeito -- mantida só para não quebrar a sequência de
-- schema_migrations em bancos que já a registraram.
--
-- A tabela `tasks` é criada e mantida pela migration 030 (faixa 030-039), com
-- o schema completo: id IDENTITY, user_id BIGINT, CHECKs de category/priority/
-- status/time_slot e os índices idx_tasks_user_date / idx_tasks_status.
--
-- A versão anterior deste arquivo tentava recriar `tasks` com `CREATE TABLE IF
-- NOT EXISTS` (no-op, pois a 030 já criou) e ainda criava índices redundantes.
-- Removido para evitar divergência de schema.

SELECT 1;
