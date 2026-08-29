# Fontes da camada de aplicacao (casos de uso), agrupadas por modulo de dominio.

# Goal
virtual_planner_add_sources(
  application/goal/create_goal_use_case.cpp
  application/goal/get_goal_use_case.cpp
  application/goal/update_goal_use_case.cpp
  application/goal/delete_goal_use_case.cpp
  application/goal/list_goals_use_case.cpp
  application/goal/change_goal_status_use_case.cpp
)

# Task
virtual_planner_add_sources(
  application/task/create_task_use_case.cpp
  application/task/update_task_use_case.cpp
  application/task/delete_task_use_case.cpp
  application/task/list_tasks_use_case.cpp
  application/task/change_task_status_use_case.cpp
)

# Reminder
virtual_planner_add_sources(
  application/reminder/create_reminder_use_case.cpp
  application/reminder/delete_reminder_use_case.cpp
  application/reminder/list_reminders_use_case.cpp
  application/reminder/update_reminder_use_case.cpp
)

# User
# virtual_planner_add_sources(application/user/...)

# Reporting
virtual_planner_add_sources(
  application/reporting/reporting_service.cpp
)