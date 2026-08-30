/**
 * Identidade visual do Taskly, num lugar só.
 *
 * TROCAR PELA SUA LOGO:
 *  - Tema claro:  front-end/public/logo.svg
 *  - Tema escuro: front-end/public/logo-tema-escuro.svg  (versão com o texto
 *    claro; a troca é automática pela classe .dark no <html>)
 *  Se for PNG, salve como .png e ajuste os src abaixo.
 *  `wordmark` false = o nome já vem na imagem. true = desenha "Taskly" ao lado
 *  (útil se sua logo for só o símbolo).
 *
 * `size` = altura da logo em px; a largura se ajusta sozinha.
 */
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
