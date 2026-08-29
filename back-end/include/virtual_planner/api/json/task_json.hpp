#pragma once

#include <nlohmann/json.hpp>

#include "virtual_planner/domain/entities/task.hpp"

namespace virtual_planner::api::json {

// Serializacao JSON de Task (P-29.2). Reutiliza as conversoes compartilhadas de
// Category, Date, TimeSlot, Priority e TaskStatus definidas em P-29.0.
//
// Task tem UMA forma de agendamento no dominio: o TimeSlot. O campo "shift" e
// DERIVADO de time_slot.start (mesma regra de reporting::shift_of) e sai apenas
// na serializacao, como rotulo de leitura. Na desserializacao "shift" e
// opcional: se vier, precisa ser consistente com time_slot, caso contrario
// std::invalid_argument. time_slot e sempre a fonte de verdade. Ver docs/api.md.
nlohmann::json to_json(const domain::Task& task);

// Lanca std::invalid_argument quando o JSON nao e um objeto, quando falta um
// campo obrigatorio, ou quando "shift" contradiz "time_slot".
domain::Task task_from_json(const nlohmann::json& value);

} // namespace virtual_planner::api::json
