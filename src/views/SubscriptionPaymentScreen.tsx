import { useState } from "react";

import { Checkbox } from "@demo/components/Checkbox";
import { LineItem } from "@demo/components/LineItem";
import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { PromoAccordion } from "@demo/components/PromoAccordion";
import { ScreenHeader } from "@demo/components/ScreenHeader";
import { TextField } from "@demo/components/TextField";
import { ThreeRowTotals } from "@demo/components/TotalsBlock";
import {
  BackChevron,
  EyeOffGlyph,
  NeutralPlate,
  ResponsiveText,
} from "@demo/components/primitives";
import { COPY, resolveCtaLabel } from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";

/**
 * `S-B` — архетип `subscription_payment`, калибровочная крайность 2.
 *
 * Карточек-секций нет вовсе: контент лежит прямо на фоне и группируется
 * тональными подложками и разделителями (ось 1 = `tonal_fill`).
 *
 * CTA «Оплатить {сумма}» — INLINE, на донорском месте прямо под формой карты
 * (откат sticky-захода 2026-07-24: телефон-gate уехал на отдельный экран
 * `ozon_rail`, ломать поток больше нечему). Это кнопка ОПЛАТЫ КАРТОЙ — основная
 * форма вверху. Способы оплаты ниже («Ozon Банк», «СБП», «Кошелёк») — отдельные
 * кнопки: тап по «Ozon Банк» ведёт на его отдельный экран (навигационная модель
 * донора Uchi), поэтому здесь у списка нет выбранного состояния.
 */
