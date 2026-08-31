# Imagem do backend. Contexto de build e a RAIZ do repositorio, nao back-end/,
# porque o compose precisa do mesmo contexto para os dois servicos.
#
#   docker build -f back-end/Dockerfile .

# --------------------------------------------------------------------------
# Estagio de build
# --------------------------------------------------------------------------
# ubuntu:24.04 e a MESMA base do job postgres-integration do CI. O libpqxx
# 8.x nao compila com o GCC 12 do Debian 12; alinhar com o CI evita
# descobrir divergencia de toolchain so no container.
FROM ubuntu:24.04 AS builder

# git e ca-certificates sao exigidos pelo FetchContent: cpp-httplib vem de um
# clone git e nlohmann/json de um tarball HTTPS verificado por hash.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      cmake \
      git \
      libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# O adapter usa a API libpqxx 8.x (pqxx::params, result::one_row/no_rows), que
# NAO existe no libpqxx-dev que o apt fornece (7.x no Noble). Por isso e
# compilado da fonte,
# fixado na mesma versao do CI e do desenvolvimento local.
ARG LIBPQXX_VERSION=8.0.2
RUN git clone --depth 1 --branch "${LIBPQXX_VERSION}" \
      https://github.com/jtv/libpqxx.git /tmp/libpqxx \
 && cmake -S /tmp/libpqxx -B /tmp/libpqxx/build \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/opt/libpqxx \
      -DBUILD_SHARED_LIBS=ON \
      -DSKIP_BUILD_TEST=ON \
 && cmake --build /tmp/libpqxx/build --parallel \
 && cmake --install /tmp/libpqxx/build \
 && rm -rf /tmp/libpqxx

WORKDIR /src
COPY back-end/ back-end/

# A imagem só precisa do binário do app. Buildar tudo (`cmake --build build`)
# compila também as ~40 binárias de teste, e em máquina pequena (Codespace de
# 2 núcleos) o paralelismo nos TUs pesados de httplib estoura a RAM e o cc1plus
# é morto ("Terminated signal terminated program cc1plus"). --target virtual_planner
# compila só o necessário; --parallel 2 dá a folga de memória.
RUN cmake -S back-end -B build \
      -DCMAKE_BUILD_TYPE=Release \
      -DVIRTUAL_PLANNER_WITH_HTTP=ON \
      -DVIRTUAL_PLANNER_WITH_POSTGRES=ON \
      -DCMAKE_PREFIX_PATH=/opt/libpqxx \
 && cmake --build build --target virtual_planner --parallel 2

# --------------------------------------------------------------------------
# Estagio de runtime
# --------------------------------------------------------------------------
FROM ubuntu:24.04 AS runtime

# libpq5 e a dependencia de runtime do libpqxx; curl serve ao healthcheck do
# compose. Nada de compilador na imagem final.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      libpq5 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/libpqxx/lib/ /usr/local/lib/
RUN ldconfig

COPY --from=builder /src/build/virtual_planner /usr/local/bin/virtual_planner

# Usuario nao-root: o processo so precisa abrir uma porta alta e falar com o
# banco pela rede.
# Sem --system: um uid de sistema precisaria ficar abaixo de SYS_UID_MAX
# (999 no Ubuntu), e o useradd avisa quando os dois se contradizem.
RUN useradd --create-home --uid 10001 virtualplanner
USER virtualplanner

# NENHUMA credencial e embutida na imagem. Host e porta tem padrao porque sao
# topologia do container, nao segredo; tudo de PostgreSQL vem do compose.
ENV VP_HTTP_HOST=0.0.0.0 \
    VP_HTTP_PORT=8080

EXPOSE 8080

CMD ["virtual_planner"]
