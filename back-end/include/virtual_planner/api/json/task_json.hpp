#pragma once

#include <optional>

#include <nlohmann/json.hpp>

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/domain/value_objects/time_slot.hpp"

namespace virtual_planner::api::json {

// Serializacao JSON de Task (P-29.2). Reutiliza as conversoes compartilhadas de
// Category, Date, TimeSlot, Priority e TaskStatus definidas em P-29.0.
//
// Uma Task pode ser agendada de duas formas: por HORARIO (campo "time_slot") ou
// por TURNO (campo "shift"). Quando vem "shift", o backend guarda a janela do
// turno (domain::shift_window) como time_slot e marca "scheduled_by_shift".
// O rotulo "shift" tambem sai sempre na serializacao, derivado de
// time_slot.start (reporting::shift_of). Ver docs/api.md.
nlohmann::json to_json(const domain::Task& task);

// Lanca std::invalid_argument quando o JSON nao e um objeto, quando falta um
// campo obrigatorio, ou quando "shift" contradiz "time_slot".
domain::Task task_from_json(const nlohmann::json& value);

// Agendamento resolvido a partir do corpo: o time_slot efetivo e se ele veio de
// um turno.
struct TaskSchedule
{
    domain::TimeSlot time_slot;
    bool scheduled_by_shift;
};

// Le "time_slot" OU "shift" do corpo. "time_slot" tem prioridade; havendo so
// "shift", devolve a janela do turno com scheduled_by_shift=true. Lanca
// std::invalid_argument se nenhum vier, ou se ambos se contradisserem.
TaskSchedule task_schedule_from_json(const nlohmann::json& body);

// Igual, mas devolve nullopt quando o corpo nao traz nem "time_slot" nem
// "shift" — para o PATCH parcial, que preserva o agendamento atual.
std::optional<TaskSchedule> task_schedule_patch_from_json(
    const nlohmann::json& body);

} // namespace virtual_planner::api::json
