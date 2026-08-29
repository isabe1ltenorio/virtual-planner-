#pragma once

#include <cstdint>
#include <optional>
#include <mutex>
#include <string>
#include <unordered_map>

namespace virtual_planner::api::http {

class SessionStore
{
public:
    [[nodiscard]] std::string create(std::uint64_t user_id);
    [[nodiscard]] std::optional<std::uint64_t> user_id(
        const std::string& session_id) const;
    void remove(const std::string& session_id);

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::string, std::uint64_t> sessions_;
};

} // namespace virtual_planner::api::http
