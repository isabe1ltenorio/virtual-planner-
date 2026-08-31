#include "virtual_planner/api/json/task_json.hpp"

#include "virtual_planner/api/json/shared_json.hpp"
#include "virtual_planner/application/reporting/reporting_service.hpp"
#include "virtual_planner/domain/enums/shift.hpp"

#include <cstdint>
#include <stdexcept>
#include <string>

namespace virtual_planner::api::json {

namespace {

const nlohmann::json& required_field(const nlohmann::json& value,
                                     const char* field)
{
    if (!value.contains(field))
    {
        throw std::invalid_argument(
            std::string{"Task requires the field \""} + field + "\".");
    }

    return value.at(field);
}

std::uint64_t read_id(const nlohmann::json& value)
{
    const nlohmann::json& id = required_field(value, "id");

    if (!id.is_number_unsigned())
    {
        throw std::invalid_argument(
            "Task field \"id\" must be an unsigned integer.");
    }

    return id.get<std::uint64_t>();
}

std::string read_description(const nlohmann::json& value)
{
    const nlohmann::json& description = required_field(value, "description");

    if (!description.is_string())
    {
        throw std::invalid_argument(
            "Task field \"description\" must be a string.");
    }

    return description.get<std::string>();
}

// Confere que um "shift" declarado no corpo bate com o turno derivado do
// time_slot, para o formato nao ficar ambiguo sobre qual campo manda.
void check_shift_matches(const nlohmann::json& value,
                         const domain::TimeSlot& time_slot)
{
    if (!value.contains("shift"))
    {
        return;
    }

    const domain::Shift declared = shift_from_json(value.at("shift"));
    const domain::Shift derived =
        application::reporting::shift_of(time_slot);

    if (declared != derived)
    {
        throw std::invalid_argument(
            "Task field \"shift\" is inconsistent with \"time_slot\"; "
            "shift is derived from time_slot and must not contradict it.");
    }
}

} // namespace

TaskSchedule task_schedule_from_json(const nlohmann::json& body)
{
    if (body.contains("time_slot"))
    {
        const domain::TimeSlot time_slot =
            time_slot_from_json(body.at("time_slot"));
        check_shift_matches(body, time_slot);
        return TaskSchedule{time_slot, false};
    }

    if (body.contains("shift"))
    {
        const domain::Shift shift = shift_from_json(body.at("shift"));
        return TaskSchedule{domain::shift_window(shift), true};
    }

    throw std::invalid_argument(
        "Task requires either \"time_slot\" or \"shift\".");
}

std::optional<TaskSchedule> task_schedule_patch_from_json(
    const nlohmann::json& body)
{
    if (!body.contains("time_slot") && !body.contains("shift"))
    {
        return std::nullopt;
    }

    return task_schedule_from_json(body);
}

nlohmann::json to_json(const domain::Task& task)
{
    return nlohmann::json{
        {"id", task.id()},
        {"description", task.description()},
        {"category", to_json(task.category())},
        {"date", to_json(task.date())},
        {"time_slot", to_json(task.time_slot())},
        // Derivado, somente leitura: o turno em que o TimeSlot comeca.
        {"shift", to_json(application::reporting::shift_of(task.time_slot()))},
        // true quando a tarefa foi agendada por turno (time_slot e a janela).
        {"scheduled_by_shift", task.scheduled_by_shift()},
        {"priority", to_json(task.priority())},
        {"status", to_json(task.status())},
    };
}

domain::Task task_from_json(const nlohmann::json& value)
{
    if (!value.is_object())
    {
        throw std::invalid_argument("Task must be a JSON object.");
    }

    TaskSchedule schedule = task_schedule_from_json(value);
    if (value.contains("time_slot") && value.contains("scheduled_by_shift"))
    {
        const auto& marker = value.at("scheduled_by_shift");
        if (!marker.is_boolean())
        {
            throw std::invalid_argument(
                "Task field \"scheduled_by_shift\" must be a boolean.");
        }
        schedule.scheduled_by_shift = marker.get<bool>();
        if (schedule.scheduled_by_shift)
        {
            const auto window = domain::shift_window(
                application::reporting::shift_of(schedule.time_slot));
            if (schedule.time_slot.start() != window.start() ||
                schedule.time_slot.end() != window.end())
            {
                throw std::invalid_argument(
                    "A by-shift Task must use the complete shift window.");
            }
        }
    }

    return domain::Task{
        read_id(value),
        read_description(value),
        category_from_json(required_field(value, "category")),
        date_from_json(required_field(value, "date")),
        schedule.time_slot,
        priority_from_json(required_field(value, "priority")),
        task_status_from_json(required_field(value, "status")),
        schedule.scheduled_by_shift,
    };
}

} // namespace virtual_planner::api::json
