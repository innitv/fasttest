import { useState } from "react";

import { ChoiceCardRow } from "@demo/components/ChoiceCardRow";
import { DetailRow } from "@demo/components/DetailRow";
import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import {
  PrimaryButton,
  STICKY_PANEL_RESERVE,
  StickyCtaPanel,
} from "@demo/components/PrimaryButton";
import { ResponsiveText, SurfaceCard } from "@demo/components/primitives";
import { ScreenHeader } from "@demo/components/ScreenHeader";
import { SegmentControl } from "@demo/components/SegmentControl";
import { SingleRowTotals } from "@demo/components/TotalsBlock";
import { COPY, resolveCtaLabel } from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";

/**
 * `S-A` — архетип `cart_checkout`, калибровочная крайность 1.
 *
 * Секции full-bleed от края до края (расхождение D11); поля применяются к
 * содержимому ВНУТРИ секции. Инсетные карточки-секции — анти-паттерн R1,
 * они мгновенно читаются как чужой бутстрап-шаблон.
 */
export function CartCheckoutScreen({
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
  const [fulfillmentChoice, setFulfillmentChoice] = useState(
    content.fulfillment?.selected ?? "",
  );

  const delta =
    content.fulfillment?.options.find((option) => option.id === fulfillmentChoice)
      ?.price_delta ?? 0;

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount + delta,
  );

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  // Донор может держать кнопку в потоке под итогом (MONOCHROME), а не липкой
  // панелью внизу. Резерв прокрутки нужен только под липкую: под кнопкой в
  // потоке он оставляет пустую полосу.
  const inlineCta = tenant.cta.placement === "inline";

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
      {/*
        `relative` здесь обязателен, а не декоративен. Скролл-контейнер
        обрезает только тех потомков, для которых он является содержащим
        блоком: абсолютно позиционированный элемент (например, визуально
        скрытый `.sr-only` блока проверки телефона) при статичном контейнере
        привязывается к корню экрана, уходит из-под обрезки и раздувает
        scrollHeight КОЛОНКИ. Колонка с `overflow: hidden` от этого становится
        программно прокручиваемой, и первый же `scrollIntoView`/`focus`
        сдвигает весь экран вверх — диагноз бага «страница сжимается, низ
        подтягивается, пуш обрезан сверху» на Flowwow.
      */}
      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{
          paddingBottom: inlineCta
            ? "var(--k-page-bottom-reserve)"
            : STICKY_PANEL_RESERVE,
        }}
      >
        <ScreenHeader style="back_title" title={content.title} />

        {content.segments && (
          <div
            style={{
              paddingInline: "var(--t-page-padding)",
              paddingBlock: "var(--t-block-gap)",
            }}
          >
            <SegmentControl
              items={content.segments.items}
              active={content.segments.active}
              badge={content.segments.badge}
            />
          </div>
        )}

        <div className="flex w-full flex-col" style={{ gap: "var(--t-block-gap)" }}>
          {/* ── Зона 4: реквизиты ─────────────────────────────────── */}
          {content.rows.length > 0 && (
            <SurfaceCard
              testId="details-card"
              style={{
                paddingInline: "var(--t-page-padding)",
                paddingBlock: "8px",
              }}
            >
              {content.rows.map((row, index) => (
                <DetailRow
                  key={`${row.label}-${index}`}
                  label={row.label}
                  labelCompact={row.label_compact}
                  value={row.value}
                  isAction={row.is_action}
                  layout={tenant.detail_rows.layout}
                  testId={`detail-row-${index + 1}`}
                />
              ))}
            </SurfaceCard>
          )}

          {/* ── Зона 5: доставка ──────────────────────────────────── */}
          {content.fulfillment && (
            <SurfaceCard testId="fulfillment-card" style={{ paddingBlock: "8px" }}>
              <div style={{ paddingInline: "var(--t-page-padding)" }}>
                <DetailRow
                  label={content.fulfillment.title}
                  value={content.fulfillment.value}
                  testId="fulfillment-row"
                />
              </div>

              <div style={{ paddingBottom: "12px" }}>
                <ChoiceCardRow
                  options={content.fulfillment.options}
                  selected={fulfillmentChoice}
                  onSelect={setFulfillmentChoice}
                  groupLabel={content.fulfillment.title}
                />
              </div>

              <div style={{ paddingInline: "var(--t-page-padding)" }}>
                <DetailRow
                  label={COPY["extras.label"]}
                  value={COPY["extras.value"]}
                  isAction
                  testId="extras-row"
                />
                {content.fulfillment.extras_hint && (
                  <p
                    data-testid="extras-hint"
                    style={{
                      margin: 0,
                      paddingBottom: "8px",
                      fontSize: "var(--t-font-caption)",
                      lineHeight: 1.35,
                      color: "var(--t-text-secondary)",
                    }}
                  >
                    <ResponsiveText
                      full={content.fulfillment.extras_hint}
                      compact={content.fulfillment.extras_hint_compact}
                    />
                  </p>
                )}
              </div>
            </SurfaceCard>
          )}

          {/* ── Зона 6: способы оплаты — точка вставки «Ozon Банк» ── */}
          <SurfaceCard testId="payment-block" style={{ paddingBlock: "var(--t-page-padding)" }}>
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
              {tenant.payment_list.section_title ?? COPY["payment.section_title"]}
            </h2>
            <PaymentMethodList
              layout={tenant.payment_list.layout}
              methods={tenant.payment_list.methods}
              selected={selectedMethod}
              onSelect={onSelectMethod}
              padded
            />

            {/* Проверка телефона: внутри карточки оплаты, между рядом
                карточек и нижним отступом. Раскрытие читается как часть
                блока оплаты, а не как новая секция. */}
            {phoneGate && (
              <div style={{ paddingInline: "var(--t-page-padding)" }}>
                <PhoneGateBlock {...phoneGate} />
              </div>
            )}
          </SurfaceCard>

          {/* ── Зона 7: итог одной строкой ────────────────────────── */}
          <SurfaceCard
            testId="total-row"
            style={{ paddingInline: "var(--t-page-padding)" }}
          >
            <SingleRowTotals totals={content.totals} delta={delta} />
          </SurfaceCard>

          {inlineCta && (
            <div style={{ paddingInline: "var(--t-page-padding)" }}>{ctaButton}</div>
          )}
        </div>
      </div>

      {/* ── Зона 8: CTA — липкая панель или кнопка в потоке ─────── */}
      {!inlineCta && <StickyCtaPanel>{ctaButton}</StickyCtaPanel>}
    </div>
  );
}
