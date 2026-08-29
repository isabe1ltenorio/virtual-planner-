# Testes do modulo Task. Registre aqui qualquer teste novo de Task.
virtual_planner_add_test(
  date_test
  unit/domain/value_objects/date_test.cpp
)

virtual_planner_add_test(
  time_slot_test
  unit/domain/value_objects/time_slot_test.cpp
)

virtual_planner_add_test(
  task_status_test
  unit/domain/enums/task_status_test.cpp
)

virtual_planner_add_test(
  priority_test
  unit/domain/enums/priority_test.cpp
)

virtual_planner_add_test(
  shift_test
  unit/domain/enums/shift_test.cpp
)

virtual_planner_add_test(
  task_test
  unit/domain/entities/task_test.cpp
)

# Casos de uso da camada de aplicacao (P-20).
virtual_planner_add_test(
  create_task_use_case_test
  unit/application/task/create_task_use_case_test.cpp
)

virtual_planner_add_test(
  get_task_use_case_test
  unit/application/task/get_task_use_case_test.cpp
)

virtual_planner_add_test(
  update_task_use_case_test
  unit/application/task/update_task_use_case_test.cpp
)

virtual_planner_add_test(
  delete_task_use_case_test
  unit/application/task/delete_task_use_case_test.cpp
)

virtual_planner_add_test(
  list_tasks_use_case_test
  unit/application/task/list_tasks_use_case_test.cpp
)

virtual_planner_add_test(
  change_task_status_use_case_test
  unit/application/task/change_task_status_use_case_test.cpp
)

# Deteccao de conflito de horario (P-24).
virtual_planner_add_test(
  task_conflict_service_test
  unit/application/task/task_conflict_service_test.cpp
)
