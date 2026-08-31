#include "virtual_planner/domain/enums/shift.hpp"

#include <chrono>
#include <stdexcept>

namespace virtual_planner::domain {

std::string to_string(Shift shift)
{
    switch (shift)
    {
        case Shift::Morning:
            return "Morning";

        case Shift::Afternoon:
            return "Afternoon";

        case Shift::Evening:
            return "Evening";

    }

    throw std::invalid_argument("Invalid Shift");
}

Shift shift_from_string(std::string_view value)
{
    if (value == "Morning") return Shift::Morning;
    if (value == "Afternoon") return Shift::Afternoon;
    if (value == "Evening") return Shift::Evening;

    throw std::invalid_argument("Invalid Shift");
}

TimeSlot shift_window(Shift value)
{
    using std::chrono::minutes;

    switch (value)
    {
        case Shift::Morning:
            return TimeSlot{minutes{6 * 60}, minutes{12 * 60}};

        case Shift::Afternoon:
            return TimeSlot{minutes{12 * 60}, minutes{18 * 60}};

        case Shift::Evening:
            return TimeSlot{minutes{18 * 60}, minutes{24 * 60}};
    }

    throw std::invalid_argument("Invalid Shift");
}

}  // namespace virtual_planner::domain