export function SubscriptionPaymentScreen({
  tenant,
  selectedMethod,
  onSelectMethod,
  ctaState,
  ctaLoadingLabel,
  ctaSentLabel,
  onCta,
  forcedState,
}: ScreenProps) {
  const { content } = tenant;

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cvcVisible, setCvcVisible] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [autorenew, setAutorenew] = useState(
    content.autorenew?.default_checked ?? false,
  );

  const forceError = forcedState === "field_error";
  const digits = cardNumber.replace(/\D/g, "");
  const cardError =
    forceError || (touched.card && digits.length > 0 && digits.length < 16)
      ? COPY["form.error.card_number"]
      : null;
  const expiryError =
    touched.expiry && expiry.length > 0 && !/^\d{2}\/\d{2}$/.test(expiry)
      ? COPY["form.error.expiry"]
      : null;
  const cvcError =
    touched.cvc && cvc.length > 0 && cvc.replace(/\D/g, "").length !== 3
      ? COPY["form.error.cvc"]
      : null;

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
      <ScreenHeader
        style="centered_logo"
        logoText={tenant.brand.logo.text ?? tenant.display_name}
      />

      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{
          paddingInline: "var(--t-page-padding)",
          // Нижний резерв прокрутки: у донора под блоком итогов пустое поле.
          // Sticky-панели больше нет (откат 2026-07-24), CTA вернулась в поток.
          paddingBottom: "var(--k-page-bottom-reserve)",
        }}
      >
        {/* ── Зона 3: навигация назад ТЕКСТОМ ПОД шапкой ────────── */}
        {content.back_link && (
          <button
            type="button"
            data-testid="back-link"
            className="flex items-center"
            style={{
              minHeight: "var(--k-tap-min)",
              gap: "6px",
              background: "none",
              border: "none",
              padding: 0,
              marginTop: "12px",
              color: "var(--t-text-primary)",
              fontSize: "var(--t-font-body)",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", transform: "scale(0.7)" }}>
              <BackChevron />
            </span>
            {content.back_link}
          </button>
        )}

        {/* ── Зона 4: H1 В КОНТЕНТЕ, слева ──────────────────────── */}
        <h1
          data-testid="page-title"
          style={{
            margin: 0,
            marginTop: "8px",
            marginBottom: "16px",
            fontSize: "var(--t-font-h1)",
            fontWeight: "var(--t-title-weight)" as unknown as number,
            textAlign: "left",
            color: "var(--t-text-primary)",
            lineHeight: 1.2,
          }}
        >
          {content.title}
        </h1>

        {/* ── Зона 5: форма карты на тональной подложке ─────────── */}
        {content.form?.enabled && (
          <div
            data-testid="card-form-block"
            className="flex w-full flex-col"
            style={{
              background: "var(--t-surface-form)",
              borderRadius: "var(--t-radius-card)",
              padding: "var(--k-form-pad)",
              gap: "16px",
            }}
          >
            <div className="flex items-center" style={{ gap: "var(--k-scheme-plate-gap)" }}>
              {Array.from({ length: content.form.scheme_plates }).map((_, index) => (
                <NeutralPlate
                  key={index}
                  width="52px"
                  height="var(--k-scheme-plate-h)"
                  style={{ background: "var(--t-surface-card)", opacity: 0.9 }}
                />
              ))}
            </div>

            <TextField
              name="card_number"
              label={COPY["form.card_number.label"]}
              placeholder={COPY["form.card_number.placeholder"]}
              value={cardNumber}
              inputMode="numeric"
              maxLength={19}
              onChange={setCardNumber}
              onBlur={() => setTouched((s) => ({ ...s, card: true }))}
              errorMessage={cardError}
            />

            <div className="flex w-full" style={{ gap: "var(--k-field-col-gap)" }}>
              <TextField
                name="expiry"
                label={COPY["form.expiry.label"]}
                placeholder={COPY["form.expiry.placeholder"]}
                value={expiry}
                inputMode="numeric"
                maxLength={5}
                onChange={setExpiry}
                onBlur={() => setTouched((s) => ({ ...s, expiry: true }))}
                errorMessage={expiryError}
              />
              <TextField
                name="cvc"
                label={COPY["form.cvc.label"]}
                placeholder={COPY["form.cvc.placeholder"]}
                value={cvc}
                type={cvcVisible ? "text" : "password"}
                inputMode="numeric"
                maxLength={3}
                onChange={setCvc}
                onBlur={() => setTouched((s) => ({ ...s, cvc: true }))}
                errorMessage={cvcError}
                trailing={
                  <button
                    type="button"
                    aria-label={
                      cvcVisible ? COPY["form.cvc.toggle.hide"] : COPY["form.cvc.toggle.show"]
                    }
                    onClick={() => setCvcVisible((value) => !value)}
                    className="flex items-center justify-center"
                    style={{
                      width: "var(--k-tap-min)",
                      height: "var(--k-tap-min)",
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--t-text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <EyeOffGlyph />
                  </button>
                }
              />
            </div>
          </div>
        )}

        {/* ── Зона 6: CTA «Оплатить {сумма}» INLINE, под формой карты ──
            Донорское место кнопки (Uchi держит «Оплатить» прямо под формой).
            Это оплата КАРТОЙ; способы оплаты ниже — отдельные кнопки. */}
        <div style={{ marginTop: "16px" }}>
          <PrimaryButton
            label={ctaLabel}
            loadingLabel={ctaLoadingLabel}
            sentLabel={ctaSentLabel}
            state={disabled ? "disabled" : ctaState}
            onClick={onCta}
          />
        </div>

        {/* ── Зона 7: автопродление ─────────────────────────────── */}
        {content.autorenew?.enabled && (
          <div style={{ marginTop: "16px" }}>
            <Checkbox
              label={COPY["autorenew.label"]}
              checked={autorenew}
              onChange={setAutorenew}
            />
          </div>
        )}

        {/* ── Зона 8: промокод ──────────────────────────────────── */}
        {content.promo?.enabled && (
          <div style={{ marginTop: "16px" }}>
            <PromoAccordion />
          </div>
        )}

        {/* ── Зона 9: способы оплаты — навигационная модель донора Uchi ──
            Тап по «Ozon Банк» ведёт на отдельный экран `ozon_rail`, а не
            раскрывает поле инлайн. Поэтому у списка нет выбранного состояния
            (`selected={null}`): основное интерактивное состояние — hover. */}
        <div style={{ marginTop: "16px" }}>
          <PaymentMethodList
            layout={tenant.payment_list.layout}
            methods={tenant.payment_list.methods}
            selected={null}
            onSelect={onSelectMethod}
            padded={false}
          />
        </div>

        {/* ── Зона 10: позиции заказа ───────────────────────────── */}
        {content.line_items.length > 0 && (
          <div className="flex w-full flex-col" style={{ marginTop: "24px", gap: "12px" }}>
            {content.items_title && (
              <h2
                data-testid="items-title"
                style={{
                  margin: 0,
                  marginBottom: "0px",
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: "var(--t-title-weight)" as unknown as number,
                  color: "var(--t-text-primary)",
                }}
              >
                <ResponsiveText
                  full={content.items_title}
                  compact={content.items_title_compact}
                />
              </h2>
            )}
            {content.line_items.map((item, index) => (
              <LineItem key={`${item.title}-${index}`} item={item} index={index} />
            ))}
          </div>
        )}

        {/* ── Зона 11: итоги тремя строками через два разделителя ─ */}
        <div style={{ marginTop: "16px" }}>
          <ThreeRowTotals totals={content.totals} />
        </div>
      </div>

      {/*
       * CTA больше не sticky: вернулась в поток (зона 6, под форму карты) —
       * донорское размещение Uchi. Зона `help_fab` по-прежнему НЕ реализуется
       * (плавающая кнопка помощи удалена решением пользователя 2026-07-23).
       */}
    </div>
  );
}
