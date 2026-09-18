import { Fragment, useId, useState, type CSSProperties } from "react";
import { AnimatePresence, m } from "framer-motion";

import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import {
  COPY,
  formatMoney,
  methodAccessibleName,
  resolveCtaLabel,
} from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";
import { SHEET_OVERLAY_SPEC, SHEET_SCRIM_SPEC } from "./stage-motion";

/**
 * Архетип `booking_payment`, донор Onlinetours (страница оплаты брони тура,
 * снята 2026-09-18 в профиле 375×812).
 *
 * Экран — ПОСЛЕДНИЙ ШАГ ОФОРМЛЕНИЯ, а не отдельная страница оплаты: сверху
 * степпер «Детали тура — Данные туристов — Оплата», под ним свёрнутая
 * карточка брони, и только потом способ и сумма. Поэтому ни одного поля
 * сбора данных: их собрали на прошлых шагах.
 *
 * Модель выбора донора: выбранный способ стоит отдельной строкой со ссылкой
 * «Изменить», а список открывается его собственной нижней шторкой — радио
 * без кнопки подтверждения, нажатие на строку и есть выбор. «Ozon Банк»
 * встаёт первой позицией в этот список, демо не достраивает своей шторки.
 *
 * Чего у донора не воспроизводим: платёжный блок с QR СБП. У донора он
 * живёт в чужом фрейме и ведёт в приложение банка по коду; в демо на его
 * месте наш рельс — сумма и кнопка (решение владельца 2026-09-18). QR в
 * демо никуда не ведёт, а маршрут через банк — то, ради чего демо и есть.
 */
