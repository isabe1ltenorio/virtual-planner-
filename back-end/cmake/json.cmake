# Serializacao JSON compartilhada (issue #30 / P-29.0).
#
# Depende de nlohmann/json (MIT, header-only), a biblioteca escolhida na
# ADR-003. Fica em uma opcao propria porque as serializacoes de entidade
# (P-29.1 a P-29.4) precisam de JSON, mas nao do servidor HTTP; ligar
# VIRTUAL_PLANNER_WITH_HTTP ja liga esta opcao (ver CMakeLists.txt).
#
# OFF por padrao para que o build sem rede continue funcionando: com
# VIRTUAL_PLANNER_WITH_JSON=OFF nenhum FetchContent_Declare e avaliado e
# nenhum download e tentado.

if(VIRTUAL_PLANNER_WITH_JSON)
  include(FetchContent)

  set(JSON_BuildTests OFF CACHE INTERNAL "")

  # O clone git de nlohmann/json ocupa ~195 MB porque traz testes e dados de
  # benchmark. O tarball da release tem 112 KiB, ja contem o CMakeLists que
  # exporta nlohmann_json::nlohmann_json e e verificavel por hash.
  FetchContent_Declare(nlohmann_json
    URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz
    URL_HASH SHA256=42f6e95cad6ec532fd372391373363b62a14af6d771056dbfc86160e6dfff7aa
    # Sem isto o CMake avisa sobre a CMP0135 a cada configure: os arquivos
    # extraidos herdariam o timestamp do tarball em vez do da extracao.
    DOWNLOAD_EXTRACT_TIMESTAMP FALSE
  )

  FetchContent_MakeAvailable(nlohmann_json)

  # Biblioteca separada de virtual_planner_core: o nucleo continua compilando
  # sem nenhuma dependencia externa, e so quem serializa paga o custo de
  # nlohmann.
  add_library(virtual_planner_json
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/json/shared_json.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/json/goal_json.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/json/reminder_json.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/json/task_json.cpp
    ${VIRTUAL_PLANNER_SOURCE_DIR}/api/json/user_json.cpp
  )

  target_link_libraries(virtual_planner_json
    PUBLIC
      virtual_planner_core
      nlohmann_json::nlohmann_json
  )

  virtual_planner_enable_warnings(virtual_planner_json)
endif()
