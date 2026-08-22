import { useState } from "react";

import { LineItem } from "@demo/components/LineItem";
import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import {
  PrimaryButton,
  STICKY_PANEL_RESERVE,
  StickyCtaPanel,
} from "@demo/components/PrimaryButton";
import { SurfaceCard } from "@demo/components/primitives";
import { TextField } from "@demo/components/TextField";
import { COPY, formatMoney, resolveCtaLabel } from "@demo/content/copy";
import { BackChevron } from "@demo/components/primitives";
import type { ScreenProps } from "./screen-props";

/**
 * `S-D` — архетип `ticket_checkout`, третья калибровочная крайность.
 *
 * Почему отдельный экран, а не тема поверх `cart_checkout`: билетный донор
 * расходится с корзиной не цветом, а МОДЕЛЬЮ ЭКРАНА. Корзина показывает уже
 * известные системе реквизиты строками «label → value» и ведёт к доставке;
 * билет продаётся анонимно, поэтому экран открывается ПУСТОЙ формой
 * покупателя, а вместо доставки несёт состав места (сектор, ряд, место).
 * Перекрашенная корзина читается как чужой сайт: структура узнаётся раньше
 * палитры.
 *
 * Порядок зон снят с донора (`test-results/from-site/voroh-live.dark.png`):
 * отмена → событие → форма покупателя → промокод → способы оплаты →
 * состав билета → итог акцентом → sticky-CTA.
 */
