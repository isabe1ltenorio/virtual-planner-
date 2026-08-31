import {
  useState,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type SelectHTMLAttributes,
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
        className={`badge text-ink ${className}`}
        style={{
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
    <span className={`badge bg-surface-2 text-muted ${className}`}>
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
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-muted"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <p>{message}</p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${className}`} {...props} />;
}

export function Table({
  caption,
  headings,
  children,
}: {
  caption: string;
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th
                key={heading}
                scope="col"
                className="border-b border-border-c px-3 py-2 font-medium text-muted"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-c">{children}</tbody>
      </table>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-border-c bg-surface p-6 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id={titleId} className="font-semibold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </Button>
      </div>
      {children}
    </dialog>
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
  disabled = false,
  description = "Essa ação não pode ser desfeita.",
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  icon?: ReactNode;
  disabled?: boolean;
  description?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => setArmed(true)}
      >
        {icon}
        {label}
      </Button>
      <Modal open={armed} title={confirmLabel} onClose={() => setArmed(false)}>
        <p className="text-sm text-muted">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={disabled}
            onClick={() => {
              setArmed(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
