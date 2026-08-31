#pragma once

#include "virtual_planner/infrastructure/postgres/postgres_config.hpp"
#include "virtual_planner/persistence/database.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)
#include <memory>
#include <pqxx/pqxx>
#endif

namespace virtual_planner::infrastructure::postgres
{

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)
  class PostgresDatabase final : public persistence::Database
  {
  public:
    explicit PostgresDatabase(PostgresConfig config);
    ~PostgresDatabase() noexcept override;

    [[nodiscard]] pqxx::connection &connection();
    [[nodiscard]] const PostgresConfig &config() const noexcept;
    [[nodiscard]] bool is_connected() const noexcept override;

  protected:
    void on_initialize() override;
    void on_connect() override;
    void on_shutdown() override;

  private:
    PostgresConfig config_;
    std::unique_ptr<pqxx::connection> connection_;
  };
#endif

}
