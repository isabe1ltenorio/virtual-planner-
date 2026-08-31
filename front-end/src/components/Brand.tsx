export function Brand({
  size = 30,
  wordmark = false,
  className = "",
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
}) {
  const imgStyle = { height: size, width: "auto" as const };

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.svg"
        alt="Taskly"
        style={imgStyle}
        className="block dark:hidden"
      />
      <img
        src="/logo-tema-escuro.svg"
        alt="Taskly"
        style={imgStyle}
        className="hidden dark:block"
        onError={(e) => {
          // Sem o arquivo do tema escuro, cai na logo clara em vez de quebrar.
          e.currentTarget.src = "/logo.svg";
        }}
      />
      {wordmark && (
        <span
          className="font-bold tracking-tight text-ink"
          style={{ fontSize: size * 0.62 }}
        >
          Taskly
        </span>
      )}
    </span>
  );
}
