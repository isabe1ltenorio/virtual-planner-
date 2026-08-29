# Testes da camada de API.
#
# Este modulo so e incluido quando VIRTUAL_PLANNER_WITH_JSON=ON, porque os
# alvos daqui dependem de nlohmann/json.
virtual_planner_add_test(shared_json_test unit/api/json/shared_json_test.cpp)
target_link_libraries(shared_json_test PRIVATE virtual_planner_json)

virtual_planner_add_test(goal_json_test unit/api/json/goal_json_test.cpp)
target_link_libraries(goal_json_test PRIVATE virtual_planner_json)

virtual_planner_add_test(reminder_json_test unit/api/json/reminder_json_test.cpp)
target_link_libraries(reminder_json_test PRIVATE virtual_planner_json)

virtual_planner_add_test(task_json_test unit/api/json/task_json_test.cpp)
target_link_libraries(task_json_test PRIVATE virtual_planner_json)

# O teste do servidor sobe uma porta de verdade, entao so existe com a
# camada HTTP compilada.
if(VIRTUAL_PLANNER_WITH_HTTP)
  virtual_planner_add_test(api_server_test integration/api/api_server_test.cpp)
  target_link_libraries(api_server_test PRIVATE virtual_planner_http)
  virtual_planner_add_test(
    goal_routes_test
    integration/api/goal_routes_test.cpp
  )
  target_link_libraries(goal_routes_test PRIVATE virtual_planner_http)
endif()
