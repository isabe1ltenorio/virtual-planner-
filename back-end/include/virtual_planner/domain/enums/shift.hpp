#pragma once

#include <string>
#include <string_view>

#include "virtual_planner/domain/value_objects/time_slot.hpp"

namespace virtual_planner::domain {

enum class Shift
{
    Morning,
    Afternoon,
    Evening
};

std::string to_string(Shift value);

Shift shift_from_string(std::string_view value);

// Janela que uma tarefa agendada POR TURNO ocupa (P-18): manhã 06:00-12:00,
// tarde 12:00-18:00, noite 18:00-24:00. É o intervalo usado tanto para
// persistir a tarefa de turno quanto para a checagem de conflito — uma tarefa
// de turno conflita com qualquer outra que caia nessa faixa.
TimeSlot shift_window(Shift value);

} // namespace virtual_planner::domain
