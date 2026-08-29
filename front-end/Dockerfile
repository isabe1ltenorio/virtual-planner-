# Imagem do frontend. Contexto de build e a RAIZ do repositorio, nao
# front-end/, para casar com o contexto usado pelo backend no compose.
#
#   docker build -f front-end/Dockerfile .

# --------------------------------------------------------------------------
# Estagio de build
# --------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# package.json e lock primeiro: enquanto as dependencias nao mudarem, o docker
# reaproveita a camada do npm ci e o rebuild so refaz o bundle.
COPY front-end/package.json front-end/package-lock.json ./
RUN npm ci

COPY front-end/ ./

# O Vite embute as VITE_* em tempo de BUILD, entao a base da API precisa entrar
# aqui e nao como variavel do container. O padrao "/api" e relativo: o bundle
# chama a propria origem e o nginx faz o proxy para o servico `api`. Assim o
# navegador nunca ve duas origens, e o cookie de sessao SameSite=Strict viaja.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# --------------------------------------------------------------------------
# Estagio de runtime
# --------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY front-end/nginx.conf /etc/nginx/conf.d/default.conf

# Sem Node e sem node_modules na imagem final: o que vai para producao e o
# bundle estatico. Nenhuma credencial embutida: a unica VITE_* e a base da API,
# que e um caminho relativo. Tudo com prefixo VITE_ fica visivel no navegador e
# por isso nunca pode ser segredo.
EXPOSE 80