export function BookingPaymentScreen({
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
  const booking = content.booking;
  const [sheetOpen, setSheetOpen] = useState(forcedState === "promo_open");
  const sheetTitleId = useId();

  if (!booking) return null;

  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };
  const muted: CSSProperties = {
    fontSize: "var(--t-font-caption)",
    fontWeight: "var(--t-label-weight)",
    lineHeight: 1.4,
    color: "var(--t-text-secondary)",
  };
  /** Белая карточка на сером поле — единственный материал экрана. */
  const card: CSSProperties = {
    background: "var(--t-surface-card)",
    borderRadius: "var(--t-radius-card)",
  };

  const method =
    tenant.payment_list.methods.find((item) => item.id === selectedMethod) ?? null;
  const payable = content.totals.sum - content.totals.discount;
  const amount = formatMoney(payable);
  const ctaLabel = resolveCtaLabel(tenant.cta.label, tenant.cta.include_amount, payable);

  return (
    <div
      data-screen-root
      className="relative flex h-full w-full flex-col"
      style={{ background: "var(--t-surface-background)" }}
    >
      {/* ── Зона 1: шапка сайта. Знак подрядчика и телефон ──────────── */}
      <header
        data-testid="screen-header"
        data-style="centered_logo"
        className="flex w-full shrink-0 items-center justify-between"
        style={{ height: "48px", ...pad, background: "var(--t-surface-card)" }}
      >
        {content.header_logo ? (
          // Знак донора картинкой: пересобирать его текстом значит рисовать
          // другой логотип. Размер — как на сайте, 160×24.
          <img
            src={content.header_logo}
            alt={tenant.display_name}
            width={160}
            height={24}
            style={{ width: "160px", height: "24px", display: "block" }}
          />
        ) : (
          <span
            style={{
              fontSize: "20px",
              fontWeight: "var(--t-title-weight)",
              letterSpacing: "-0.01em",
              color: "var(--t-text-primary)",
            }}
          >
            {tenant.brand.logo.text ?? tenant.display_name}
          </span>
        )}
        {booking.support_phone && (
          <span style={{ fontSize: "12px", color: "var(--t-text-primary)" }}>
            {booking.support_phone}
          </span>
        )}
      </header>

      <div
        data-testid="scroll-container"
        className="no-scrollbar flex-1 overflow-y-auto"
        style={{ ...pad, paddingBottom: "var(--k-page-bottom-reserve)" }}
      >
        {/* ── Зона 2: степпер оформления ───────────────────────────────
            Устроен как у донора и НЕ так, как кажется по кадру: сквозь всю
            ширину идёт одна серая линия 2 px, а подписи лежат поверх неё и
            «вырезают» её собственным фоном страницы. Ни цвета текущего
            шага, ни отдельных сегментов у донора нет — положение читается
            только тем, какие подписи стоят слева и справа.
            Замер 2026-09-18 (375×812): полоса x26 w323 h50, линия y72,
            подписи 12/600 чёрные, поле подписи 0 12. */}
        <ol
          data-testid="booking-steps"
          className="relative flex w-full items-center justify-between"
          style={{
            height: "50px",
            margin: 0,
            padding: "0 17px 0 2px",
            listStyle: "none",
          }}
        >
          <span
            aria-hidden
            className="absolute"
            style={{
              left: "2px",
              right: "17px",
              top: "24px",
              height: "2px",
              background: "var(--t-surface-track)",
            }}
          />
          {booking.steps.map((step, index) => (
            <li
              key={step.label}
              aria-current={step.done ? undefined : "step"}
              className="relative"
              style={{
                fontSize: "12px",
                fontWeight: "var(--t-emphasis-weight)",
                lineHeight: "14px",
                color: "var(--t-text-primary)",
                background: "var(--t-surface-background)",
                padding: "0 12px",
                // Крайние подписи «съедают» собственное поле: у донора текст
                // первого шага начинается почти от кромки колонки.
                marginInlineStart: index === 0 ? "-12px" : undefined,
                marginInlineEnd:
                  index === booking.steps.length - 1 ? "-12px" : undefined,
                whiteSpace: "nowrap",
              }}
            >
              {step.label}
            </li>
          ))}
        </ol>

        {/* ── Зона 3: что оплачивается. Карточка брони ────────────────
            Шеврон статичен: разворачивать нечего — детали брони собраны на
            прошлом шаге, и обещать переход, которого в демо нет, экран не
            должен. */}
        <div
          data-testid="booking-card"
          className="flex items-center"
          style={{ ...card, padding: "12px 20px", gap: "12px", minHeight: "92px" }}
        >
          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: "2px" }}>
            <span
              style={{
                fontSize: "var(--t-font-body)",
                fontWeight: "var(--t-title-weight)",
                lineHeight: 1.5,
                color: "var(--t-text-primary)",
              }}
            >
              {booking.card.title}
            </span>
            {booking.card.lines.map((line) => (
              <span key={line} style={muted}>
                {line}
              </span>
            ))}
          </span>
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center"
            style={{
              width: "40px",
              height: "40px",
              fontSize: "28px",
              lineHeight: 1,
              color: "var(--t-text-primary)",
            }}
          >
            ›
          </span>
        </div>

        {/* ── Зона 4: способ оплаты строкой со ссылкой «Изменить» ───── */}
        <h1
          style={{
            margin: "16px 0 12px",
            fontSize: "var(--t-font-h1)",
            fontWeight: "var(--t-title-weight)",
            lineHeight: 1.5,
            color: "var(--t-text-primary)",
          }}
        >
          {booking.section_title}
        </h1>

        <button
          type="button"
          data-testid="open-payment-sheet"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center"
          style={{
            ...card,
            border: "none",
            minHeight: "68px",
            padding: "12px 16px",
            gap: "12px",
            textAlign: "left",
            cursor: "pointer",
            borderRadius: "var(--t-radius-control)",
          }}
        >
          {method && <MethodMark label={method.label} src={method.logo_src} />}
          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: "0px" }}>
            <span
              style={{
                fontSize: "var(--t-font-body)",
                fontWeight: "var(--t-label-weight)",
                lineHeight: 1.5,
                color: "var(--t-text-primary)",
              }}
            >
              {method ? method.label : tenant.payment_list.section_title}
            </span>
            {method?.caption && <span style={muted}>{method.caption}</span>}
          </span>
          <span
            aria-hidden
            style={{
              fontSize: "var(--t-font-caption)",
              fontWeight: "var(--t-label-weight)",
              color: "var(--t-link, var(--t-text-primary))",
              whiteSpace: "nowrap",
            }}
          >
            {booking.change_label}
          </span>
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center"
            style={{
              width: "24px",
              // Зазор до «Изменить» у донора 2, а не общий 12: шеврон почти
              // прижат к ссылке, а не отстоит от неё как отдельный элемент.
              marginInlineStart: "-10px",
              fontSize: "24px",
              lineHeight: 1,
              color: "var(--t-text-primary)",
            }}
          >
            ›
          </span>
        </button>

        {/* ── Зона 5: проверка клиентства. Появляется при выборе банка ── */}
        {phoneGate && phoneGate.expanded && (
          <div
            style={{
              ...card,
              marginTop: "12px",
              padding: "0 16px 12px",
              borderRadius: "var(--t-radius-control)",
            }}
          >
            <PhoneGateBlock
              expanded={phoneGate.expanded}
              digits={phoneGate.digits}
              error={phoneGate.error}
              checking={phoneGate.checking}
              onChange={phoneGate.onChange}
              onSubmit={phoneGate.onSubmit}
              focusSignal={phoneGate.focusSignal}
            />
          </div>
        )}

        {/* ── Зона 6: сумма и кнопка. На месте QR-блока донора ──────── */}
        <div
          data-testid="pay-block"
          className="flex flex-col"
          style={{
            ...card,
            marginTop: "16px",
            padding: "20px 16px",
            gap: "16px",
            // Платёжный блок донора скруглён сильнее остальных карточек: 30.
            borderRadius: "30px",
          }}
        >
          <span className="flex items-baseline" style={{ gap: "8px" }}>
            <span
              style={{
                fontSize: "var(--t-font-h1)",
                fontWeight: "var(--t-title-weight)",
                color: "var(--t-text-primary)",
              }}
            >
              {booking.amount_label}
            </span>
            <span
              data-testid="pay-amount"
              style={{
                fontSize: "var(--t-font-price)",
                fontWeight: "var(--t-title-weight)",
                color: "var(--t-text-primary)",
              }}
            >
              {amount}
            </span>
          </span>

          <PrimaryButton
            label={ctaLabel}
            loadingLabel={ctaLoadingLabel}
            sentLabel={ctaSentLabel}
            state={forcedState === "cta_disabled" ? "disabled" : ctaState}
            onClick={onCta}
            testId="primary-cta"
          />
        </div>
      </div>

      {/* ── Шторка выбора способа: СВОЯ у донора ──────────────────────
          Затемнение и лист — соседи в дереве, а не вложенные узлы
          (`FIXES.md`, баг 17). Кнопки подтверждения нет: у донора нажатие
          на строку и есть выбор, шторка закрывается сразу. */}
      <AnimatePresence>
        {sheetOpen ? (
          <Fragment key="booking-sheet">
            <m.div
              className="absolute inset-0 z-20"
              data-testid="payment-sheet-scrim"
              style={{ background: "rgba(0, 0, 0, 0.4)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={SHEET_SCRIM_SPEC}
            >
              <button
                type="button"
                aria-label={COPY["a11y.sheet_close"]}
                onClick={() => setSheetOpen(false)}
                className="absolute inset-0 h-full w-full"
                style={{ background: "none", border: "none", cursor: "default" }}
              />
            </m.div>

            <m.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
              data-testid="payment-sheet"
              className="absolute inset-x-0 bottom-0 z-20 flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SHEET_OVERLAY_SPEC}
              style={{
                background: "var(--t-surface-card)",
                borderRadius: "var(--t-radius-sheet) var(--t-radius-sheet) 0 0",
                padding: "0 16px calc(24px + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ height: "60px", gap: "8px" }}
              >
                <h2
                  id={sheetTitleId}
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "var(--t-title-weight)",
                    color: "var(--t-text-primary)",
                  }}
                >
                  {content.payment_sheet?.title ?? booking.section_title}
                </h2>
                <button
                  type="button"
                  aria-label={COPY["a11y.sheet_close"]}
                  data-testid="payment-sheet-close"
                  onClick={() => setSheetOpen(false)}
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: "28px",
                    height: "28px",
                    minWidth: "var(--k-tap-min)",
                    minHeight: "var(--k-tap-min)",
                    borderRadius: "9999px",
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--t-text-secondary)",
                    fontSize: "18px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <div role="radiogroup" aria-labelledby={sheetTitleId} className="flex flex-col">
                {tenant.payment_list.methods.map((item, index) => {
                  const active = item.id === selectedMethod;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={methodAccessibleName(item.label, active)}
                      data-testid={`sheet-method-${item.id}`}
                      onClick={() => {
                        onSelectMethod(item.id);
                        setSheetOpen(false);
                      }}
                      className="flex w-full items-center"
                      style={{
                        minHeight: "60px",
                        marginTop: index === 0 ? "0px" : "16px",
                        background: "none",
                        border: "none",
                        padding: 0,
                        gap: "12px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <MethodMark label={item.label} src={item.logo_src} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          style={{
                            fontSize: "var(--t-font-body)",
                            fontWeight: "var(--t-label-weight)",
                            lineHeight: 1.5,
                            color: "var(--t-text-primary)",
                          }}
                        >
                          {item.label}
                        </span>
                        {item.caption && <span style={muted}>{item.caption}</span>}
                      </span>
                      {/* Радио донора: круг 24 с обводкой 2, точка 12. */}
                      <span
                        aria-hidden
                        className="flex shrink-0 items-center justify-center"
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "9999px",
                          border: `2px solid ${
                            active ? "var(--t-brand-primary)" : "var(--t-surface-track)"
                          }`,
                        }}
                      >
                        {active && (
                          <span
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "9999px",
                              background: "var(--t-brand-primary)",
                            }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </m.div>
          </Fragment>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Знак способа оплаты 32×32.
 *
 * Знаки, которые донор отдаёт файлом (СБП, платёжная карта), берутся
 * картинкой — пересобирать их разметкой значит рисовать другой знак. Там,
 * где файла нет, остаётся монограмма на плитке: то же решение, что в макете
 * A3 Pay («Плитка поставщика 44» для брендов без доступного SVG).
 * Геометрия одна в обоих случаях: 32 + зазор 12 дают текст от x72.
 */
function MethodMark({ label, src }: { label: string; src: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        className="shrink-0"
        style={{ width: "32px", height: "32px", display: "block" }}
      />
    );
  }

  const letters = label
    .replace(/[«»"]/g, "")
    .split(/\s+/)
    .filter((word) => /^[A-Za-zА-Яа-яЁё]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center"
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        background: "var(--t-surface-form)",
        color: "var(--t-text-secondary)",
        fontSize: "12px",
        fontWeight: "var(--t-emphasis-weight)",
        letterSpacing: "0.02em",
      }}
    >
      {letters || "•"}
    </span>
  );
}
