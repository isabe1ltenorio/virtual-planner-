-- Faixa 030-039 (`Task`).
--
-- A 030 assumia uma única forma de agendamento: `start_minutes` / `end_minutes`
-- obrigatórios, e o turno era só derivado (ReportingService::shift_of, sem
-- coluna). O requisito 2/3 pede agendar TAMBÉM por turno, sem horário.
--
-- Modelagem escolhida (menos invasiva): a tarefa de turno continua guardando
-- um `start_minutes` / `end_minutes` — a janela do turno (domain::shift_window:
-- manhã 06:00-12:00, tarde 12:00-18:00, noite 18:00-24:00) — e esta flag marca
-- que aquele intervalo veio de um turno, não de um horário escolhido. Assim os
-- CHECKs de time_slot e a checagem de conflito continuam valendo sem mudança, e
-- o turno de relatório segue derivado de start_minutes.
--
-- Reaplicar é seguro: a coluna só é adicionada se ainda não existir.

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS scheduled_by_shift BOOLEAN NOT NULL DEFAULT FALSE;
