import { useEffect, useState } from "react";

// O chamador estabiliza load com useCallback quando há filtros. Respostas de
// uma seleção anterior são descartadas, inclusive após sair da página.
export function useApiResource<T>(load: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    load: () => Promise<T>;
    version: number;
    data?: T;
    error?: string;
  }>();

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setResult({ load, version, data });
      },
      (error: unknown) => {
        if (active)
          setResult({
            load,
            version,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível carregar os dados.",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [load, version]);

  const isLoading = result?.load !== load || result?.version !== version;
  return {
    data: isLoading ? undefined : result?.data,
    error: isLoading ? undefined : result?.error,
    isLoading,
    retry: () => setVersion((value) => value + 1),
  };
}
