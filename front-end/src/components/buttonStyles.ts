export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

export function buttonClass(variant: ButtonVariant = "primary"): string {
  const map: Record<ButtonVariant, string> = {
    primary: "btn btn-primary",
    outline: "btn btn-outline",
    ghost: "btn btn-ghost",
    danger: "btn btn-danger",
  };
  return map[variant];
}
