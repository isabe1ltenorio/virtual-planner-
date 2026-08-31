# Fontes do adapter PostgreSQL (somente com VIRTUAL_PLANNER_WITH_POSTGRES=ON).
virtual_planner_add_sources(
  infrastructure/postgres/postgres_database.cpp
  infrastructure/postgres/postgres_transaction.cpp
  infrastructure/postgres/postgres_goal_repository.cpp
  infrastructure/postgres/postgres_reminder_repository.cpp
  infrastructure/postgres/postgres_task_repository.cpp
  infrastructure/postgres/postgres_user_repository.cpp
)
