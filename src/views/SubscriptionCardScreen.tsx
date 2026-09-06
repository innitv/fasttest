import { type CSSProperties } from "react";

import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton, StickyCtaPanel } from "@demo/components/PrimaryButton";
import { COPY } from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";

/**
 * Архетип `subscription_card`, макет A3 Pay «Карточка подписки · счёт к
 * оплате» (Figma 224:443, снят через Dev Mode 2026-09-06).
 *
 * Подписка уже работает: экран не подключает и не выбирает её, а показывает
 * состояние — счёт к оплате сверху, под ним факты, способ оплаты и действия.
 * Отсюда и порядок: сначала сумма и срок, потом объяснения, потом опасное
 * действие последним.
 *
 * Экран принадлежит платёжному сервису, а подрядчик здесь — предмет
 * подписки: его знак и имя стоят в навбаре и шапке, а материал вокруг
 * (серые карточки, кобальтовая кнопка) — сервиса.
 *
 * Оплата — один шаг, без листа подтверждения: кнопка прибита к низу
 * экрана и запускает ТОТ ЖЕ маршрут, что у остальных тем, — проверка
 * клиентства, push, банк, возврат. Лист из макета 224:504 пробован и снят
 * решением владельца 2026-09-06: со сводкой в листе платёж требовал двух
 * подтверждений подряд, а проверка номера в нём прятала свою ошибку под
 * шторкой. Поле телефона по тому же решению стоит ПРИ способе оплаты —
 * там, где назван банк, которому номер нужен.
 */
