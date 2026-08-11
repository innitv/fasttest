import { useId, useState, type ReactNode } from "react";

import { CheckGlyph, Chevron } from "@demo/components/primitives";
import { COPY, methodAccessibleName } from "@demo/content/copy";
import type { PaymentMethod } from "@demo/theme/tenant.schema";

interface Props {
  methods: PaymentMethod[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Контент под выбранным способом — блок проверки телефона у «Ozon Банк». */
  renderAfter?: (methodId: string) => ReactNode;
}

/**
 * Способ оплаты выпадающим списком — раскладка `select_list`.
 *
 * У донора («Хваловские воды») оплата занимает ОДНУ строку формы: текущее
 * значение слева, шеврон справа, варианты показываются только по нажатию.
 * Столбик строк отдал бы оплате втрое больше экрана, чем отдаёт донор, и
 * сломал бы ритм «поле — поле — поле», на котором держится его форма заказа.
 *
 * Нативный `<select>` донора здесь заменён управляемым раскрытием по двум
 * причинам: выбор «Ozon Банк» обязан РАСКРЫТЬ поле телефона под строкой (в
 * нативном списке этому негде жить), а внешний вид нативного выпадающего
 * списка задаёт операционная система, и на скриншотах приёмки он не
 * воспроизводится. Метрика закрытой строки при этом донорская: высота поля,
 * радиус поля, рамка поля.
 */
export function PaymentSelectRow({ methods, selected, onSelect, renderAfter }: Props) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  const current = methods.find((method) => method.id === selected) ?? null;

  return (
    <div className="flex w-full flex-col" data-testid="payment-select">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid="payment-select-trigger"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
        style={{
          /*
           * Высота ПОЛЯ, а не главной кнопки: у донора «Хваловских вод» поле
           * оплаты 44 px, а кнопка «Заказать» 48 — это разные роли, и общий
           * `--t-control-height` делал строку оплаты выше донорской.
           */
          minHeight: "var(--t-row-height)",
          gap: "12px",
          paddingInline: "16px",
          background: "var(--t-surface-card)",
          border: "var(--t-border-width) solid var(--t-surface-border)",
          borderRadius: "var(--t-radius-field)",
          cursor: "pointer",
        }}
      >
        <span
          className="min-w-0 flex-1 truncate"
          style={{
            fontSize: "var(--t-font-body)",
            color: current ? "var(--t-text-primary)" : "var(--t-text-secondary)",
          }}
        >
          {current ? current.label : COPY["payment.select_placeholder"]}
        </span>
        {/* Шеврон донора смотрит вправо и в раскрытом состоянии поворачивается
            вниз: направление — единственный признак того, что строка живая. */}
        <span
          aria-hidden
          className="flex items-center"
          style={{
            color: "var(--t-text-primary)",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform var(--k-motion-fast) ease-out",
          }}
        >
          <Chevron />
        </span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={COPY["a11y.payment_group"]}
          data-testid="payment-select-list"
          className="flex w-full flex-col"
          style={{
            marginTop: "6px",
            overflow: "hidden",
            background: "var(--t-surface-card)",
            border: "var(--t-border-width) solid var(--t-surface-border)",
            borderRadius: "var(--t-radius-field)",
          }}
        >
          {methods.map((method) => {
            const isSelected = method.id === selected;
            return (
              <button
                key={method.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-label={methodAccessibleName(method.label, isSelected)}
                data-testid={`payment-method-row-${method.id}`}
                data-selected={isSelected}
                onClick={() => {
                  onSelect(method.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between text-left"
                style={{
                  minHeight: "44px",
                  gap: "12px",
                  paddingInline: "16px",
                  background: isSelected ? "var(--t-brand-tonal)" : "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--t-font-body)",
                    color: isSelected
                      ? "var(--t-brand-tonal-on)"
                      : "var(--t-text-primary)",
                  }}
                >
                  {method.label}
                </span>
                {isSelected && (
                  <CheckGlyph size={14} color="var(--t-brand-tonal-marker)" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Поле телефона живёт ПОД строкой выбора, а не внутри списка: список
          закрывается сразу после выбора, и вложенный в него блок исчез бы
          вместе с ним. */}
      {selected && renderAfter?.(selected)}
    </div>
  );
}
