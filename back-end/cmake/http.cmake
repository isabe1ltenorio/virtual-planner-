# Camada HTTP e sua dependencia (issue #29 / P-28).
#
# A biblioteca e cpp-httplib (MIT, header-only), decidida na ADR-003
# (issue #13 / P-27). O JSON vem de cmake/json.cmake, incluido antes deste
# modulo.
#
# A opcao VIRTUAL_PLANNER_WITH_HTTP e declarada em CMakeLists.txt, junto das
# demais, e esta desligada por padrao para que o build sem rede continue
# funcionando: com ela OFF nenhum FetchContent_Declare e avaliado e nenhum
# download e tentado.

if(VIRTUAL_PLANNER_WITH_HTTP)
  include(FetchContent)
  find_package(OpenSSL REQUIRED COMPONENTS Crypto)

  # O servidor nao usa TLS nem compressao; desligar evita exigir OpenSSL,
  # zlib e Brotli instalados na maquina.
  set(HTTPLIB_REQUIRE_OPENSSL OFF CACHE BOOL "" FORCE)
  set(HTTPLIB_REQUIRE_ZLIB OFF CACHE BOOL "" FORCE)
  set(HTTPLIB_REQUIRE_BROTLI OFF CACHE BOOL "" FORCE)

  FetchContent_Declare(httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.53.1
    GIT_SHALLOW TRUE
  )

  FetchContent_MakeAvailable(httplib)

  # Biblioteca separada de virtual_planner_core: o nucleo continua compilando
  # sem nenhuma dependencia externa.
  add_library(virtual_planner_http
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/server_config.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/api_server.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/error_response.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/session_store.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/routes/auth_routes.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/routes/reporting_routes.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/routes/reminder_routes.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/routes/goal_routes.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/http/routes/task_routes.cpp
  )

  target_link_libraries(virtual_planner_http
    PUBLIC
      virtual_planner_json
      httplib::httplib
      OpenSSL::Crypto
  )

  # PUBLIC para que main.cpp e os testes vejam o macro e compilem o caminho
  # com servidor, do mesmo jeito que postgres.cmake faz com o adapter.
  target_compile_definitions(virtual_planner_http PUBLIC VIRTUAL_PLANNER_WITH_HTTP)

  virtual_planner_enable_warnings(virtual_planner_http)
endif()