export function TicketCheckoutScreen({
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

  const [fields, setFields] = useState<Record<string, string>>({});
  const [promoCode, setPromoCode] = useState("");

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount,
  );

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{ paddingBottom: STICKY_PANEL_RESERVE }}
      >
        {/* ── Зона 1: отмена покупки ───────────────────────────────
            У донора это не «назад» в шапке, а текстовая кнопка отмены
            акцентным цветом над заголовком: покупка билета — сделка,
            выход из неё называется своим словом. */}
        <div
          style={{
            paddingInline: "var(--t-page-padding)",
            paddingTop: "12px",
          }}
        >
          <button
            type="button"
            data-testid="cancel-link"
            className="flex items-center"
            style={{
              minHeight: "var(--k-tap-min)",
              gap: "6px",
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--t-brand-text-on-bg)",
              fontSize: "var(--t-font-body)",
              fontWeight: "var(--t-label-weight)",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", transform: "scale(0.7)" }}>
              <BackChevron />
            </span>
            {tenant.header.back_label ?? COPY["nav.back"]}
          </button>
        </div>

        {/* ── Зона 2: событие ──────────────────────────────────────── */}
        <div
          style={{
            paddingInline: "var(--t-page-padding)",
            paddingTop: "4px",
            paddingBottom: "var(--t-block-gap)",
          }}
        >
          <h1
            data-testid="page-title"
            style={{
              margin: 0,
              fontSize: "var(--t-font-h1)",
              fontWeight: "var(--t-title-weight)",
              lineHeight: 1.25,
              color: "var(--t-text-primary)",
            }}
          >
            {content.title}
          </h1>
          {content.event && (
            <div
              data-testid="event-meta"
              className="flex flex-col"
              style={{
                marginTop: "8px",
                gap: "2px",
                fontSize: "var(--t-font-body)",
                lineHeight: 1.35,
                color: "var(--t-text-secondary)",
              }}
            >
              <span>{content.event.venue}</span>
              <span>{content.event.date}</span>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col" style={{ gap: "var(--t-block-gap)" }}>
          {/* ── Зона 3: форма покупателя ──────────────────────────── */}
          {content.buyer_form?.enabled && content.buyer_form.fields.length > 0 && (
            <SurfaceCard
              testId="buyer-form"
              style={{
                paddingInline: "var(--t-page-padding)",
                paddingBlock: "var(--t-page-padding)",
              }}
            >
              <div className="flex w-full flex-col" style={{ gap: "16px" }}>
                {content.buyer_form.fields.map((field) => (
                  <TextField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    requiredMark={field.required}
                    surface="form"
                    placeholder={field.placeholder}
                    value={fields[field.name] ?? ""}
                    inputMode={field.input_mode === "numeric" ? "numeric" : "text"}
                    onChange={(value) =>
                      setFields((state) => ({ ...state, [field.name]: value }))
                    }
                  />
                ))}
                {content.buyer_form.required_note && (
                  <p
                    data-testid="required-note"
                    style={{
                      margin: 0,
                      fontSize: "var(--t-font-caption)",
                      lineHeight: 1.35,
                      color: "var(--t-text-secondary)",
                    }}
                  >
                    {content.buyer_form.required_note}
                  </p>
                )}
              </div>
            </SurfaceCard>
          )}

          {/* ── Зона 4: промокод открытым полем ───────────────────── */}
          {content.promo?.enabled && content.promo.presentation === "field" && (
            <SurfaceCard
              testId="promo-field"
              style={{
                paddingInline: "var(--t-page-padding)",
                paddingBlock: "var(--t-page-padding)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  paddingBottom: "12px",
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: "var(--t-title-weight)",
                  color: "var(--t-text-primary)",
                }}
              >
                {content.promo.title ?? COPY["promo.field.title"]}
              </h2>
              <TextField
                name="promo"
                label=""
                surface="form"
                placeholder={COPY["promo.field.hint"]}
                value={promoCode}
                onChange={setPromoCode}
              />
              {/*
                Кнопка применения — вторичная заливка донора, а не главный
                акцент: промокод не конкурирует с оплатой. Цвет берётся из
                `brand.secondary`; тема без пятого цвета откатывается к
                поверхности карточки, и кнопка остаётся видимой.
              */}
              <button
                type="button"
                data-testid="promo-apply"
                className="flex w-full items-center justify-center"
                style={{
                  marginTop: "12px",
                  height: "var(--t-control-height)",
                  borderRadius: "var(--t-radius-control)",
                  background: "var(--t-secondary-fill, var(--t-surface-card))",
                  color: "var(--t-secondary-text, var(--t-text-primary))",
                  fontSize: "var(--t-font-body)",
                  fontWeight: "var(--t-label-weight)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {COPY["promo.apply"]}
              </button>
            </SurfaceCard>
          )}

          {/* ── Зона 5: способы оплаты — точка вставки «Ozon Банк» ── */}
          <SurfaceCard
            testId="payment-block"
            style={{ paddingBlock: "var(--t-page-padding)" }}
          >
            <h2
              style={{
                margin: 0,
                paddingInline: "var(--t-page-padding)",
                paddingBottom: "12px",
                fontSize: "var(--t-font-section-title)",
                fontWeight: "var(--t-title-weight)",
                color: "var(--t-text-primary)",
              }}
            >
              {COPY["payment.methods_title"]}
            </h2>
            <PaymentMethodList
              layout={tenant.payment_list.layout}
              methods={tenant.payment_list.methods}
              selected={selectedMethod}
              onSelect={onSelectMethod}
              padded
            />
            {phoneGate && (
              <div style={{ paddingInline: "var(--t-page-padding)" }}>
                <PhoneGateBlock {...phoneGate} />
              </div>
            )}
          </SurfaceCard>

          {/* ── Зона 6: состав билета и итог ──────────────────────── */}
          <SurfaceCard
            testId="ticket-summary"
            style={{
              paddingInline: "var(--t-page-padding)",
              paddingBlock: "var(--t-page-padding)",
            }}
          >
            {content.items_title && (
              <p
                data-testid="items-title"
                style={{
                  margin: 0,
                  paddingBottom: "8px",
                  fontSize: "var(--t-font-caption)",
                  color: "var(--t-text-secondary)",
                }}
              >
                {content.items_title}
              </p>
            )}
            {content.line_items.map((item, index) => (
              <LineItem key={`${item.title}-${index}`} item={item} index={index} />
            ))}

            <div
              data-testid="totals-block"
              data-variant="accent_row"
              className="flex w-full items-center justify-between"
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "var(--t-border-width) solid var(--t-surface-divider)",
                minHeight: "var(--t-row-height)",
                gap: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: "var(--t-title-weight)",
                  color: "var(--t-text-primary)",
                }}
              >
                {COPY["totals.label"]}
              </span>
              {/*
                Сумма акцентом — донорская черта билетного экрана: цена места
                единственное, что покупатель сверяет перед оплатой. Цвет берётся
                из `brand-text-on-bg`, а не из `brand-primary`: на фоне карточки
                фирменный красный донора не добирает контраста, а этот токен —
                уже выправленный движком вариант того же цвета.
              */}
              <span
                data-testid="totals-value"
                style={{
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: 700,
                  color: "var(--t-brand-text-on-bg)",
                  whiteSpace: "nowrap",
                }}
              >
                {formatMoney(content.totals.sum - content.totals.discount)}
              </span>
            </div>
          </SurfaceCard>
        </div>
      </div>

      <StickyCtaPanel>
        <PrimaryButton
          label={ctaLabel}
          loadingLabel={ctaLoadingLabel}
          sentLabel={ctaSentLabel}
          state={disabled ? "disabled" : ctaState}
          onClick={onCta}
        />
      </StickyCtaPanel>
    </div>
  );
}
