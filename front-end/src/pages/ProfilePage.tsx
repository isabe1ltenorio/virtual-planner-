import { useRef, useState, type FormEvent } from "react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { ApiError } from "../lib/api/httpClient";
import type { User } from "../types/domain";
import { useApiResource } from "../hooks/useApiResource";
import {
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";

export function ProfilePage() {
  const resource = useApiResource(virtualPlannerApi.getProfile);
  return (
    <>
      <PageHeader
        title="Perfil"
        subtitle="Consulte e atualize seu nome e e-mail."
      />
      {resource.isLoading ? (
        <LoadingState label="Carregando perfil…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : (
        resource.data && <ProfileForm initial={resource.data} />
      )}
    </>
  );
}

function ProfileForm({ initial }: { initial: User }) {
  const [user, setUser] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setSaved(false);
    setError(undefined);
    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const updated = await virtualPlannerApi.updateProfile({ name, email });
      setUser(updated);
      setName(updated.name);
      setEmail(updated.email);
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.code === "conflict"
          ? "Esse e-mail já está em uso."
          : reason instanceof Error
            ? reason.message
            : "Não foi possível salvar o perfil.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-3xl font-semibold text-white">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="text-lg font-semibold text-ink">{user.name}</p>
          <p className="break-all text-sm text-muted">{user.email}</p>
        </div>
      </Card>
      <Card className="p-6 lg:col-span-2">
        <form onSubmit={submit}>
          <fieldset disabled={saving} className="space-y-5">
            <Field label="Nome">
              <input
                className="input"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </Field>
            <Field
              label="E-mail"
              hint="Ao trocar o e-mail, use o novo endereço no próximo login. Sua senha continua a mesma."
            >
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </Field>
            {error && <ErrorState message={error} />}
            {saved && (
              <p role="status" className="text-sm text-ink">
                Perfil atualizado.
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </fieldset>
        </form>
      </Card>
    </div>
  );
}
