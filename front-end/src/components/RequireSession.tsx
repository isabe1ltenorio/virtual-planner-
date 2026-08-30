import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { currentUser } from "../lib/api/session";

type State = "checking" | "authenticated" | "anonymous" | "unreachable";

// Guarda das rotas do aplicativo.
//
// Pergunta ao servidor quem está logado antes de renderizar qualquer tela. Sem
// isto, um usuário sem sessão veria o dashboard montado e vazio, com 401 no
// console — que foi exatamente o comportamento antes desta peça existir.
//
// Com os mocks (`VITE_API_URL` ausente) `currentUser` devolve um usuário
// fictício, então nada disso atrapalha quem desenvolve sem backend.
export function RequireSession({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const location = useLocation();

  useEffect(() => {
    let active = true;

    currentUser()
      .then((user) => {
        if (!active) return;
        setState(user === null ? "anonymous" : "authenticated");
      })
      .catch(() => {
        // Falha de rede não é logout: mandar para o login esconderia que o
        // backend está fora do ar, e a pessoa tentaria entrar em looping.
        if (active) setState("unreachable");
      });

    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-bg text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        Carregando…
      </div>
    );
  }

  if (state === "unreachable") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="max-w-md text-center">
          <p className="font-semibold text-ink">A API não respondeu.</p>
          <p className="mt-2 text-sm text-muted">
            O backend está rodando em <code>127.0.0.1:8080</code>? Para
            trabalhar sem ele, comente <code>VITE_API_URL</code> em{" "}
            <code>front-end/.env.development</code> e as telas voltam aos mocks.
          </p>
        </div>
      </div>
    );
  }

  if (state === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
