/**
 * Фирменный знак A3 Pay, собирающийся на глазах.
 *
 * Геометрия и раскраска перенесены из брендового репозитория A3 Pay
 * (`a3brand`, `src/brand/mark.tsx`): viewBox 282×188, знак разрезан на
 * ЧАСТИ, а не замаскирован поверх целого — левая опора, правая опора с
 * телом буквы, перекладина и три луча. Куски именно такие: у соседних путей
 * одного цвета нет общей кромки, поэтому на стыках не проступают швы.
 *
 * Хореография (порядок и паузы) живёт в `styles.css` — движение в этом
 * проекте задаёт общий слой, а компонент только вешает классы.
 *
 * Каждый кусок — свой слой поверх остальных, потому что `clip-path`
 * применяется к элементу целиком: внутри одного SVG раскрыть части
 * по отдельности нечем.
 */

const VIEW_BOX = "0 0 282 188";

/** Части знака и их цвета на кобальте (палитра `onCobalt` бренда). */
const PIECES: Array<{ cls: string; d: string; fill: string }> = [
  {
    cls: "a3-mark-bar",
    d: "M 85 125 L 140 125 L 156 167.5 L 85 167.5 Z",
    fill: "#CDDBF0",
  },
  {
    cls: "a3-mark-right",
    d: "M 116.5 0 L 132.5 0 L 202 188 L 156 188 L 101 41 Z",
    fill: "#CDDBF0",
  },
  { cls: "a3-mark-beam-1", d: "M 186 47 L 158 47 L 211 188 L 239 188 Z", fill: "#9BB7E1" },
  { cls: "a3-mark-beam-2", d: "M 227 90 L 210 90 L 246.5 188 L 264 188 Z", fill: "#6892D1" },
  { cls: "a3-mark-beam-3", d: "M 257 120 L 246 120 L 272 188 L 282 188 Z", fill: "#2C67BF" },
  { cls: "a3-mark-left", d: "M 116.5 0 L 70.5 0 L 0 188 L 46 188 Z", fill: "#FFFFFF" },
];

export function BrandMarkAssembly({ width }: { width: number }) {
  const height = Math.round((width * 188) / 282);

  return (
    <span
      data-testid="brand-mark"
      aria-hidden="true"
      className="relative block"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {PIECES.map((piece) => (
        <svg
          key={piece.cls}
          className={`a3-mark-piece ${piece.cls} absolute inset-0`}
          width={width}
          height={height}
          viewBox={VIEW_BOX}
          fill="none"
        >
          <path d={piece.d} fill={piece.fill} />
        </svg>
      ))}
    </span>
  );
}
