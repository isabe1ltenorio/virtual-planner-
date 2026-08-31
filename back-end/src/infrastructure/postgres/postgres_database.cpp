#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

#include "virtual_planner/shared/errors.hpp"

#include <exception>
#include <utility>

namespace virtual_planner::infrastructure::postgres
{

  PostgresDatabase::PostgresDatabase(PostgresConfig config)
      : config_(std::move(config))
  {
  }

  PostgresDatabase::~PostgresDatabase() noexcept
  {
    try
    {
      shutdown();
    }
    catch (...)
    {
    }
  }

  pqxx::connection &PostgresDatabase::connection()
  {
    if (connection_ == nullptr || !connection_->is_open())
    {
      throw shared::PersistenceError("PostgreSQL connection is not open");
    }

    return *connection_;
  }

  const PostgresConfig &PostgresDatabase::config() const noexcept { return config_; }

  bool PostgresDatabase::is_connected() const noexcept
  {
    if (!Database::is_connected() || connection_ == nullptr || !connection_->is_open())
    {
      return false;
    }

    // O estado do ciclo de vida nao detecta uma queda posterior do servidor.
    // O health check verifica a conexao real, no mesmo atendimento serial da API.
    try
    {
      pqxx::nontransaction probe(*connection_);
      return probe.exec("SELECT 1").one_row()[0].as<int>() == 1;
    }
    catch (const std::exception&)
    {
      return false;
    }
  }

  void PostgresDatabase::on_initialize()
  {
    config_.validate();
  }

  void PostgresDatabase::on_connect()
  {
    try
    {
      connection_ = std::make_unique<pqxx::connection>(config_.connection_string());
      if (!connection_->is_open())
      {
        throw shared::PersistenceError("PostgreSQL connection did not open");
      }

      pqxx::work transaction(*connection_);
      transaction.exec("SELECT 1").one_row();
      transaction.commit();
    }
    catch (const shared::ApplicationError &)
    {
      connection_.reset();
      throw;
    }
    catch (const std::exception &error)
    {
      connection_.reset();
      throw shared::PersistenceError(
          "failed to connect to PostgreSQL using " +
          config_.masked_connection_string() + ": " + error.what());
    }
  }

  void PostgresDatabase::on_shutdown()
  {
    if (connection_ != nullptr)
    {
      connection_->close();
      connection_.reset();
    }
  }

}

#endif
