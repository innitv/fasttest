import { useRef, type ReactNode } from "react";

import { COPY } from "@demo/content/copy";
import { useHorizontalScroll } from "@demo/lib/useHorizontalScroll";
import type { TenantConfig } from "@demo/theme/tenant.schema";
import { PaymentMethodButton } from "./PaymentMethodButton";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { PaymentMethodPlainRow } from "./PaymentMethodPlainRow";
import { PaymentMethodRadioRow } from "./PaymentMethodRadioRow";
import { PaymentSelectRow } from "./PaymentSelectRow";

interface Props {
  layout: TenantConfig["payment_list"]["layout"];
  methods: TenantConfig["payment_list"]["methods"];
  selected: string | null;
  onSelect: (id: string) => void;
  /**
   * true — список сам добавляет боковые поля страницы. Нужен там, где он
   * лежит в full-bleed секции без горизонтальных отступов (архетип A).
   * В архетипе B поля уже заданы скролл-контейнером.
   */
  padded: boolean;
  /**
   * Контент, вставляемый ВНУТРЬ столбика сразу после кнопки с заданным id
   * (архетип B). Так блок проверки телефона встаёт между «Ozon Банк» и
   * «СБП», не разрывая вертикальный ритм. В горизонтальном ряду не
   * применяется: там блок вставляется вне списка.
   */
  renderAfter?: (methodId: string) => ReactNode;
}

/**
 * Группа способов оплаты — `role="radiogroup"` с названием «Способ оплаты».
 *
 * Ось темы 21: горизонтальный ряд карточек против вертикального столбика
 * кнопок. Это структурно-визуальное различие, а не оформление.
 *
 * Горизонтальный ряд прокручивается независимо от страницы, поэтому число
 * способов оплаты НЕ влияет на вертикальную метрику экрана.
 */
export function PaymentMethodList({
  layout,
  methods,
  selected,
  onSelect,
  padded,
  renderAfter,
}: Props) {
  // Ref для мышь-прокрутки горизонтального ряда. В вертикальной раскладке не
  // прикрепляется — хук видит `null` и не делает ничего.
  const rowRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll(rowRef);

  if (layout === "select_list") {
    return (
      <div
        data-testid="payment-method-list"
        data-layout="select_list"
        className="flex w-full flex-col"
        style={{ paddingInline: padded ? "var(--t-page-padding)" : undefined }}
      >
        <PaymentSelectRow
          methods={methods}
          selected={selected}
          onSelect={onSelect}
          renderAfter={renderAfter}
        />
      </div>
    );
  }

  if (layout === "plain_rows") {
    return (
      <div
        role="radiogroup"
        aria-label={COPY["a11y.payment_group"]}
        data-testid="payment-method-list"
        data-layout="plain_rows"
        className="flex w-full flex-col"
        style={{
          gap: "4px",
          paddingInline: padded ? "var(--t-page-padding)" : undefined,
        }}
      >
        {methods.map((method) => (
          <div
            key={method.id}
            data-testid={`payment-method-card-${method.id}`}
            className="flex w-full flex-col"
          >
            <PaymentMethodPlainRow
              method={method}
              selected={selected === method.id}
              onSelect={onSelect}
            />
            {renderAfter?.(method.id)}
          </div>
        ))}
      </div>
    );
  }

  if (layout === "radio_rows") {
    return (
      <div
        role="radiogroup"
        aria-label={COPY["a11y.payment_group"]}
        data-testid="payment-method-list"
        data-layout="radio_rows"
        className="flex w-full flex-col"
        style={{
          gap: "4px",
          paddingInline: padded ? "var(--t-page-padding)" : undefined,
        }}
      >
        {methods.map((method) => (
          <div
            key={method.id}
            data-testid={`payment-method-card-${method.id}`}
            className="flex w-full flex-col"
            style={{
              border: "var(--t-border-width) solid var(--t-surface-border)",
              borderRadius: "var(--t-radius-card)",
              overflow: "hidden",
            }}
          >
            <PaymentMethodRadioRow
              method={method}
              selected={selected === method.id}
              onSelect={onSelect}
            />
            {/* Раскрытое поле живёт ВНУТРИ карточки метода: выбор и то, что он
                требует заполнить, читаются как один элемент. */}
            {renderAfter?.(method.id)}
          </div>
        ))}
      </div>
    );
  }

  if (layout === "vertical_buttons") {
    return (
      <div
        role="radiogroup"
        aria-label={COPY["a11y.payment_group"]}
        data-testid="payment-method-list"
        data-layout="vertical_buttons"
        className="flex w-full flex-col"
        style={{
          gap: "var(--k-method-button-gap)",
          paddingInline: padded ? "var(--t-page-padding)" : undefined,
        }}
      >
        {methods.map((method) => (
          <div key={method.id} className="flex w-full flex-col">
            <PaymentMethodButton
              method={method}
              selected={selected === method.id}
              onSelect={onSelect}
            />
            {renderAfter?.(method.id)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      aria-label={COPY["a11y.payment_group"]}
      data-testid="payment-method-list"
      data-layout="horizontal_cards"
      className="no-scrollbar h-scroll flex w-full"
      style={{
        gap: "var(--k-payment-card-gap)",
        paddingInline: padded ? "var(--t-page-padding)" : undefined,
        // Ряд обязан обрезаться правым краем: peek — наблюдаемый признак донора.
        scrollPaddingInline: "var(--t-page-padding)",
      }}
    >
      {methods.map((method) => (
        <PaymentMethodCard
          key={method.id}
          method={method}
          selected={selected === method.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
