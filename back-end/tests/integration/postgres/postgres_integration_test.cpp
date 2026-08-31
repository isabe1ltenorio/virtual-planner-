#include "virtual_planner/infrastructure/postgres/postgres_config.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_transaction.hpp"

#include "support/expect.hpp"

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>

namespace
{

  bool has_postgres_environment()
  {
    return std::getenv("POSTGRES_DB") != nullptr &&
           std::getenv("POSTGRES_USER") != nullptr &&
           std::getenv("POSTGRES_PASSWORD") != nullptr;
  }

}

int main()
{
  using virtual_planner::infrastructure::postgres::PostgresConfig;
  using virtual_planner::infrastructure::postgres::PostgresDatabase;
  using virtual_planner::infrastructure::postgres::PostgresTransaction;

  if (!has_postgres_environment())
  {
    std::cout << "Skipping PostgreSQL integration test: POSTGRES_DB, POSTGRES_USER "
              << "and POSTGRES_PASSWORD are required.\n";
    return 0;
  }

  try
  {
    // Arrange
    PostgresDatabase database(PostgresConfig::from_environment());

    // Act
    database.connect();

    // Assert
    VP_EXPECT(database.is_connected(), "database should connect to PostgreSQL");

    // Arrange
    {
      PostgresTransaction transaction(database.connection());
      transaction.work().exec("CREATE TEMP TABLE virtual_planner_postgres_test "
                              "(id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
      transaction.commit();
    }

    // Act
    {
      PostgresTransaction transaction(database.connection());
      transaction.work().exec("INSERT INTO virtual_planner_postgres_test(id, name) "
                              "VALUES (1, 'committed')");
      transaction.commit();
    }

    // Assert
    {
      pqxx::work transaction(database.connection());
      const auto row = transaction.exec(
          "SELECT name FROM virtual_planner_postgres_test WHERE id = 1").one_row();
      VP_EXPECT(row[0].as<std::string>() == "committed",
             "committed row should be visible");
      transaction.commit();
    }

    // Act
    {
      PostgresTransaction transaction(database.connection());
      transaction.work().exec("INSERT INTO virtual_planner_postgres_test(id, name) "
                              "VALUES (2, 'rolled-back')");
      transaction.rollback();
    }

    // Assert
    {
      pqxx::work transaction(database.connection());
      const auto row = transaction.exec(
          "SELECT COUNT(*) FROM virtual_planner_postgres_test WHERE id = 2").one_row();
      VP_EXPECT(row[0].as<int>() == 0, "rolled back row should not be visible");
      transaction.commit();
    }

    // Simula a queda apenas da conexao deste teste, sem parar o banco compartilhado.
    int backend_pid;
    {
      pqxx::work transaction(database.connection());
      backend_pid = transaction.exec("SELECT pg_backend_pid()").one_row()[0].as<int>();
      transaction.commit();
    }
    {
      PostgresDatabase control(PostgresConfig::from_environment());
      control.connect();
      pqxx::work transaction(control.connection());
      const auto terminated = transaction.exec(
          "SELECT pg_terminate_backend($1, 5000)",
          pqxx::params{transaction, backend_pid}).one_row()[0].as<bool>();
      VP_EXPECT(terminated, "the test connection should be terminated");
      transaction.commit();
    }
    const virtual_planner::persistence::Database& health_database = database;
    VP_EXPECT(!health_database.is_connected(),
              "health must detect a connection lost after successful startup");

    database.shutdown();
    VP_EXPECT(!database.is_connected(), "database should be disconnected after shutdown");
  }
  catch (const std::exception &error)
  {
    std::cerr << error.what() << '\n';
    return 1;
  }

  return 0;
}
