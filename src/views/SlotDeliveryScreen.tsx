import { useState } from "react";

import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { BackChevron } from "@demo/components/primitives";
import { COPY, formatMoney, resolveCtaLabel } from "@demo/content/copy";
import { OZON_METHOD_ID, type LineItemConfig } from "@demo/theme/tenant.schema";
import type { ScreenProps } from "./screen-props";

/**
 * `S-F` — архетип `slot_delivery`, донор «Хваловские воды»
 * (`msc.hvalwaters.ru/cart`, снят по computed styles).
 *
 * Порядок зон донора: служебная полоса с городом → шапка с логотипом и
 * аватаром → H1 «Заказ» → плашка-обещание → строки товаров СО СЧЁТЧИКАМИ →
 * карточка адреса → строка-тумблер с чипом → «Оплата» ВЫПАДАЮЩИМ СПИСКОМ →
 * «Время доставки» двумя ячейками → «Дополнительно» рядами → сноска →
 * свёрнутая разбивка чека → липкая панель «Итого + Заказать».
 *
 * Почему это не `cart_checkout`: там состав заказа — витрина того, что уже
 * решено, и правится он на другом экране. Здесь состав ПРАВИТСЯ прямо тут
 * (счётчик у каждой строки), а половину экрана занимает не выбор оплаты, а
 * условия доставки — адрес, дверь, слот времени. Экран отвечает на вопрос
 * «когда привезут», а не «чем платить», и порядок блоков это показывает.
 */
