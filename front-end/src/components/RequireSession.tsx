import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { ErrorState, LoadingState } from "./ui";
import { currentUser } from "../lib/api/session";

type State = "checking" | "authenticated" | "anonymous" | "unreachable";

// Guarda das rotas do aplicativo.
//
// Pergunta ao servidor quem está logado antes de renderizar qualquer tela. Sem
// isto, um usuário sem sessão veria o dashboard montado e vazio, com 401 no
// console — que foi exatamente o comportamento antes desta peça existir.
//
export function RequireSession({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);

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
  }, [location.pathname, attempt]);

  if (state === "checking") {
    return <LoadingState label="Verificando sessão…" />;
  }

  if (state === "unreachable") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState
          message="Não foi possível verificar sua sessão. Confira se a API está disponível."
          onRetry={() => {
            setState("checking");
            setAttempt((value) => value + 1);
          }}
        />
      </div>
    );
  }

  if (state === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
