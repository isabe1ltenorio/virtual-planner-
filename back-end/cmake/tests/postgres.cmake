# Testes de integracao com PostgreSQL.
# Incluido apenas quando VIRTUAL_PLANNER_WITH_POSTGRES=ON.
virtual_planner_add_test(
  postgres_integration_test
  integration/postgres/postgres_integration_test.cpp
)
virtual_planner_add_test(
  postgres_goal_repository_test
  integration/postgres/postgres_goal_repository_test.cpp
)
virtual_planner_add_test(
  postgres_reminder_repository_test
  integration/postgres/postgres_reminder_repository_test.cpp
)
virtual_planner_add_test(
  postgres_task_repository_test
  integration/postgres/postgres_task_repository_test.cpp
)
virtual_planner_add_test(
  postgres_user_repository_test
  integration/postgres/postgres_user_repository_test.cpp
)
