#include "virtual_planner/api/http/routes/user_routes.hpp"

#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/json/user_json.hpp"
#include "virtual_planner/application/user/get_user_profile_use_case.hpp"
#include "virtual_planner/application/user/update_user_profile_use_case.hpp"

#include <nlohmann/json.hpp>

#include <cstdint>
#include <stdexcept>

namespace virtual_planner::api::http {

namespace {

std::uint64_t caller_id(const ApiServer& api, const httplib::Request& request)
{
    const auto user_id = api.authenticated_user_id(request);
    if (!user_id.has_value())
    {
        throw std::logic_error("User route reached without an authenticated caller.");
    }
    return *user_id;
}

application::UpdateUserProfileRequest update_profile_request_from(
    const httplib::Request& request, const domain::User& current)
{
    nlohmann::json body;
    try
    {
        body = nlohmann::json::parse(request.body);
    }
    catch (const nlohmann::json::exception&)
    {
        throw std::invalid_argument("Invalid JSON payload.");
    }

    if (!body.is_object())
    {
        throw std::invalid_argument("User payload must be a JSON object.");
    }

    auto profile = json::to_json(current);
    for (const auto& [field, value] : body.items())
    {
        if (field != "name" && field != "email")
        {
            throw std::invalid_argument("User profile accepts only name and email.");
        }
        profile[field] = value;
    }

    const domain::User updated = json::user_from_json(profile);
    return application::UpdateUserProfileRequest{updated.name(), updated.email()};
}

} // namespace

void register_user_routes(ApiServer& api)
{
    persistence::UserRepository* users = api.repositories().users;
    if (users == nullptr)
    {
        throw std::logic_error("User repository is not configured.");
    }

    api.server().Get("/api/users/me",
        [&api, users](const httplib::Request& request, httplib::Response& response) {
            application::GetUserProfileUseCase get{*users, caller_id(api, request)};
            response.set_content(json::to_json(get.execute()).dump(), "application/json");
        });

    api.server().Patch("/api/users/me",
        [&api, users](const httplib::Request& request, httplib::Response& response) {
            const std::uint64_t user_id = caller_id(api, request);
            application::GetUserProfileUseCase get{*users, user_id};
            const domain::User current = get.execute();
            application::UpdateUserProfileUseCase update{*users, user_id};
            update.execute(update_profile_request_from(request, current));
            response.set_content(json::to_json(get.execute()).dump(), "application/json");
        });
}

} // namespace virtual_planner::api::http
