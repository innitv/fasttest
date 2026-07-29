import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { ScreenHeader } from "@demo/components/ScreenHeader";
import { CheckGlyph } from "@demo/components/primitives";
import { COPY, formatMoney, resolveCtaLabel } from "@demo/content/copy";
import { OZON_METHOD_ID } from "@demo/theme/tenant.schema";
import type { ScreenProps } from "./screen-props";

/**
 * `S-F` — архетип `plan_sheet`, пятая калибровочная крайность.
 *
 * Донор — страница абонементов, где ВСЕ тарифы запечены в картинки, а
 * кнопки под ними ничего не открывают: экрана оплаты у него нет вовсе.
 * Поэтому оплата здесь не «встраивается в существующий экран», а
 * достраивается в его языке: тарифы становятся читаемыми карточками на
 * тёмной подложке, а выбор способа и главная кнопка уезжают в ШТОРКУ,
 * которую поднимает кнопка тарифа.
 *
 * Почему шторка, а не отдельный экран: у донора вся страница — вертикаль
 * из пяти афиш, и уход с неё рвёт сравнение тарифов, ради которого
 * страница и сделана. Шторка оставляет список на месте.
 */
export function PlanSheetScreen({
  tenant,
  selectedMethod,
  onSelectMethod,
  ctaState,
  ctaLoadingLabel,
  ctaSentLabel,
  onCta,
  forcedState,
  phoneGate,
  onSelectAmount,
}: ScreenProps) {
  const { content } = tenant;

  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const openPlan = content.plans.find((plan) => plan.id === openPlanId) ?? null;

  const sheetSum = openPlan?.sum ?? content.totals.sum - content.totals.discount;

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    sheetSum,
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
          paddingBottom: "var(--k-page-bottom-reserve)",
        }}
      >
        <h1
          data-testid="page-title"
          style={{
            margin: "16px 0 0",
            fontSize: "var(--t-font-h1)",
            fontWeight: "var(--t-title-weight)" as unknown as number,
            color: "var(--t-text-primary)",
            lineHeight: 1.25,
          }}
        >
          {content.title}
        </h1>

        <div
          className="flex w-full flex-col"
          style={{ marginTop: "16px", gap: "var(--t-section-gap)" }}
        >
          {content.plans.map((plan) => (
            <article
              key={plan.id}
              data-testid={`plan-card-${plan.id}`}
              className="flex w-full flex-col"
              style={{
                /*
                 * Тёмная подложка берётся из `brand.tonal`, а текст на ней —
                 * из посчитанной движком пары `--t-brand-tonal-on`. Прямой
                 * `text_primary` здесь нечитаем: страница донора светлая, а
                 * карточки тёмные, и один цвет текста не обслуживает оба.
                 */
                background: "var(--t-brand-tonal)",
                color: "var(--t-brand-tonal-on)",
                borderRadius: "var(--t-radius-card)",
                boxShadow: "var(--t-shadow)",
                padding: "var(--t-page-padding)",
                gap: "12px",
              }}
            >
              <div className="flex w-full items-start justify-between" style={{ gap: "12px" }}>
                <div className="flex min-w-0 flex-col" style={{ gap: "4px" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "var(--t-font-section-title)",
                      fontWeight: "var(--t-title-weight)" as unknown as number,
                      textTransform: "uppercase",
                      lineHeight: 1.2,
                    }}
                  >
                    {plan.title}
                  </h2>
                  {plan.caption && (
                    <span
                      style={{
                        fontSize: "var(--t-font-caption)",
                        opacity: 0.72,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {plan.caption}
                    </span>
                  )}
                </div>
                <span
                  data-testid={`plan-price-${plan.id}`}
                  style={{
                    fontSize: "var(--t-font-body)",
                    fontWeight: "var(--t-label-weight)" as unknown as number,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatMoney(plan.sum)}
                </span>
              </div>

              {plan.features.length > 0 && (
                <ul
                  className="flex w-full flex-col"
                  style={{ margin: 0, padding: 0, listStyle: "none", gap: "6px" }}
                >
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center"
                      style={{ gap: "8px", fontSize: "var(--t-font-caption)", opacity: 0.86 }}
                    >
                      <span style={{ display: "flex", color: "var(--t-brand-primary)" }}>
                        <CheckGlyph size={10} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              )}

              <div style={{ marginTop: "4px" }}>
                <PrimaryButton
                  label={content.plan_cta_label ?? tenant.cta.label}
                  loadingLabel={ctaLoadingLabel}
                  state="default"
                  onClick={() => { setOpenPlanId(plan.id); onSelectAmount?.(plan.sum); }}
                  testId={`plan-cta-${plan.id}`}
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* ── Шторка оплаты ─────────────────────────────────────────── */}
      <AnimatePresence>
        {openPlan && (
          <>
            <motion.div
              data-testid="sheet-scrim"
              className="absolute inset-0"
              style={{ background: "rgba(10, 12, 16, 0.56)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpenPlanId(null)}
            />
            <motion.section
              data-testid="payment-sheet"
              role="dialog"
              aria-label={content.sheet_title ?? COPY["payment.section_title"]}
              className="absolute inset-x-0 bottom-0 flex flex-col"
              style={{
                background: "var(--t-surface-card)",
                borderTopLeftRadius: "var(--t-radius-card)",
                borderTopRightRadius: "var(--t-radius-card)",
                padding: "var(--t-page-padding)",
                paddingBottom: "calc(var(--t-page-padding) + var(--k-safe-bottom, 0px))",
                gap: "12px",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              {/* Ручка шторки — единственный намёк на то, что её можно закрыть. */}
              <span
                aria-hidden
                style={{
                  alignSelf: "center",
                  width: "36px",
                  height: "4px",
                  borderRadius: "999px",
                  background: "var(--t-surface-border)",
                }}
              />

              <div className="flex w-full items-start justify-between" style={{ gap: "12px" }}>
                <div className="flex min-w-0 flex-col" style={{ gap: "2px" }}>
                  <span
                    style={{
                      fontSize: "var(--t-font-caption)",
                      color: "var(--t-text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {content.sheet_title ?? COPY["payment.section_title"]}
                  </span>
                  <h2
                    data-testid="sheet-plan-title"
                    style={{
                      margin: 0,
                      fontSize: "var(--t-font-section-title)",
                      fontWeight: "var(--t-title-weight)" as unknown as number,
                      color: "var(--t-text-primary)",
                      lineHeight: 1.2,
                    }}
                  >
                    {openPlan.title}
                  </h2>
                </div>
                <span
                  data-testid="totals-value"
                  style={{
                    fontSize: "var(--t-font-section-title)",
                    fontWeight: "var(--t-title-weight)" as unknown as number,
                    color: "var(--t-text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatMoney(sheetSum)}
                </span>
              </div>

              <PaymentMethodList
                layout={tenant.payment_list.layout}
                methods={tenant.payment_list.methods}
                selected={selectedMethod}
                onSelect={onSelectMethod}
                padded={false}
                renderAfter={(methodId) =>
                  phoneGate && methodId === OZON_METHOD_ID ? (
                    <div style={{ paddingInline: "16px", paddingBottom: "4px" }}>
                      <PhoneGateBlock {...phoneGate} />
                    </div>
                  ) : null
                }
              />

              <PrimaryButton
                label={ctaLabel}
                loadingLabel={ctaLoadingLabel}
                sentLabel={ctaSentLabel}
                state={disabled ? "disabled" : ctaState}
                onClick={onCta}
              />
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
