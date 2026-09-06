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

/** Иконка приложения в пуше. Тот же слот, отдельный бокс 38×38. */
export function BankAppIcon() {
  return (
    <span
      data-testid="push-app-icon"
      data-asset-slot="push_app_icon"
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
      style={{
        width: "var(--bank-push-icon)",
        height: "var(--bank-push-icon)",
        /*
         * Форма иконки приложения — суперэллипс, которым система маскирует
         * иконки на домашнем экране и в уведомлениях (HIG, App icons →
         * Icon shape). Скруглённый квадрат читается «поджатым» рядом с
         * настоящими иконками, а баннер стоит поверх домашнего экрана, где
         * сравнивать есть с чем. Контур посчитан под 38 px — размер иконки
         * в баннере (`--bank-push-icon`).
         */
        clipPath: 'path("M38.0 19.0 L38.0 26.5 L37.9 28.9 L37.7 30.6 L37.4 31.9 L37.1 33.1 L36.6 34.0 L36.1 34.8 L35.5 35.5 L34.8 36.1 L34.0 36.6 L33.1 37.1 L31.9 37.4 L30.6 37.7 L28.9 37.9 L26.5 38.0 L19.0 38.0 L11.5 38.0 L9.1 37.9 L7.4 37.7 L6.1 37.4 L4.9 37.1 L4.0 36.6 L3.2 36.1 L2.5 35.5 L1.9 34.8 L1.4 34.0 L0.9 33.1 L0.6 31.9 L0.3 30.6 L0.1 28.9 L0.0 26.5 L0.0 19.0 L0.0 11.5 L0.1 9.1 L0.3 7.4 L0.6 6.1 L0.9 4.9 L1.4 4.0 L1.9 3.2 L2.5 2.5 L3.2 1.9 L4.0 1.4 L4.9 0.9 L6.1 0.6 L7.4 0.3 L9.1 0.1 L11.5 0.0 L19.0 0.0 L26.5 0.0 L28.9 0.1 L30.6 0.3 L31.9 0.6 L33.1 0.9 L34.0 1.4 L34.8 1.9 L35.5 2.5 L36.1 3.2 L36.6 4.0 L37.1 4.9 L37.4 6.1 L37.7 7.4 L37.9 9.1 L38.0 11.5 Z")',
        background: "var(--bank-primary)",
        color: "var(--bank-on-primary)",
        fontSize: "22px",
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      o
    </span>
  );
}
