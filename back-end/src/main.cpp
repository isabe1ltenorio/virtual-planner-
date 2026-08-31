// Composition root da aplicacao.
//
// Este arquivo e o unico lugar que escolhe implementacoes concretas: qual
// repositorio (in-memory ou PostgreSQL), qual banco e com que configuracao o
// servidor HTTP sobe. Nenhuma camada abaixo conhece essa decisao.

#include "virtual_planner/infrastructure/config/environment_config_loader.hpp"
#include "virtual_planner/infrastructure/logging/console_logger.hpp"
#include "virtual_planner/persistence/database.hpp"
#include "virtual_planner/persistence/memory/repositories.hpp"
#include "virtual_planner/persistence/repository_set.hpp"
#include "virtual_planner/shared/errors.hpp"

#if defined(VIRTUAL_PLANNER_WITH_HTTP)
#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/http/routes/auth_routes.hpp"
#include "virtual_planner/api/http/routes/reporting_routes.hpp"
#include "virtual_planner/api/http/routes/reminder_routes.hpp"
#include "virtual_planner/api/http/server_config.hpp"
#include "virtual_planner/api/http/routes/goal_routes.hpp"
#include "virtual_planner/api/http/routes/task_routes.hpp"
#include "virtual_planner/api/http/routes/user_routes.hpp"

#endif

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)
#include "virtual_planner/infrastructure/postgres/postgres_config.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_goal_repository.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_reminder_repository.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_task_repository.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_user_repository.hpp"

#include <optional>
#endif

#include <cstdlib>
#include <iostream>
#include <string>

namespace
{

  bool postgres_enabled()
  {
    const char *value = std::getenv("VP_USE_POSTGRES");
    return value != nullptr && std::string(value) == "true";
  }

}

int main() {
  try
  {
    const virtual_planner::infrastructure::config::EnvironmentConfigLoader loader;
    const auto config = loader.load();

    virtual_planner::infrastructure::logging::ConsoleLogger logger(
        virtual_planner::infrastructure::logging::ConsoleLogger::level_from_environment());

    logger.info(
        "starting",
        "app=" + config.app_name() + " profile=" +
            std::string{virtual_planner::core::to_string(config.profile())} +
            " log_level=" +
            std::string{virtual_planner::interfaces::to_string(logger.minimum())});

    // In-memory e o padrao; com PostgreSQL todos os repositorios sao trocados
    // pelos respectivos adapters abaixo.
    virtual_planner::persistence::InMemoryGoalRepository memory_goals;
    virtual_planner::persistence::InMemoryTaskRepository memory_tasks;
    virtual_planner::persistence::InMemoryReminderRepository memory_reminders;
    virtual_planner::persistence::InMemoryUserRepository memory_users;

    [[maybe_unused]] virtual_planner::persistence::RepositorySet repositories{
        &memory_goals, &memory_tasks, &memory_reminders, &memory_users};

    // Nulo quando a aplicacao roda sem banco: /api/health reporta isso em vez
    // de fingir que ha um banco saudavel.
    [[maybe_unused]] const virtual_planner::persistence::Database *health_database = nullptr;

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)
    // std::optional porque o banco e os repositorios so existem quando
    // VP_USE_POSTGRES=true, mas precisam viver ate o fim do main: o
    // RepositorySet guarda ponteiros para eles.
    std::optional<virtual_planner::infrastructure::postgres::PostgresDatabase> database;
    std::optional<virtual_planner::infrastructure::postgres::PostgresGoalRepository> postgres_goals;
    std::optional<virtual_planner::infrastructure::postgres::PostgresReminderRepository> postgres_reminders;
    std::optional<virtual_planner::infrastructure::postgres::PostgresTaskRepository> postgres_tasks;
    std::optional<virtual_planner::infrastructure::postgres::PostgresUserRepository> postgres_users;


    if (postgres_enabled())
    {
      database.emplace(
          virtual_planner::infrastructure::postgres::PostgresConfig::from_environment());
      database->connect();
      logger.info("postgres connected");

      postgres_goals.emplace(*database);
      postgres_reminders.emplace(*database);
      postgres_tasks.emplace(*database);
      postgres_users.emplace(*database);

      repositories.goals = &*postgres_goals;
      repositories.reminders = &*postgres_reminders;
      repositories.tasks = &*postgres_tasks;
      repositories.users = &*postgres_users;
      health_database = &*database;
      
    }
#else
    if (postgres_enabled())
    {
      logger.error("PostgreSQL support was not compiled. Rebuild with "
                   "-DVIRTUAL_PLANNER_WITH_POSTGRES=ON");
      return 1;
    }
#endif

#if defined(VIRTUAL_PLANNER_WITH_HTTP)
    const auto server_config =
        virtual_planner::api::http::ServerConfig::from_environment();

    virtual_planner::api::http::ApiServer server(
        config, repositories, health_database, logger, server_config);

    virtual_planner::api::http::register_auth_routes(server);
    virtual_planner::api::http::register_reporting_routes(server);
    virtual_planner::api::http::register_reminder_routes(server);
    virtual_planner::api::http::register_goal_routes(server);
    virtual_planner::api::http::register_task_routes(server);
    virtual_planner::api::http::register_user_routes(server);

    const int port = server.bind(server_config);

    if (port < 0)
    {
      logger.error("failed to bind",
                   "host=" + server_config.host + " port=" +
                       std::to_string(server_config.port));
      return 1;
    }

    logger.info("serving",
                "host=" + server_config.host + " port=" + std::to_string(port) +
                    " health=/api/health");

    if (!server.serve())
    {
      logger.error("HTTP server stopped with an error");
      return 1;
    }
#else
    logger.info("HTTP server was not compiled. Rebuild with "
                "-DVIRTUAL_PLANNER_WITH_HTTP=ON to serve /api/health");
#endif

    return 0;
  }
  catch (const virtual_planner::shared::ApplicationError &error)
  {
    // As mensagens de PostgresConfig ja vem com a senha mascarada. Aqui
    // ainda pode nao haver logger construido, entao vai direto no stderr.
    std::cerr << "Startup failed: " << error.what() << '\n';
    return 1;
  }
}
