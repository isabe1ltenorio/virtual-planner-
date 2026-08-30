/**
 * Identidade visual do Taskly, num lugar só.
 *
 * Para trocar por uma logo sua:
 *  - marca (quadradinho): substitua o arquivo  front-end/public/logo.svg
 *  - lockup inteiro (marca + nome): use <Brand wordmark={false} /> e coloque
 *    a arte completa em public/logo.svg (pode ser .svg ou .png; ajuste o src)
 *
 * `size` controla a altura da marca em px. O nome "Taskly" é texto HTML
 * (fonte Gilroy), então fica nítido em qualquer tela.
 */
export function Brand({
  size = 32,
  wordmark = true,
  className = "",
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.svg"
        alt="Taskly"
        width={size}
        height={size}
        style={{ height: size, width: "auto" }}
      />
      {wordmark && (
        <span
          className="font-bold tracking-tight text-ink"
          style={{ fontSize: size * 0.6 }}
        >
          Taskly
        </span>
      )}
    </span>
  );
}
