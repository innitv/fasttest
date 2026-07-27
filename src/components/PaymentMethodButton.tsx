import { methodAccessibleName } from "@demo/content/copy";
import type { PaymentMethod } from "@demo/theme/tenant.schema";
import { CheckGlyph, NeutralPlate } from "./primitives";

interface Props {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Кнопка способа оплаты — вертикальный столбик архетипа B.
 *
 * Ширина FILL, высота из `density.method_button_height`. Содержимое по центру:
 * либо логотип, либо текстовая метка, но не оба (донорское поведение,
 * совпадает с правилом `05-copy` №5).
 *
 * Выбор (`row_press`): заливка brand.tonal, обводка brand.primary,
 * слева появляется галка — второй канал состояния помимо цвета.
 *
 * Метка и галка выбранной строки берут цвет у САМОЙ подложки
 * (`--t-brand-tonal-on` / `--t-brand-tonal-marker`), а не у страницы:
 * подложка может быть задана донором и оказаться темнее или светлее фона
 * (у VOROH она инвертирует фон в обеих темах). Текст страницы поверх такой
 * заливки нечитаем.
 *
 * Обводка (покой / выбор / наведение) задана в `styles.css` по `data-selected`,
 * а не inline: только так :hover переопределяет box-shadow (inline-стиль внешним
 * правилом не перекрыть). Наведение мышью красит обводку тёмно-серым, не брендом.
 */
export function PaymentMethodButton({ method, selected, onSelect }: Props) {
  /*
   * Ограничение компонента: метка и логотип не показываются одновременно.
   * Пока ассетов нет, все способы оплаты заданы как `logo: "none"` —
   * текстовые плашки. Правило вступит в силу при привязке настоящих ассетов.
   */
  const showLabel = method.logo !== "slot";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={methodAccessibleName(method.label, selected)}
      data-testid={`payment-method-button-${method.id}`}
      data-selected={selected}
      onClick={() => onSelect(method.id)}
      className="relative flex w-full items-center justify-center"
      style={{
        height: "var(--t-method-button-height)",
        borderRadius: "var(--t-radius-control)",
        background: selected ? "var(--t-brand-tonal)" : "var(--t-surface-card)",
        border: "none",
        // box-shadow (обводка покоя/выбора/наведения) — в styles.css по
        // data-selected; здесь его нет намеренно, иначе :hover не переопределить.
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute flex items-center"
          style={{
            left: "var(--t-page-padding)",
            color: "var(--t-brand-tonal-marker)",
          }}
        >
          <CheckGlyph size={20} />
        </span>
      )}

      {showLabel ? (
        <span
          aria-hidden="true"
          style={{
            fontSize: "var(--t-font-body)",
            fontWeight: 600,
            color: selected ? "var(--t-brand-tonal-on)" : "var(--t-text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {method.label}
        </span>
      ) : (
        <NeutralPlate width="72px" />
      )}
    </button>
  );
}
