/**
 * Identidade visual do Taskly, num lugar só.
 *
 * TROCAR PELA SUA LOGO:
 *  - Logo COMPLETA (símbolo + nome "Taskly" na mesma arte):
 *      substitua  front-end/public/logo.svg  pela sua.
 *      Se for PNG, salve como public/logo.png e troque o src abaixo.
 *      Deixe `wordmark` como está (false) — o nome já vem na imagem.
 *  - Só o SÍMBOLO (sem o nome):
 *      substitua public/logo.svg pelo seu símbolo e use <Brand wordmark />
 *      (aí o texto "Taskly" é desenhado ao lado, na fonte Gilroy).
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
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.svg"
        alt="Taskly"
        style={{ height: size, width: "auto" }}
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
