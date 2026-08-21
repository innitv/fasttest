import { useRef, type ReactNode } from "react";

import { COPY } from "@demo/content/copy";
import { useHorizontalScroll } from "@demo/lib/useHorizontalScroll";
import type { TenantConfig } from "@demo/theme/tenant.schema";
import { BankWordmark } from "./bank/BankWordmark";
import { PaymentMethodButton } from "./PaymentMethodButton";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { PaymentMethodPlainRow } from "./PaymentMethodPlainRow";
import { PaymentMethodRadioRow } from "./PaymentMethodRadioRow";
import { PaymentSelectRow } from "./PaymentSelectRow";
import { PaymentSheetRow } from "./PaymentSheetRow";

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
  /**
   * Тексты нижней шторки — раскладка `sheet_select`. Заголовок и метка
   * кнопки принадлежат донору и не выводятся из названия секции: у MYBOX
   * секция называется «Способ оплаты», а шторка — «Способы оплаты».
   */
  sheet?: { title: string; ctaLabel: string; forceOpen?: boolean };
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
  sheet,
}: Props) {
  // Ref для мышь-прокрутки горизонтального ряда. В вертикальной раскладке не
  // прикрепляется — хук видит `null` и не делает ничего.
  const rowRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll(rowRef);

  /*
   * `logo_grid` — сетка карточек-логотипов по три в ряд (донор EWA).
   *
   * Карточка не несёт подписи вовсе: платёжная система узнаётся логотипом, а
   * дорисованное название добавило бы строку, которой у донора нет. Поэтому
   * `label` уходит в `aria-label` — для скринридера способ назван, для глаза
   * остаётся то же, что у донора.
   *
   * Карточка «Ozon Банка» несёт слот знака (`logo: "slot"`), а не подпись
   * текстом: у соседей по сетке логотипы платёжных систем, и один способ,
   * названный словами, читается как незаполненная строка формы. Знак рисует
   * `BankWordmark` — тот же слот, что на экранах банка, в компактном
   * варианте. Токенов `--bank-*` он в этом варианте не несёт, поэтому
   * граница темы не нарушается; цвет наследуется от карточки подрядчика,
   * потому что смена айдентики наступает только на пуше.
   */
  if (layout === "logo_grid") {
    return (
      <div
        role="radiogroup"
        aria-label={COPY["a11y.payment_group"]}
        data-testid="payment-method-list"
        data-layout="logo_grid"
        className="grid w-full"
        style={{
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--k-payment-card-gap)",
          paddingInline: padded ? "var(--t-page-padding)" : undefined,
        }}
      >
        {methods.map((method) => {
          const isSelected = selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={method.label}
              onClick={() => onSelect(method.id)}
              data-testid="payment-method"
              data-method-id={method.id}
              data-selected={isSelected || undefined}
              className="flex items-center justify-center"
              style={{
                height: "var(--t-method-button-height)",
                minHeight: "var(--k-tap-min)",
                padding: "8px 6px",
                background: "var(--t-surface-form)",
                borderRadius: "var(--t-radius-field)",
                // Рамка есть всегда: меняется только цвет, иначе карточка
                // прыгает на её толщину в момент выбора.
                border: `var(--t-selected-border-width) solid ${
                  isSelected ? "var(--t-brand-border-selected)" : "var(--t-surface-border)"
                }`,
                transition: "border-color var(--k-motion-fast)",
              }}
            >
              {method.logo_src ? (
                <img
                  src={method.logo_src}
                  alt=""
                  aria-hidden
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : method.logo === "slot" ? (
                <BankWordmark variant="compact" />
              ) : (
                <span
                  aria-hidden
                  style={{
                    fontSize: "var(--t-font-caption)",
                    fontWeight: 500,
                    textAlign: "center",
                    lineHeight: 1.15,
                    color: "var(--t-text-primary)",
                  }}
                >
                  {method.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (layout === "sheet_select") {
    return (
      <div
        data-testid="payment-method-list"
        data-layout="sheet_select"
        className="flex w-full flex-col"
        style={{ paddingInline: padded ? "var(--t-page-padding)" : undefined }}
      >
        <PaymentSheetRow
          methods={methods}
          selected={selected}
          onSelect={onSelect}
          sheetTitle={sheet?.title ?? COPY["pickup.sheet_title"]}
          ctaLabel={sheet?.ctaLabel ?? COPY["pickup.sheet_cta"]}
          forceOpen={sheet?.forceOpen}
        />
        {renderAfter?.(selected ?? "")}
      </div>
    );
  }

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
