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
        // Рамку несёт ОБЁРТКА метода, а не сама строка: при выборе «Ozon Банк»
        // внутрь той же карточки въезжает поле телефона, и карточка обязана
        // охватывать оба элемента — иначе поле висит отдельной историей.
        minHeight: "58px",
        gap: "20px",
        paddingInline: "20px",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center"
        style={{
          width: "15px",
          height: "15px",
          flexShrink: 0,
          borderRadius: "999px",
          // Выбранный кружок у донора залит целиком, а не точкой внутри кольца.
          background: selected ? "var(--t-brand-primary)" : "transparent",
          border: selected
            ? "none"
            : `var(--t-border-width) solid var(--t-surface-border)`,
        }}
      />

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