export function SubscriptionCardScreen({
  tenant,
  ctaState,
  ctaLoadingLabel,
  ctaSentLabel,
  onCta,
  forcedState,
  phoneGate,
}: ScreenProps) {
  const card = tenant.content.subscription_card;
  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };

  if (!card) return null;

  const factLabel: CSSProperties = {
    fontSize: "var(--t-font-caption)",
    fontWeight: 400,
    lineHeight: 1.38,
    color: "var(--t-text-secondary)",
  };
  const factValue: CSSProperties = {
    fontSize: "var(--t-font-body)",
    fontWeight: "var(--t-title-weight)",
    lineHeight: 1.38,
    color: "var(--t-text-primary)",
  };
  /** Серая карточка — единственный материал экрана: факты, счёт, действия. */
  const group: CSSProperties = {
    background: "var(--t-surface-form)",
    borderRadius: "var(--t-radius-card)",
    paddingInline: "16px",
  };

  return (
    <div
      data-screen-root
      className="relative flex h-full w-full flex-col"
      style={{ background: "var(--t-surface-background)" }}
    >
      {/* ── Зона 1: навбар. Возврат и имя сервиса по центру ───────────
          Статус-бара из макета здесь нет намеренно: системный хром рисует
          устройство, а не демо (правило проекта). */}
      <header
        data-testid="screen-header"
        data-style="back_title"
        className="flex w-full shrink-0 items-center"
        style={{ height: "52px", ...pad, gap: "12px" }}
      >
        <button
          type="button"
          aria-label={COPY["nav.back"]}
          className="tap-press flex shrink-0 items-center justify-center"
          style={{
            width: "var(--k-tap-min)",
            height: "var(--k-tap-min)",
            marginInlineStart: "-12px",
            background: "none",
            border: "none",
            color: "var(--t-text-primary)",
            fontSize: "22px",
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ‹
        </button>
        <span
          className="flex-1 text-center"
          style={{
            fontSize: "17px",
            fontWeight: "var(--t-title-weight)",
            color: "var(--t-text-primary)",
          }}
        >
          {card.nav_title}
        </span>
        <span aria-hidden className="shrink-0" style={{ width: "var(--k-tap-min)" }} />
      </header>

      <div
        data-testid="scroll-container"
        className="no-scrollbar flex-1 overflow-y-auto"
        // Отступ от шапки до контента — 20 (макет A3 Pay). Стоит на
        // контейнере прокрутки, а не внутри первого блока: внутри он
        // складывался с центрированием плитки по строке и мерился
        // как 21.
        style={{
          ...pad,
          paddingTop: "20px",
          paddingBottom: "var(--k-page-bottom-reserve)",
        }}
      >
        {/* ── Зона 2: чья подписка ─────────────────────────────────── */}
        <div
          data-testid="plan-header"
          className="flex items-center"
          style={{ gap: "12px" }}
        >
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "14px",
              background: "var(--t-surface-form)",
              color: "var(--t-brand-primary)",
              fontSize: "18px",
              fontWeight: "var(--t-title-weight)",
              overflow: "hidden",
            }}
          >
            {card.plan_logo ? (
              <img src={card.plan_logo} alt="" width={24} height={24} />
            ) : (
              card.plan_title.slice(0, 1)
            )}
          </span>
          <span className="flex min-w-0 flex-col" style={{ gap: "2px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: "var(--t-title-weight)",
                lineHeight: 1.3,
                color: "var(--t-text-primary)",
              }}
            >
              {card.plan_title}
            </span>
            <span style={factLabel}>{card.plan_caption}</span>
          </span>
        </div>

        {/* ── Зона 3: счёт к оплате. Единственная кнопка экрана ────── */}
        <div
          data-testid="invoice-block"
          className="flex flex-col"
          style={{ ...group, marginTop: "20px", padding: "16px", gap: "12px" }}
        >
          <span className="flex flex-col" style={{ gap: "2px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: "var(--t-title-weight)",
                lineHeight: 1.3,
                color: "var(--t-text-primary)",
              }}
            >
              {card.invoice.title}
            </span>
            <span style={factLabel}>{card.invoice.caption}</span>
          </span>

        </div>

        {/* ── Зона 4: факты о подписке ─────────────────────────────── */}
        {card.facts.length > 0 && (
          <div
            data-testid="facts-block"
            className="flex flex-col"
            style={{ ...group, marginTop: "20px" }}
          >
            {card.facts.map((fact, index) => (
              <div key={fact.label} className="flex flex-col">
                {index > 0 && (
                  <span
                    aria-hidden
                    style={{ height: "1px", background: "var(--t-surface-divider)" }}
                  />
                )}
                <div
                  className="flex items-center justify-between"
                  style={{ height: "50px", gap: "12px" }}
                >
                  <span style={factLabel}>{fact.label}</span>
                  <span style={factValue}>{fact.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Зона 5: чем платят. Чип «Сменить» статичен: способ в демо
            один, и обещать выбор, которого нет, экран не должен. ──── */}
        <div
          data-testid="payment-block"
          className="flex flex-col"
          style={{ ...group, marginTop: "12px" }}
        >
          {/* Строка способа по макету 349:87: плитка с монограммой, название
              с подписью и чип смены. Высота 72 против 50 у строк фактов —
              строка не факт, а объект: она называет то, чем платят, и
              подпись объясняет, что произойдёт. */}
          <div
            data-testid="payment-row"
            className="flex items-center"
            style={{ height: "72px", gap: "12px" }}
          >
            {card.payment.mark && (
              <span
                aria-hidden
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--t-radius-card)",
                  background: "var(--t-surface-card)",
                  fontSize: "var(--t-font-body)",
                  fontWeight: "var(--t-title-weight)",
                  color: "var(--t-text-secondary)",
                }}
              >
                {card.payment.mark}
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col" style={{ gap: "2px" }}>
              <span style={factValue}>{card.payment.value}</span>
              {card.payment.caption && (
                <span style={factLabel}>{card.payment.caption}</span>
              )}
            </span>
            <span
              aria-hidden
              className="flex shrink-0 items-center justify-center"
              style={{
                height: "32px",
                paddingInline: "12px",
                borderRadius: "9999px",
                background: "var(--t-surface-card)",
                fontSize: "var(--t-font-caption)",
                fontWeight: "var(--t-label-weight)",
                color: "var(--t-text-secondary)",
              }}
            >
              {card.payment.pill}
            </span>
          </div>

          {/* Проверка клиентства стоит ПРИ способе оплаты, а не отдельным
              блоком посреди экрана (решение владельца 2026-09-06): номер
              спрашивают ровно там, где назван банк, которому он нужен. */}
          {phoneGate && (
            <div className="flex flex-col">
              <span
                aria-hidden
                style={{ height: "1px", background: "var(--t-surface-divider)" }}
              />
              <div style={{ paddingBottom: "16px" }}>
                <PhoneGateBlock
                  expanded
                  look="card"
                  digits={phoneGate.digits}
                  error={phoneGate.error}
                  checking={phoneGate.checking}
                  onChange={phoneGate.onChange}
                  onSubmit={phoneGate.onSubmit}
                  focusSignal={phoneGate.focusSignal}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Зона 6: действия. Опасное — последним и цветом ошибки ── */}
        {card.actions.length > 0 && (
          <div
            data-testid="actions-block"
            className="flex flex-col"
            style={{ ...group, marginTop: "12px" }}
          >
            {card.actions.map((action, index) => (
              <div key={action.label} className="flex flex-col">
                {index > 0 && (
                  <span
                    aria-hidden
                    style={{ height: "1px", background: "var(--t-surface-divider)" }}
                  />
                )}
                <button
                  type="button"
                  data-testid={"action-" + index}
                  className="flex w-full items-center justify-between"
                  style={{
                    height: "50px",
                    minHeight: "var(--k-tap-min)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: "var(--t-font-body)",
                    fontWeight: 400,
                    color: action.danger
                      ? "var(--t-surface-danger)"
                      : "var(--t-text-primary)",
                  }}
                >
                  {action.label}
                  <span aria-hidden style={{ color: "var(--t-text-secondary)" }}>
                    ›
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Кнопка оплаты прибита к низу (решение владельца 2026-09-06) ──
          Счёт виден с любого места прокрутки, а действие всегда под
          большим пальцем: экран длинный, и кнопка внутри блока счёта
          уезжала за кромку ровно тогда, когда человек дочитывал факты. */}
      <StickyCtaPanel>
        <PrimaryButton
          label={card.invoice.cta_label}
          loadingLabel={ctaLoadingLabel}
          sentLabel={ctaSentLabel}
          state={forcedState === "cta_disabled" ? "disabled" : ctaState}
          onClick={onCta}
          testId="primary-cta"
        />
      </StickyCtaPanel>
    </div>
  );
}
