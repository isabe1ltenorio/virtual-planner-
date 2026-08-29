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

} // namespace

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

    const domain::TimeSlot time_slot =
        time_slot_from_json(required_field(value, "time_slot"));

    // "shift" e derivado de time_slot. Aceita ausente; se presente, tem que
    // bater com o turno derivado, para o formato nao ficar ambiguo sobre qual
    // campo manda.
    if (value.contains("shift"))
    {
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

    return domain::Task{
        read_id(value),
        read_description(value),
        category_from_json(required_field(value, "category")),
        date_from_json(required_field(value, "date")),
        time_slot,
        priority_from_json(required_field(value, "priority")),
        task_status_from_json(required_field(value, "status")),
    };
}

} // namespace virtual_planner::api::json
