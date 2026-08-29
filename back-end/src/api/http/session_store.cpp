#include "virtual_planner/api/http/session_store.hpp"

#include <array>
#include <mutex>
#include <openssl/rand.h>
#include <stdexcept>

namespace virtual_planner::api::http {

namespace {

std::string hexadecimal(const std::array<unsigned char, 32>& bytes)
{
    constexpr char digits[] = "0123456789abcdef";
    std::string result;
    result.reserve(bytes.size() * 2);

    for (const unsigned char byte : bytes)
    {
        result.push_back(digits[byte >> 4U]);
        result.push_back(digits[byte & 0x0FU]);
    }

    return result;
}

} // namespace

std::string SessionStore::create(std::uint64_t user_id)
{
    std::array<unsigned char, 32> random_bytes{};

    if (RAND_bytes(random_bytes.data(), static_cast<int>(random_bytes.size())) != 1)
    {
        throw std::runtime_error("Could not generate a session identifier.");
    }

    const std::string session_id = hexadecimal(random_bytes);
    const std::lock_guard<std::mutex> lock{mutex_};
    sessions_.emplace(session_id, user_id);
    return session_id;
}

std::optional<std::uint64_t> SessionStore::user_id(
    const std::string& session_id) const
{
    const std::lock_guard<std::mutex> lock{mutex_};
    const auto session = sessions_.find(session_id);
    return session == sessions_.end()
        ? std::nullopt
        : std::optional<std::uint64_t>{session->second};
}

void SessionStore::remove(const std::string& session_id)
{
    const std::lock_guard<std::mutex> lock{mutex_};
    sessions_.erase(session_id);
}

} // namespace virtual_planner::api::http