export function SlotDeliveryScreen({
  tenant,
  selectedMethod,
  onSelectMethod,
  ctaState,
  ctaLoadingLabel,
  ctaSentLabel,
  onCta,
  forcedState,
  phoneGate,
}: ScreenProps) {
  const { content } = tenant;

  // Количества живут в состоянии экрана: счётчик обязан менять и строку, и
  // сумму в липкой панели — иначе он декорация, а у донора это главный
  // инструмент правки заказа.
  const [quantities, setQuantities] = useState<number[]>(() =>
    content.line_items.map((item) => item.quantity ?? 1),
  );
  const [doorOpen, setDoorOpen] = useState(content.door_toggle?.default_on ?? false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  /*
   * Сумма считается от НАЧАЛЬНЫХ количеств: тема задаёт `totals.sum` для того
   * состава, который лежит в конфиге. Изменение счётчика двигает сумму на
   * цену позиции — цена берётся из `price` строки, единственного места, где
   * она есть числом у донора.
   */
  const delta = content.line_items.reduce((sum, item, index) => {
    const initial = item.quantity ?? 1;
    const now = quantities[index] ?? initial;
    return sum + (now - initial) * itemPriceKopecks(item);
  }, 0);

  const payable = content.totals.sum - content.totals.discount + delta;
  const ctaLabel = resolveCtaLabel(tenant.cta.label, tenant.cta.include_amount, payable);

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  const pad = { paddingInline: "var(--t-page-padding)" };
  const sectionTitle = {
    margin: 0,
    fontSize: "var(--t-font-section-title)",
    fontWeight: "var(--t-label-weight)" as unknown as number,
    color: "var(--t-text-primary)",
  };

  const ctaButton = (
    <PrimaryButton
      label={ctaLabel}
      loadingLabel={ctaLoadingLabel}
      sentLabel={ctaSentLabel}
      state={disabled ? "disabled" : ctaState}
      onClick={onCta}
    />
  );

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ── Зона 1: служебная полоса и шапка ─────────────────────────── */}
      <header data-testid="screen-header" data-style="logo_account" className="shrink-0">
        {tenant.header.top_bar && (
          <div
            data-testid="header-top-bar"
            className="flex w-full items-center"
            style={{
              ...pad,
              height: "36px",
              gap: "8px",
              background: "var(--t-surface-form)",
              fontSize: "var(--t-font-body)",
              color: "var(--t-text-primary)",
            }}
          >
            <span>{tenant.header.top_bar.city}</span>
            <span aria-hidden style={{ color: "var(--t-text-secondary)" }}>
              |
            </span>
            <span>{tenant.header.top_bar.phone}</span>
          </div>
        )}

        <div
          className="flex w-full items-center"
          style={{ ...pad, height: "54px", gap: "12px" }}
        >
          <span
            aria-hidden
            className="flex items-center justify-center"
            style={{ width: "24px", height: "24px", color: "var(--t-text-primary)" }}
          >
            <BackChevron />
          </span>

          {content.header_logo ? (
            <img
              data-testid="header-logo"
              src={content.header_logo}
              alt={tenant.display_name}
              style={{ height: "32px", width: "auto" }}
            />
          ) : (
            <span
              data-testid="header-logo"
              style={{
                fontSize: "var(--t-font-section-title)",
                fontWeight: "var(--t-title-weight)" as unknown as number,
                color: "var(--t-brand-primary)",
              }}
            >
              {tenant.brand.logo.text ?? tenant.display_name}
            </span>
          )}

          {tenant.header.account_initials && (
            <span
              data-testid="header-account"
              className="ml-auto flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                flexShrink: 0,
                borderRadius: "999px",
                background: "var(--t-text-primary)",
                color: "var(--t-surface-card)",
                fontSize: "var(--t-font-body)",
              }}
            >
              {tenant.header.account_initials}
            </span>
          )}
        </div>
      </header>

      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{ paddingBottom: STICKY_TOTAL_RESERVE }}
      >
        {/* ── Зона 2: заголовок ──────────────────────────────────────── */}
        <h1
          data-testid="page-title"
          style={{
            ...pad,
            margin: 0,
            paddingTop: "12px",
            fontSize: "var(--t-font-h1)",
            fontWeight: "var(--t-title-weight)" as unknown as number,
            color: "var(--t-text-primary)",
            lineHeight: 1.3,
          }}
        >
          {content.title}
        </h1>

        {/* ── Зона 3: плашка-обещание ────────────────────────────────── */}
        {content.promise && (
          <div
            data-testid="promise-plate"
            className="flex items-center"
            style={{
              ...pad,
              marginTop: "16px",
              marginInline: "var(--t-page-padding)",
              paddingBlock: "8px",
              paddingInline: "8px",
              gap: "12px",
              background: "var(--t-surface-form)",
              borderRadius: "24px",
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: "44px",
                height: "44px",
                flexShrink: 0,
                borderRadius: "20px",
                background: "var(--t-surface-card)",
              }}
            >
              {content.promise.icon ? (
                <img src={content.promise.icon} alt="" width={18} height={13} />
              ) : null}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                style={{
                  fontSize: "var(--t-font-caption)",
                  fontWeight: 600,
                  color: "var(--t-text-primary)",
                  lineHeight: 1.35,
                }}
              >
                {content.promise.title}
              </span>
              <span
                style={{
                  fontSize: "var(--t-font-caption)",
                  color: "var(--t-text-primary)",
                  lineHeight: 1.35,
                }}
              >
                {content.promise.caption}
              </span>
            </span>
          </div>
        )}

        {/* ── Зона 4: состав заказа со счётчиками ────────────────────── */}
        <div
          data-testid="items-block"
          className="flex w-full flex-col"
          style={{ ...pad, marginTop: "16px", gap: "16px" }}
        >
          {content.line_items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              data-testid={`line-item-${index + 1}`}
              className="flex w-full items-center"
              style={{ gap: "12px" }}
            >
              {item.media && (
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: "44px",
                    height: "44px",
                    flexShrink: 0,
                    borderRadius: "16px",
                    background: "var(--t-surface-form)",
                  }}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.image_alt ?? item.title}
                      style={{ maxWidth: "26px", maxHeight: "40px", objectFit: "contain" }}
                    />
                  )}
                </span>
              )}

              <span className="flex min-w-0 flex-1 flex-col" style={{ gap: "2px" }}>
                <span
                  style={{
                    fontSize: "var(--t-font-body)",
                    color: "var(--t-text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {item.title}
                </span>
                <span className="flex items-baseline" style={{ gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "var(--t-font-body)",
                      fontWeight: 600,
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {item.price}
                  </span>
                  {item.old_price && (
                    <span
                      data-testid={`line-item-${index + 1}-old-price`}
                      style={{
                        fontSize: "var(--t-font-caption)",
                        color: "var(--t-text-secondary)",
                        textDecoration: "line-through",
                      }}
                    >
                      {item.old_price}
                    </span>
                  )}
                </span>
              </span>

              {content.items_counter && (
                <QuantityStepper
                  value={quantities[index] ?? 1}
                  unit={content.items_counter_unit}
                  onChange={(next) =>
                    setQuantities((all) =>
                      all.map((value, i) => (i === index ? next : value)),
                    )
                  }
                  testId={`item-counter-${index + 1}`}
                  title={item.title}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Зона 5: адрес доставки ─────────────────────────────────── */}
        {content.address && (
          <div
            data-testid="address-card"
            className="flex items-center"
            style={{
              marginTop: "24px",
              marginInline: "var(--t-page-padding)",
              padding: "14px",
              gap: "12px",
              background: "var(--t-surface-form)",
              borderRadius: "var(--t-radius-card)",
            }}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                style={{
                  fontSize: "var(--t-font-body)",
                  fontWeight: 500,
                  color: "var(--t-text-primary)",
                  lineHeight: 1.5,
                }}
              >
                {content.address.title}
              </span>
              {content.address.subtitle && (
                <span
                  style={{
                    fontSize: "var(--t-font-body)",
                    color: "var(--t-text-primary)",
                    lineHeight: 1.5,
                  }}
                >
                  {content.address.subtitle}
                </span>
              )}
            </span>
            <button
              type="button"
              data-testid="address-edit"
              aria-label={content.address.action_label}
              className="flex items-center justify-center"
              style={{
                width: "var(--k-tap-min)",
                height: "var(--k-tap-min)",
                flexShrink: 0,
                background: "none",
                border: "none",
                color: "var(--t-text-primary)",
                cursor: "pointer",
              }}
            >
              <PencilGlyph />
            </button>
          </div>
        )}

        {/* ── Зона 6: строка-тумблер с чипом ─────────────────────────── */}
        {content.door_toggle && (
          <label
            data-testid="door-toggle"
            className="flex items-center"
            style={{
              marginTop: "16px",
              marginInline: "var(--t-page-padding)",
              gap: "12px",
              minHeight: "var(--k-tap-min)",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden
              className="flex items-center justify-center"
              style={{
                width: "40px",
                height: "40px",
                flexShrink: 0,
                borderRadius: "var(--t-radius-card)",
                background: "var(--t-surface-form)",
                color: "var(--t-text-primary)",
              }}
            >
              <DoorGlyph />
            </span>

            <span className="flex min-w-0 flex-1 items-center" style={{ gap: "8px" }}>
              <span
                style={{
                  fontSize: "var(--t-font-body)",
                  fontWeight: 500,
                  color: "var(--t-text-primary)",
                }}
              >
                {content.door_toggle.label}
              </span>
              {/* Чип у донора — не бейдж, а условие: опция доступна только при
                  онлайн-оплате, и он сообщает это прямо в строке. */}
              {content.door_toggle.tag && (
                <span
                  data-testid="door-toggle-tag"
                  style={{
                    paddingInline: "8px",
                    paddingBlock: "2px",
                    borderRadius: "var(--t-radius-chip)",
                    background: "var(--t-surface-form)",
                    color: "var(--t-text-secondary)",
                    fontSize: "11px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {content.door_toggle.tag}
                </span>
              )}
            </span>

            <input
              type="checkbox"
              className="sr-only"
              checked={doorOpen}
              onChange={(event) => setDoorOpen(event.target.checked)}
            />
            <span
              aria-hidden
              className="flex shrink-0 items-center"
              style={{
                width: "56px",
                height: "32px",
                padding: "4px",
                borderRadius: "999px",
                background: doorOpen ? "var(--t-brand-primary)" : "var(--t-surface-border)",
                transition: "background-color var(--k-motion-fast) ease-out",
              }}
            >
              <span
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "999px",
                  background: "var(--t-surface-card)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transform: doorOpen ? "translateX(24px)" : "none",
                  transition: "transform var(--k-motion-fast) ease-out",
                }}
              />
            </span>
          </label>
        )}

        {/* ── Зона 7: оплата — точка вставки «Ozon Банк» ─────────────── */}
        <section data-testid="payment-block" style={{ ...pad, marginTop: "28px" }}>
          <h2 style={sectionTitle}>
            {tenant.payment_list.section_title ?? COPY["payment.section_title"]}
          </h2>
          <div style={{ marginTop: "12px" }}>
            <PaymentMethodList
              layout={tenant.payment_list.layout}
              methods={tenant.payment_list.methods}
              selected={selectedMethod}
              onSelect={onSelectMethod}
              padded={false}
              renderAfter={(methodId) =>
                phoneGate && methodId === OZON_METHOD_ID ? (
                  <div style={{ marginTop: "12px" }}>
                    <PhoneGateBlock {...phoneGate} />
                  </div>
                ) : null
              }
            />
          </div>
        </section>

        {/* ── Зона 8: время доставки ─────────────────────────────────── */}
        {content.delivery_slot && (
          <section data-testid="delivery-slot" style={{ ...pad, marginTop: "28px" }}>
            <h2 style={sectionTitle}>{content.delivery_slot.title}</h2>
            {/*
              Две ячейки в ОДНОЙ рамке с разделителем посередине: у донора это
              не два поля, а одно значение из двух половин — дата без интервала
              и интервал без даты одинаково бессмысленны.
            */}
            <div
              className="flex w-full items-stretch"
              style={{
                marginTop: "12px",
                border: "var(--t-border-width) solid var(--t-surface-border)",
                borderRadius: "var(--t-radius-field)",
                overflow: "hidden",
              }}
            >
              <span
                data-testid="slot-date"
                aria-label={`${COPY["slot.date"]}: ${content.delivery_slot.date}`}
                className="flex flex-1 items-center justify-center"
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  fontSize: "var(--t-font-body)",
                  color: "var(--t-text-primary)",
                  textAlign: "center",
                }}
              >
                {content.delivery_slot.date}
              </span>
              <span
                aria-hidden
                style={{ width: "var(--t-border-width)", background: "var(--t-surface-border)" }}
              />
              <span
                data-testid="slot-time"
                aria-label={`${COPY["slot.time"]}: ${content.delivery_slot.time}`}
                className="flex flex-1 items-center justify-center"
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  fontSize: "var(--t-font-body)",
                  color: "var(--t-text-primary)",
                  textAlign: "center",
                }}
              >
                {content.delivery_slot.time}
              </span>
            </div>
          </section>
        )}

        {/* ── Зона 9: дополнительно ──────────────────────────────────── */}
        {content.extras_rows.length > 0 && (
          <section data-testid="extras-block" style={{ ...pad, marginTop: "28px" }}>
            <h2 style={sectionTitle}>{COPY["extras.section_title"]}</h2>
            <div className="flex w-full flex-col" style={{ marginTop: "12px", gap: "12px" }}>
              {content.extras_rows.map((row, index) => (
                <div
                  key={row.title}
                  data-testid={`extras-row-${index + 1}`}
                  className="flex w-full items-center"
                  style={{
                    // 51 px — замер донора: ряд «Дополнительно» выше поля
                    // формы, потому что несёт не ввод, а свёрнутый блок.
                    minHeight: "51px",
                    paddingInline: "14px",
                    gap: "12px",
                    border: "var(--t-border-width) solid var(--t-surface-border)",
                    borderRadius: "var(--t-radius-field)",
                  }}
                >
                  <span
                    className="min-w-0 flex-1"
                    style={{
                      fontSize: "var(--t-font-body)",
                      fontWeight: 600,
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {row.title}
                  </span>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: "var(--t-font-caption)",
                      fontWeight: 600,
                      color: "var(--t-text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {row.action_label}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Зона 10: сноска и разбивка чека ────────────────────────── */}
        {content.legal_note && (
          <p
            data-testid="legal-note"
            style={{
              ...pad,
              margin: "24px 0 0",
              fontSize: "var(--t-font-caption)",
              lineHeight: 1.35,
              color: "var(--t-text-secondary)",
            }}
          >
            {content.legal_note}
          </p>
        )}

        {content.receipt_breakdown && (
          <section data-testid="receipt-breakdown" style={{ ...pad, marginTop: "16px" }}>
            <button
              type="button"
              data-testid="receipt-breakdown-toggle"
              aria-expanded={breakdownOpen}
              onClick={() => setBreakdownOpen((value) => !value)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "var(--t-font-caption)",
                color: "var(--t-text-secondary)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {breakdownOpen
                ? COPY["receipt.collapse"]
                : content.receipt_breakdown.title}
            </button>
            {breakdownOpen && (
              <div
                className="flex w-full flex-col"
                style={{
                  marginTop: "12px",
                  paddingTop: "12px",
                  gap: "8px",
                  borderTop: "var(--t-border-width) solid var(--t-surface-divider)",
                }}
              >
                {content.receipt_breakdown.rows.map((row) => (
                  <div
                    key={row.name}
                    className="flex w-full items-baseline justify-between"
                    style={{ gap: "12px" }}
                  >
                    <span
                      className="min-w-0"
                      style={{
                        fontSize: "var(--t-font-caption)",
                        color: "var(--t-text-secondary)",
                      }}
                    >
                      {row.name}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--t-font-caption)",
                        color: "var(--t-text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Зона 11: липкая панель «Итого + кнопка» ────────────────── */}
      <div
        data-testid="cta-sticky-panel"
        className="absolute inset-x-0 bottom-0 z-10 flex items-center"
        style={{
          gap: "16px",
          background: "var(--t-surface-card)",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
          // Поля панели донорские (16 сверху и снизу): при высоте кнопки 48
          // это даёт ровно 80 px, снятые с живой страницы.
          paddingTop: "16px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          paddingInline: "var(--t-page-padding)",
        }}
      >
        {tenant.cta.sticky_total && (
          <span className="flex shrink-0 flex-col">
            <span
              style={{
                fontSize: "var(--t-font-body)",
                color: "var(--t-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              {tenant.cta.sticky_total.label}
            </span>
            <span
              data-testid="totals-value"
              style={{
                fontSize: "var(--t-font-h1)",
                fontWeight: "var(--t-title-weight)" as unknown as number,
                color: "var(--t-text-primary)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {formatMoney(payable)}
            </span>
          </span>
        )}
        <span className="min-w-0 flex-1">{ctaButton}</span>
      </div>
    </div>
  );
}

/**
 * Резерв прокрутки под липкой панелью. Она выше обычной: кроме кнопки в ней
 * стоит двухстрочный итог, и высота считается от него, а не от контрола.
 */
const STICKY_TOTAL_RESERVE =
  "calc(var(--t-control-height) + 32px + env(safe-area-inset-bottom, 0px))";

/** Цена позиции в копейках: строка донора вида «216,33 ₽» → 21633. */
function itemPriceKopecks(item: LineItemConfig): number {
  const digits = item.price.replace(/[^\d,.]/g, "").replace(",", ".");
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/**
 * Счётчик количества «− N +».
 *
 * Нижняя граница — 1, а не 0: удаление позиции у донора живёт не здесь, и
 * счётчик, обнуляющий строку без её исчезновения, показал бы состояние,
 * которого у донора нет.
 */
function QuantityStepper({
  value,
  unit,
  onChange,
  testId,
  title,
}: {
  value: number;
  unit: string | null;
  onChange: (next: number) => void;
  testId: string;
  title: string;
}) {
  const button = {
    width: "var(--k-tap-min)",
    height: "38px",
    background: "none",
    border: "none",
    color: "var(--t-text-primary)",
    fontSize: "18px",
    lineHeight: 1,
    cursor: "pointer",
  } as const;

  return (
    <span
      data-testid={testId}
      className="flex shrink-0 items-center"
      style={{
        height: "38px",
        borderRadius: "24px",
        background: "var(--t-surface-form)",
      }}
    >
      <button
        type="button"
        aria-label={`${COPY["counter.decrease"]}: ${title}`}
        onClick={() => onChange(Math.max(1, value - 1))}
        style={button}
      >
        −
      </button>
      {/* Единица стоит рядом с числом и объясняет, что прибавляет плюс:
          у донора это бутыли, а не литры и не заказы. */}
      <span
        data-testid={`${testId}-value`}
        className="flex flex-col items-center justify-center"
        style={{
          minWidth: "22px",
          fontSize: "var(--t-font-body)",
          lineHeight: 1.1,
          color: "var(--t-text-primary)",
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: "10px", color: "var(--t-text-secondary)" }}>
            {unit}
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label={`${COPY["counter.increase"]}: ${title}`}
        onClick={() => onChange(value + 1)}
        style={button}
      >
        +
      </button>
    </span>
  );
}

function PencilGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M12.2 2.3 15.7 5.8 6.2 15.3l-4.4.9.9-4.4 9.5-9.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DoorGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4 2h10v14H4V2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="11.5" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}
