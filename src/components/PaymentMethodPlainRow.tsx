import { methodAccessibleName } from "@demo/content/copy";
import type { PaymentMethod } from "@demo/theme/tenant.schema";

interface Props {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Строка способа оплаты БЕЗ рамки — раскладка `plain_rows` (донор Bombbar).
 *
 * Отличие от `radio_rows` не в отступах: там кружок выбора залит целиком, а
 * здесь это КОЛЬЦО с точкой внутри, и рамку вокруг строки несёт карточка
 * секции. Своя рамка нарисовала бы вторую границу внутри первой, а залитый
 * кружок на жёлтом бренде донора превращается в пятно без центра.
 *
 * Зона нажатия 44 px сохраняется: у донора строка ниже, но порог попадания
 * пальцем — наше правило и перебивает донора намеренно.
 */
export function PaymentMethodPlainRow({ method, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={methodAccessibleName(method.label, selected)}
      data-testid={`payment-method-row-${method.id}`}
      data-selected={selected}
      onClick={() => onSelect(method.id)}
      className="flex w-full items-center text-left"
      style={{
        minHeight: "44px",
        gap: "12px",
        padding: 0,
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center"
        style={{
          width: "20px",
          height: "20px",
          flexShrink: 0,
          borderRadius: "999px",
          background: "transparent",
          border: selected
            ? `2px solid var(--t-brand-primary)`
            : `var(--t-border-width) solid var(--t-surface-border)`,
        }}
      >
        {selected && (
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: "var(--t-brand-primary)",
            }}
          />
        )}
      </span>

      <span
        className="min-w-0 flex-1"
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: 400,
          color: "var(--t-text-primary)",
        }}
      >
        {method.label}
      </span>
    </button>
  );
}
