# Testes do modulo User. Registre aqui qualquer teste novo de User.
#
# Exemplo:
#   virtual_planner_add_test(user_test unit/domain/entities/user_test.cpp)

virtual_planner_add_test(user_test unit/domain/entities/user_test.cpp)

virtual_planner_add_test(get_user_profile_use_case_test
  unit/application/user/get_user_profile_use_case_test.cpp
)
virtual_planner_add_test(update_user_profile_use_case_test
  unit/application/user/update_user_profile_use_case_test.cpp
)