import { COPY } from "@demo/content/copy";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  СЛОТ ГРАФИЧЕСКОГО АССЕТА — единственное место двойной нормы написания
 *
 *  В любом пользовательском ТЕКСТЕ бренд пишется «Ozon Банк»; строчное
 *  «ozon банк» существует только внутри этого компонента, потому что это
 *  не текстовый узел, а слот логотипа.
 *
 *  Проверка `E_OZON_LABEL` обходит его ПО РОЛИ УЗЛА — по тому, что это
 *  компонент-слот, — а не по исключению для подстроки. Иначе исключение
 *  начало бы пропускать опечатки в обычном тексте.
 *
 *  Графика `aria-hidden`; рядом лежит визуально скрытая метка «Ozon Банк».
 *  Ассет `blocked`: пока SVG нет, слот рендерит текст с измеренными
 *  метриками в фиксированном боксе — замена не сдвигает раскладку.
 *
 *  Токенов темы подрядчика здесь нет и быть не может.
 * ═══════════════════════════════════════════════════════════════════════
 */

type Variant = "splash" | "compact" | "micro";

interface Props {
  variant: Variant;
  /** Цвет начертания; по умолчанию наследуется. */
  color?: string;
}

export function BankWordmark({ variant, color = "currentColor" }: Props) {
  if (variant === "splash") {
    return (
      <span
        data-testid="bank-wordmark"
        data-variant="splash"
        data-asset-slot="bank_wordmark_splash"
        className="flex flex-col items-center"
        style={{ width: "var(--bank-wordmark-w)", color }}
      >
        <span className="sr-only">{COPY["a11y.bank_logo"]}</span>
        <span
          aria-hidden="true"
          className="flex flex-col items-center"
          style={{
            fontSize: "var(--bank-wordmark-size)",
            fontWeight: 800,
            lineHeight: "var(--bank-wordmark-lh)",
            letterSpacing: "-0.02em",
          }}
        >
          <span>ozon</span>
          <span>банк</span>
        </span>
      </span>
    );
  }

  const height = variant === "compact" ? 16 : 13;

  return (
    <span
      data-testid="bank-wordmark"
      data-variant={variant}
      data-asset-slot={
        variant === "compact" ? "bank_wordmark_compact" : "bank_wordmark_micro"
      }
      className="inline-flex items-center"
      style={{ color, height: `${height + 4}px` }}
    >
      <span className="sr-only">{COPY["a11y.bank_logo"]}</span>
      <span
        aria-hidden="true"
        style={{
          fontSize: `${height}px`,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        ozon банк
      </span>
    </span>
  );
}

/**
 * Иконка приложения в пуше — НАСТОЯЩИЙ знак банка (ассет владельца,
 * `public/bank/app-icon.svg`), а не монограмма. Она стоит рядом с иконками
 * домашнего экрана, и буква на плашке читалась заглушкой.
 *
 * Форма и фон — внутри самого файла (там squircle и фирменный синий),
 * поэтому здесь только бокс 38×38 из токена банка.
 */
export function BankAppIcon() {
  return (
    <img
      data-testid="push-app-icon"
      data-asset-slot="push_app_icon"
      alt=""
      aria-hidden="true"
      src="/bank/app-icon.svg"
      width={38}
      height={38}
      className="shrink-0"
      style={{
        width: "var(--bank-push-icon)",
        height: "var(--bank-push-icon)",
        display: "block",
      }}
    />
  );
}
