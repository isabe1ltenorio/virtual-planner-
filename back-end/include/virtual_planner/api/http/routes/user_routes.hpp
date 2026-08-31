#pragma once

namespace virtual_planner::api::http {

class ApiServer;

void register_user_routes(ApiServer& api);

} // namespace virtual_planner::api::http
