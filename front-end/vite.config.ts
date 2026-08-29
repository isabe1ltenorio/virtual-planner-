import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O alvo do proxy de desenvolvimento. Sobrescreva com VP_API_TARGET quando o
// backend não estiver em 127.0.0.1:8080.
const apiTarget = process.env.VP_API_TARGET ?? 'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy de /api para o backend, espelhando o que o nginx faz em produção
    // (front-end/nginx.conf). Não é conveniência: é o que faz a sessão
    // funcionar.
    //
    // O cookie de sessão é SameSite=Strict, então o navegador só o envia em
    // requisição do MESMO site. Chamando http://127.0.0.1:8080 a partir de
    // http://localhost:5173 o cookie simplesmente não viaja — e toda chamada
    // volta 401, mesmo depois de um login bem-sucedido. Com o proxy, o
    // navegador vê uma origem só e o cookie acompanha.
    //
    // Por isso o valor recomendado em desenvolvimento é VITE_API_URL=/api, e
    // não a URL absoluta do backend.
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
