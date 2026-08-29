import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router";
import { login, register } from "../lib/api/authApi";
import { ApiError } from "../lib/api/httpClient";

// A API exige no mínimo 12 caracteres. Validar aqui evita uma ida ao servidor
// para ouvir o óbvio, mas o servidor continua sendo quem decide — a checagem
// do cliente é conveniência, nunca a garantia.
const MIN_PASSWORD_LENGTH = 12;

type Mode = "login" | "register";

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const isRegistering = mode === "register";

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegistering) {
        await register(form);
      }

      // Registrar não abre sessão: o login é sempre um passo próprio.
      await login({ email: form.email, password: form.password });
      navigate("/");
    } catch (caught) {
      if (caught instanceof ApiError) {
        // A API responde a mesma coisa para e-mail inexistente e senha errada,
        // de propósito — repetir isso aqui evita entregar quem tem conta.
        setError(
          caught.code === "invalid_credentials"
            ? "E-mail ou senha incorretos."
            : caught.message,
        );
      } else {
        setError("Não foi possível falar com a API.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-purple-600/30">
            V
          </div>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white">
              Virtual Planner
            </h1>
            <p className="text-xs text-purple-500">Painel Integrado</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isRegistering ? "Criar conta" : "Entrar"}
          </h2>

          {isRegistering && (
            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                NOME
              </span>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                autoComplete="name"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              E-MAIL
            </span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              SENHA
            </span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
            />
            {isRegistering && (
              <span className="mt-1 block text-xs text-slate-400">
                Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
              </span>
            )}
          </label>

          {error !== null && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
          >
            {isSubmitting
              ? "Enviando..."
              : isRegistering
                ? "Criar conta e entrar"
                : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(isRegistering ? "login" : "register");
              setError(null);
            }}
            className="w-full text-sm text-purple-500 hover:underline"
          >
            {isRegistering
              ? "Já tenho conta"
              : "Ainda não tenho conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
