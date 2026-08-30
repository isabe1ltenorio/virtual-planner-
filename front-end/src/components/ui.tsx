import {
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { buttonClass, type ButtonVariant } from "./buttonStyles";

/* -------------------------------------------------------------------------- */
/*  Button                                                                    */
/* -------------------------------------------------------------------------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button className={`${buttonClass(variant)} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Badge                                                                     */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  color,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  if (color) {
    return (
      <span
        className={`badge ${className}`}
        style={{
          color,
          backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {children}
      </span>
    );
  }
  return (
    <span
      className={`badge bg-surface-2 text-muted ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page header                                                               */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  FormPage — cabeçalho + voltar + card para telas de formulário             */
/* -------------------------------------------------------------------------- */

export function FormPage({
  title,
  backLink,
  children,
}: {
  title: string;
  backLink?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">{title}</h1>
        {backLink}
      </div>
      <div className="card p-6">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Field                                                                     */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                               */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon && <div className="text-subtle">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Loading                                                                   */
/* -------------------------------------------------------------------------- */

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {label}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stat card                                                                 */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <div className="stat-value mt-2 text-2xl font-semibold text-ink">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  DangerConfirm — substitui window.confirm por confirmação inline           */
/* -------------------------------------------------------------------------- */

export function DangerConfirm({
  onConfirm,
  label = "Excluir",
  confirmLabel = "Confirmar exclusão",
  icon,
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  icon?: ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setArmed(false)}
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-ghost text-muted"
      onClick={() => setArmed(true)}
    >
      {icon}
      {label}
    </button>
  );
}
