#pragma once

#include <cstdint>
#include <string>

#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/domain/enums/category.hpp"
#include "virtual_planner/domain/enums/priority.hpp"
#include "virtual_planner/domain/enums/task_status.hpp"
#include "virtual_planner/domain/value_objects/time_slot.hpp"

namespace virtual_planner::domain {

class Task
{
public:
    Task(
        std::uint64_t id,
        std::string description,
        Category category,
        Date date,
        TimeSlot time_slot,
        Priority priority,
        TaskStatus status,
        // Quando true, a tarefa foi agendada por TURNO: o time_slot acima é a
        // janela do turno (domain::shift_window), não um horário escolhido.
        // O turno em si continua sendo derivado de time_slot.start().
        bool scheduled_by_shift = false
    );

    [[nodiscard]] std::uint64_t id() const;

    [[nodiscard]] const std::string& description() const;

    [[nodiscard]] Category category() const;

    [[nodiscard]] Date date() const;

    [[nodiscard]] TimeSlot time_slot() const;

    [[nodiscard]] bool scheduled_by_shift() const;

    [[nodiscard]] Priority priority() const;

    [[nodiscard]] TaskStatus status() const;

    void update_description(std::string description);

    void change_category(Category category);

    void change_date(Date date);

     void mark_as_pending();
    
    void mark_as_executed();

    void mark_as_partially_executed();

    void mark_as_cancelled();

    void mark_as_postponed();

    void change_time_slot(TimeSlot time_slot);

    void set_scheduled_by_shift(bool scheduled_by_shift);

    void change_priority(Priority priority);

private:
    std::uint64_t id_;

    std::string description_;

    Category category_;

    Date date_;

    TimeSlot time_slot_;

    bool scheduled_by_shift_;

    Priority priority_;

    TaskStatus status_;
};

} // namespace virtual_planner::domain




