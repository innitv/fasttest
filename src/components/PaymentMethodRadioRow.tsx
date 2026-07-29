import { methodAccessibleName } from "@demo/content/copy";
import type { PaymentMethod } from "@demo/theme/tenant.schema";

interface Props {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Строка способа оплаты с кружком выбора — раскладка `radio_rows`.
 *
 * У донора-минималиста выбор оплаты весит ровно столько же, сколько строка
 * адреса: ни рамки, ни заливки, ни центрирования. Плашка-кнопка на такой
 * странице читается как чужой элемент, поэтому раскладка вынесена отдельной
 * осью, а не подобрана из двух прежних.
 *
 * Зона нажатия остаётся 44 px: у донора строка ниже, но порог зоны нажатия —
 * наше правило, и оно сохраняется на любой теме (визуально это только
 * увеличивает вертикальный воздух вокруг подписи).
 */
export function PaymentMethodRadioRow({ method, selected, onSelect }: Props) {
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
        minHeight: "var(--k-tap-min)",
        gap: "12px",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center"
        style={{
          width: "18px",
          height: "18px",
          flexShrink: 0,
          borderRadius: "999px",
          border: `var(--t-border-width) solid ${
            selected ? "var(--t-brand-primary)" : "var(--t-surface-border)"
          }`,
        }}
      >
        {/* Точка внутри кольца — второй канал состояния помимо цвета обводки. */}
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
