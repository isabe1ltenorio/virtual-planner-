import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router";
import { login, register } from "../lib/api/authApi";
import { ApiError } from "../lib/api/httpClient";
import { Button, Field } from "../components/ui";
import { Brand } from "../components/Brand";

// A API exige no mínimo 12 caracteres. Validar aqui evita uma ida ao servidor
// para ouvir o óbvio, mas o servidor continua sendo quem decide.
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
      setError(
        `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegistering) {
        await register(form);
      }
      await login({ email: form.email, password: form.password });
      navigate("/");
    } catch (caught) {
      if (caught instanceof ApiError) {
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
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Brand size={38} />
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <h1 className="text-lg font-semibold text-ink">
              {isRegistering ? "Criar conta" : "Entrar"}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {isRegistering
                ? "Leva menos de um minuto."
                : "Bem-vindo de volta."}
            </p>
          </div>

          {isRegistering && (
            <Field label="Nome">
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                autoComplete="name"
                className="input"
              />
            </Field>
          )}

          <Field label="E-mail">
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              className="input"
            />
          </Field>

          <Field
            label="Senha"
            hint={
              isRegistering
                ? `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`
                : undefined
            }
          >
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              className="input"
            />
          </Field>

          {error !== null && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting
              ? "Enviando…"
              : isRegistering
                ? "Criar conta e entrar"
                : "Entrar"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode(isRegistering ? "login" : "register");
              setError(null);
            }}
            className="w-full text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {isRegistering ? "Já tenho conta" : "Ainda não tenho conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
