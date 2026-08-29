#include <nlohmann/json.hpp>

#include "virtual_planner/api/json/task_json.hpp"
#include "support/expect.hpp"

#include <chrono>
#include <stdexcept>

using namespace virtual_planner;

namespace {

template <typename Callable>
bool throws_invalid_argument(Callable callable)
{
    try
    {
        callable();
    }
    catch (const std::invalid_argument&)
    {
        return true;
    }
    catch (...)
    {
        return false;
    }

    return false;
}

domain::Task make_task(domain::TimeSlot slot)
{
    return domain::Task{
        7,
        "Sessao de estudo",
        domain::Category::Study,
        domain::Date{29, 8, 2026},
        slot,
        domain::Priority::High,
        domain::TaskStatus::Pending};
}

// Uma tarefa "por turno" no dominio e uma tarefa cujo TimeSlot cai naquele
// turno: o rotulo shift acompanha time_slot.start. Cobre round-trip das duas
// leituras -- o intervalo exato e o turno derivado.
void expect_round_trip(domain::TimeSlot slot, const char* expected_shift)
{
    const domain::Task original = make_task(slot);
    const nlohmann::json serialized = api::json::to_json(original);

    VP_EXPECT(serialized.at("time_slot").at("start") == slot.start().count(),
              "time_slot.start should serialize from the interval");
    VP_EXPECT(serialized.at("time_slot").at("end") == slot.end().count(),
              "time_slot.end should serialize from the interval");
    VP_EXPECT(serialized.at("shift") == expected_shift,
              "shift should be derived from time_slot.start");

    const domain::Task parsed = api::json::task_from_json(serialized);

    VP_EXPECT(parsed.id() == original.id(),
              "id should survive the round trip");
    VP_EXPECT(parsed.description() == original.description(),
              "description should survive the round trip");
    VP_EXPECT(parsed.category() == original.category(),
              "category should survive the round trip");
    VP_EXPECT(parsed.date() == original.date(),
              "date should survive the round trip");
    VP_EXPECT(parsed.time_slot().start() == slot.start(),
              "time_slot.start should survive the round trip");
    VP_EXPECT(parsed.time_slot().end() == slot.end(),
              "time_slot.end should survive the round trip");
    VP_EXPECT(parsed.priority() == original.priority(),
              "priority should survive the round trip");
    VP_EXPECT(parsed.status() == original.status(),
              "status should survive the round trip");
}

} // namespace

int main()
{
    // --- to_json: forma completa ----------------------------------------
    {
        const nlohmann::json serialized = api::json::to_json(make_task(
            domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}}));

        VP_EXPECT(serialized.at("id") == 7, "id should serialize");
        VP_EXPECT(serialized.at("description") == "Sessao de estudo",
                  "description should serialize");
        VP_EXPECT(serialized.at("category") == "Study",
                  "category should reuse the shared representation");
        VP_EXPECT(serialized.at("date") == "2026-08-29",
                  "date should reuse the shared representation");
        VP_EXPECT(serialized.at("time_slot").at("start") == 540,
                  "time_slot.start should be minutes from midnight");
        VP_EXPECT(serialized.at("time_slot").at("end") == 600,
                  "time_slot.end should be minutes from midnight");
        VP_EXPECT(serialized.at("shift") == "Morning",
                  "shift should be derived and present on output");
        VP_EXPECT(serialized.at("priority") == "High",
                  "priority should serialize");
        VP_EXPECT(serialized.at("status") == "Pending",
                  "status should serialize");
    }

    // --- Round-trip nos tres turnos e nas fronteiras de shift_of --------
    expect_round_trip(
        domain::TimeSlot{std::chrono::hours{6}, std::chrono::hours{8}},
        "Morning");
    expect_round_trip(
        domain::TimeSlot{std::chrono::hours{13}, std::chrono::hours{14}},
        "Afternoon");
    expect_round_trip(
        domain::TimeSlot{std::chrono::hours{20}, std::chrono::hours{22}},
        "Evening");
    // 12:00 -> Afternoon, 18:00 -> Evening.
    expect_round_trip(
        domain::TimeSlot{std::chrono::hours{12}, std::chrono::hours{13}},
        "Afternoon");
    expect_round_trip(
        domain::TimeSlot{std::chrono::hours{18}, std::chrono::hours{19}},
        "Evening");

    // --- task_from_json: "shift" e opcional na entrada -----------------
    {
        nlohmann::json payload = api::json::to_json(make_task(
            domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}}));
        payload.erase("shift");

        const domain::Task parsed = api::json::task_from_json(payload);
        VP_EXPECT(parsed.time_slot().start() == std::chrono::minutes{540},
                  "a payload without shift should still parse");
    }

    // --- task_from_json: "shift" consistente e aceito -----------------
    {
        const nlohmann::json payload = api::json::to_json(make_task(
            domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}}));

        VP_EXPECT(!throws_invalid_argument([&payload] {
                      return api::json::task_from_json(payload);
                  }),
                  "a payload with a consistent shift should be accepted");
    }

    // --- task_from_json: "shift" que contradiz time_slot e rejeitado --
    {
        nlohmann::json payload = api::json::to_json(make_task(
            domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}}));
        payload["shift"] = "Evening"; // time_slot diz Morning

        VP_EXPECT(throws_invalid_argument([&payload] {
                      return api::json::task_from_json(payload);
                  }),
                  "a shift that contradicts time_slot should be rejected");
    }

    // --- task_from_json: erros de payload ---------------------------
    {
        const nlohmann::json base = api::json::to_json(make_task(
            domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}}));

        nlohmann::json missing_time_slot = base;
        missing_time_slot.erase("time_slot");

        nlohmann::json string_id = base;
        string_id["id"] = "7";

        nlohmann::json missing_status = base;
        missing_status.erase("status");

        VP_EXPECT(throws_invalid_argument([&missing_time_slot] {
                      return api::json::task_from_json(missing_time_slot);
                  }),
                  "a Task without time_slot should be rejected");
        VP_EXPECT(throws_invalid_argument([&string_id] {
                      return api::json::task_from_json(string_id);
                  }),
                  "a string Task id should be rejected");
        VP_EXPECT(throws_invalid_argument([&missing_status] {
                      return api::json::task_from_json(missing_status);
                  }),
                  "a Task without a required field should be rejected");
        VP_EXPECT(throws_invalid_argument([] {
                      return api::json::task_from_json(nlohmann::json::array());
                  }),
                  "a non-object Task should be rejected");
    }

    return 0;
}
