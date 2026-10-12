import { Fragment, useId, useState, type CSSProperties } from "react";
import { AnimatePresence, m } from "framer-motion";

import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { COPY, formatMoney, methodAccessibleName } from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";
import { SHEET_OVERLAY_SPEC, SHEET_SCRIM_SPEC } from "./stage-motion";

/**
 * Архетип `order_tracker`, донор НДФЛка (страница активного заказа в личном
 * кабинете, снята 2026-10-12 в профиле 425×1091, UA мобильный).
 *
 * Экран — КАБИНЕТ, а не чекаут: заказ уже оформлен, оплата первый шаг из
 * пяти, и страница продолжает жить после неё — проверка документов, договор,
 * перевод денег. Отсюда три вещи, которых нет в других архетипах: карточка
 * заказа с номером и датой, вертикальный список шагов-карточек, где у
 * текущего горит бейдж прогресса, а между ними стоят карточки ДЕЛ
 * пользователя, и нижний таб-бар приложения.
 *
 * Модель оплаты донора: на экране только кнопка «Оплатить», а весь выбор —
 * в его собственной шторке, где каждый способ это КНОПКА фирменного цвета со
 * знаком слева, суммой справа и стрелкой. Нажатие не «выбирает», а уводит в
 * оплату — второго шага у донора нет. «Ozon Банк» встаёт в этот список
 * второй позицией (решение владельца 2026-10-12), демо не достраивает своей
 * шторки.
 *
 * Чего у донора не воспроизводим: уход на платёжный шлюз по нажатию кнопки.
 * На его месте наш рельс — проверка номера и оплата появляются карточкой под
 * заказом, то есть там же, куда донор вернул бы пользователя после шлюза.
 */
export function OrderTrackerScreen({
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
  const tracker = content.tracker;
  const [sheetOpen, setSheetOpen] = useState(forcedState === "promo_open");
  const sheetTitleId = useId();

  if (!tracker) return null;

  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };
  const payable = content.totals.sum - content.totals.discount;
  const amount = formatMoney(payable);
  const method =
    tenant.payment_list.methods.find((item) => item.id === selectedMethod) ?? null;
  const sheet = content.payment_sheet;

  /** Карточка донора: белая, обводка 1 и радиус 16 — единственный материал. */
  const card: CSSProperties = {
    background: "var(--t-surface-card)",
    border: "1px solid var(--t-surface-border)",
    borderRadius: "var(--t-radius-card)",
    padding: "16px",
  };
  /** Метаданные строки: слабее вторичного текста — у донора это свой серый. */
  const muted: CSSProperties = {
    fontSize: "var(--t-font-caption)",
    fontWeight: "var(--t-label-weight)",
    lineHeight: 1.3,
    color: "var(--t-text-muted)",
  };
  const caption: CSSProperties = {
    fontSize: "var(--t-font-caption)",
    fontWeight: "var(--t-label-weight)",
    lineHeight: 1.3,
    color: "var(--t-text-secondary)",
  };

  return (
    <div
      data-screen-root
      className="relative flex h-full w-full flex-col"
      style={{ background: "var(--t-surface-background)" }}
    >
      {/* ── Зона 1: шапка кабинета. Знак слева, аватар справа ───────── */}
      <header
        data-testid="screen-header"
        data-style="logo_account"
        className="flex w-full shrink-0 items-center justify-between"
        style={{ height: "66px", ...pad, background: "var(--t-surface-card)" }}
      >
        {content.header_logo ? (
          <img
            src={content.header_logo}
            alt={tenant.display_name}
            width={146}
            height={29}
            style={{ width: "146px", height: "29px", display: "block" }}
          />
        ) : (
          <span
            style={{
              fontSize: "var(--t-font-h1)",
              fontWeight: "var(--t-title-weight)",
              color: "var(--t-text-primary)",
            }}
          >
            {tenant.brand.logo.text ?? tenant.display_name}
          </span>
        )}
        {/*
         * Аватар донора — фотография пользователя. В демо на её месте круг
         * той же геометрии: чужое лицо в макете это чужие персональные
         * данные, а размер держит шапку.
         */}
        <span
          aria-hidden
          className="flex shrink-0 items-center justify-center"
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "9999px",
            background: "var(--t-surface-form)",
            color: "var(--t-text-secondary)",
            fontSize: "var(--t-font-caption)",
            fontWeight: "var(--t-emphasis-weight)",
          }}
        >
          И
        </span>
      </header>

      <div
        data-testid="scroll-container"
        className="no-scrollbar flex-1 overflow-y-auto"
        style={{ ...pad, paddingBottom: "var(--k-page-bottom-reserve)" }}
      >
        {/* ── Зона 2: раздел кабинета ──────────────────────────────── */}
        <h1
          className="flex items-center"
          style={{
            margin: "16px 0 0",
            gap: "4px",
            fontSize: "var(--t-font-price)",
            fontWeight: "var(--t-emphasis-weight)",
            lineHeight: 1.3,
            color: "var(--t-text-primary)",
          }}
        >
          <span aria-hidden style={{ fontSize: "20px", lineHeight: 1 }}>
            ‹
          </span>
          {tracker.back_label}
        </h1>

        {/* ── Зона 3: карточка заказа ──────────────────────────────── */}
        <section data-testid="order-card" style={{ ...card, marginTop: "16px" }}>
          <div
            data-testid="order-meta"
            className="flex items-center justify-between"
            style={{ gap: "8px" }}
          >
            <span style={muted}>{tracker.order.number}</span>
            <span style={muted}>{tracker.order.date}</span>
          </div>
          <h2
            style={{
              margin: "8px 0 0",
              fontSize: "var(--t-font-h1)",
              fontWeight: "var(--t-emphasis-weight)",
              lineHeight: 1,
              color: "var(--t-text-primary)",
            }}
          >
            {tracker.order.service}
          </h2>

          {/* Плашка объясняет КНОПКУ, поэтому стоит над ней, а не над заказом. */}
          <p
            data-testid="order-hint"
            style={{
              margin: "16px 0 0",
              padding: "12px",
              borderRadius: "var(--t-radius-field)",
              background: "var(--t-surface-form)",
              fontSize: "var(--t-font-body)",
              lineHeight: 1.3,
              color: "var(--t-text-primary)",
            }}
          >
            {tracker.hint}
          </p>

          <button
            type="button"
            data-testid="open-payment-sheet"
            onClick={() => setSheetOpen(true)}
            className="flex w-full items-center justify-center"
            style={{
              marginTop: "12px",
              height: "var(--t-control-height)",
              minHeight: "var(--k-tap-min)",
              borderRadius: "var(--t-radius-control)",
              border: "none",
              background: "var(--t-brand-primary)",
              color: "var(--t-brand-on)",
              fontSize: "var(--t-font-body)",
              fontWeight: "var(--t-emphasis-weight)",
              cursor: "pointer",
            }}
          >
            {tenant.payment_list.section_title}
          </button>
        </section>

        {/* ── Зона 4: наш рельс на месте ухода на шлюз ──────────────── */}
        {phoneGate && phoneGate.expanded && (
          <section
            data-testid="pay-block"
            style={{ ...card, marginTop: "12px", padding: "4px 16px 16px" }}
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
            <div
              className="flex items-center justify-between"
              style={{ marginTop: "12px", gap: "8px" }}
            >
              <span style={caption}>{method?.label ?? tenant.ozon.label}</span>
              <span
                data-testid="pay-amount"
                style={{
                  fontSize: "var(--t-font-body)",
                  fontWeight: "var(--t-emphasis-weight)",
                  color: "var(--t-text-primary)",
                }}
              >
                {amount}
              </span>
            </div>
            <div style={{ marginTop: "12px" }}>
              <PrimaryButton
                label={`${tenant.cta.label} ${amount}`}
                loadingLabel={ctaLoadingLabel}
                sentLabel={ctaSentLabel}
                state={forcedState === "cta_disabled" ? "disabled" : ctaState}
                onClick={onCta}
                testId="primary-cta"
              />
            </div>
          </section>
        )}

        {/* ── Зона 5: шаги услуги и дела пользователя ───────────────── */}
        <div className="flex flex-col" style={{ marginTop: "16px", gap: "12px" }}>
          {tracker.steps.map((step, index) => (
            <Fragment key={step.title}>
              <article data-testid={`tracker-step-${index + 1}`} style={card}>
                <div className="flex items-center" style={{ gap: "4px" }}>
                  {/*
                   * Знак шага — файл донора, а НОМЕР живёт внутри заголовка
                   * строкой («1. Формирование заказа»): у донора это одна
                   * строка текста, и кружок с цифрой на месте знака читается
                   * нарисованным вместо снятого.
                   */}
                  <StepMark src={step.icon} />
                  <h3
                    className="min-w-0 flex-1"
                    style={{
                      margin: 0,
                      fontSize: "var(--t-font-body)",
                      fontWeight: "var(--t-emphasis-weight)",
                      lineHeight: 1.25,
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {index + 1}. {step.title}
                  </h3>
                  {step.badge && (
                    <span
                      data-testid="step-badge"
                      style={{
                        padding: "2px 4px",
                        borderRadius: "var(--t-radius-chip)",
                        background: "var(--t-notice-fill)",
                        color: "var(--t-notice-marker)",
                        fontSize: "10px",
                        fontWeight: "var(--t-label-weight)",
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.badge}
                    </span>
                  )}
                  <Chevron src={tracker.chevron} />
                </div>
                {/*
                 * Пояснение шага у донора ЧЁРНОЕ, 14/400 — серым оно
                 * читалось бы примечанием, а это основной текст шага:
                 * у донора он того же тона, что и заголовок.
                 */}
                {step.text && (
                  <p style={{ ...caption, margin: "8px 0 0", color: "var(--t-text-primary)" }}>
                    {step.text}
                  </p>
                )}
              </article>

              {/*
               * Дело пользователя — ОТДЕЛЬНАЯ карточка под шагом, а не кнопка
               * внутри него: у донора это самостоятельный блок с собственной
               * обводкой, и вторичная кнопка в нём набрана фирменным цветом
               * по белому.
               */}
              {step.action &&
                (step.action.title ? (
                  /*
                   * Дело С ЗАГОЛОВКОМ: строка-заголовок, зазор 8 и вторичная
                   * кнопка во всю ширину — белая, с бледно-сиреневой рамкой
                   * и фирменным текстом; оба цвета измерены у донора и живут
                   * в теме (`brand.secondary.fill` и граница выбранного).
                   */
                  <article data-testid={`tracker-action-${index + 1}`} style={card}>
                    <h4
                      className="flex items-center"
                      style={{
                        margin: 0,
                        gap: "4px",
                        fontSize: "var(--t-font-body)",
                        fontWeight: "var(--t-emphasis-weight)",
                        lineHeight: 1.25,
                        color: "var(--t-text-primary)",
                      }}
                    >
                      <StepMark src={step.action.icon} />
                      <span className="min-w-0 flex-1">{step.action.title}</span>
                    </h4>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center"
                      style={{
                        marginTop: "8px",
                        height: "var(--t-control-height)",
                        minHeight: "var(--k-tap-min)",
                        borderRadius: "var(--t-radius-control)",
                        border: "1px solid var(--t-secondary-border)",
                        background: "var(--t-surface-card)",
                        color: "var(--t-secondary-fill)",
                        fontSize: "var(--t-font-body)",
                        fontWeight: "var(--t-emphasis-weight)",
                        cursor: "pointer",
                      }}
                    >
                      {step.action.label}
                    </button>
                  </article>
                ) : (
                  /*
                   * Дело БЕЗ заголовка — такая же строка, как шаг: знак,
                   * чёрный текст 16/600 и шеврон. Фиолетовой кнопкой оно
                   * выглядело бы призывом, а у донора это пункт списка.
                   */
                  <article
                    data-testid={`tracker-action-${index + 1}`}
                    className="flex items-center"
                    style={{ ...card, gap: "4px" }}
                  >
                    <StepMark src={step.action.icon} />
                    <span
                      className="min-w-0 flex-1"
                      style={{
                        fontSize: "var(--t-font-body)",
                        fontWeight: "var(--t-emphasis-weight)",
                        lineHeight: 1.25,
                        color: "var(--t-text-primary)",
                      }}
                    >
                      {step.action.label}
                    </span>
                    <Chevron src={tracker.chevron} />
                  </article>
                ))}
            </Fragment>
          ))}
        </div>
      </div>

      {/* ── Зона 6: таб-бар кабинета ──────────────────────────────────
          Экран живёт В ПРИЛОЖЕНИИ: без таб-бара он читается отдельным
          сайтом. Пункты, кроме активного, никуда не ведут — демо об одном
          маршруте, и подменять им навигацию подрядчика нечем. */}
      <nav
        data-testid="tab-bar"
        aria-label={tenant.display_name}
        className="flex w-full shrink-0 items-start justify-around"
        style={{
          height: "72px",
          paddingTop: "10px",
          background: "var(--t-surface-card)",
          borderTop: "1px solid var(--t-surface-divider)",
        }}
      >
        {tracker.tabs.map((tab, index) => {
          const active = index === tracker.active_tab;
          return (
            <span
              key={tab.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center"
              style={{ gap: "4px" }}
            >
              {tab.icon ? (
                <img
                  src={tab.icon}
                  alt=""
                  aria-hidden="true"
                  width={24}
                  height={24}
                  style={{ width: "24px", height: "24px", display: "block" }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    background: active
                      ? "var(--t-brand-primary)"
                      : "var(--t-surface-track)",
                    opacity: active ? 1 : 0.45,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 300,
                  lineHeight: 1,
                  color: active ? "var(--t-text-primary)" : "var(--t-text-secondary)",
                }}
                data-testid="tab-label"
              >
                {tab.label}
              </span>
            </span>
          );
        })}
      </nav>

      {/* ── Окно оплаты: СВОЁ у донора ────────────────────────────────
          Затемнение и лист — соседи в дереве (`FIXES.md`, баг 17). Кнопки
          подтверждения нет: у донора нажатие на способ и есть оплата.

          И это ОКНО ПО ЦЕНТРУ, а не нижняя шторка: у донора обёртка
          `fixed` с `align/justify: center`, лист с полями 16 по бокам и
          радиусом 16 со всех сторон (замер 2026-10-12: лист 267→824 при
          окне 1091, снизу остаётся 267). Снизу он приезжал бы «как у всех
          остальных тем» — и это была бы чужая модель подачи. */}
      <AnimatePresence>
        {sheetOpen ? (
          <Fragment key="tracker-sheet">
            <m.div
              className="absolute inset-0 z-20"
              data-testid="payment-sheet-scrim"
              style={{ background: "rgba(0, 0, 0, 0.3)" }}
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
              className="absolute inset-x-0 z-20 m-auto flex flex-col"
              style={{
                top: 0,
                bottom: 0,
                height: "fit-content",
                maxHeight: "calc(100% - 32px)",
                overflowY: "auto",
                marginInline: "16px",
                background: "var(--t-surface-card)",
                borderRadius: "var(--t-radius-sheet)",
                padding: "16px",
              }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SHEET_OVERLAY_SPEC}
            >
              <h2
                id={sheetTitleId}
                style={{
                  margin: 0,
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: "var(--t-emphasis-weight)",
                  lineHeight: 1.3,
                  color: "var(--t-text-primary)",
                }}
              >
                {sheet?.title ?? tenant.payment_list.section_title}
              </h2>

              {/* Стоимость услуги: у донора сумма появляется только здесь. */}
              {sheet?.cost_label && (
                <div
                  className="flex items-center justify-between"
                  style={{
                    marginTop: "16px",
                    height: "70px",
                    padding: "0 17px",
                    borderRadius: "var(--t-radius-control)",
                    background: "var(--t-surface-form)",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--t-font-body)",
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {sheet.cost_label}
                  </span>
                  <span
                    data-testid="sheet-amount"
                    style={{
                      fontSize: "var(--t-font-body)",
                      fontWeight: "var(--t-emphasis-weight)",
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {amount}
                  </span>
                </div>
              )}

              {/* Промокод применяется ДО выбора способа и меняет суммы ниже. */}
              {sheet?.promo_label && (
                <button
                  type="button"
                  data-testid="sheet-promo"
                  className="flex w-full items-center"
                  style={{
                    marginTop: "12px",
                    height: "50px",
                    minHeight: "var(--k-tap-min)",
                    padding: "0 17px",
                    gap: "8px",
                    borderRadius: "var(--t-radius-control)",
                    border: "1px solid var(--t-surface-border)",
                    background: "none",
                    color: "var(--t-text-primary)",
                    fontSize: "var(--t-font-body)",
                    fontWeight: "var(--t-emphasis-weight)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span className="min-w-0 flex-1">{sheet.promo_label}</span>
                  <span aria-hidden style={{ fontSize: "20px", lineHeight: 1 }}>
                    ⌄
                  </span>
                </button>
              )}

              {/*
               * Способы столбиком КНОПОК, а не строками с радио: у донора
               * нажатие и есть оплата. Сумма стоит на самой кнопке — человек
               * видит, сколько спишется, не закрывая шторки.
               */}
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
                        height: "var(--t-method-button-height)",
                        minHeight: "var(--k-tap-min)",
                        marginTop: index === 0 ? "16px" : "12px",
                        padding: "0 24px",
                        gap: "12px",
                        borderRadius: "var(--t-radius-control)",
                        border: "none",
                        background: "var(--t-secondary-fill)",
                        color: "var(--t-secondary-text)",
                        fontSize: "var(--t-font-body)",
                        fontWeight: "var(--t-emphasis-weight)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <span className="flex shrink-0 items-center" style={{ gap: "4px" }}>
                        <MethodMark label={item.label} src={item.logo_src} />
                        {item.logo_src_extra.map((src) => (
                          <MethodMark key={src} label={item.label} src={src} />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1" />
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: "var(--t-emphasis-weight)",
                          lineHeight: 1.2,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.caption ?? amount}
                      </span>
                      <span
                        aria-hidden
                        className="flex shrink-0 items-center justify-center"
                        style={{ width: "20px", fontSize: "20px", lineHeight: 1 }}
                      >
                        ›
                      </span>
                    </button>
                  );
                })}
              </div>

              {sheet?.note && (
                <p
                  style={{
                    margin: "16px 0 0",
                    fontSize: "var(--t-font-caption)",
                    lineHeight: 1.3,
                    color: "var(--t-text-secondary)",
                    textAlign: "center",
                  }}
                >
                  {sheet.note}
                </p>
              )}
            </m.div>
          </Fragment>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Знак шага или дела 24x24. Файла может не быть — тогда остаётся пустое
 * место той же ширины: строка не должна переезжать от того, сняли мы знак
 * или нет.
 */
function StepMark({ src }: { src: string | null }) {
  if (!src) return <span aria-hidden className="shrink-0" style={{ width: "24px" }} />;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className="shrink-0"
      style={{ width: "24px", height: "24px", display: "block" }}
    />
  );
}

/** Шеврон строки: у донора это файл 20x20, а не типографский знак. */
function Chevron({ src }: { src: string | null }) {
  if (!src) {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center"
        style={{
          width: "20px",
          fontSize: "20px",
          lineHeight: 1,
          color: "var(--t-text-primary)",
        }}
      >
        &rsaquo;
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
      className="shrink-0"
      style={{ width: "20px", height: "20px", display: "block" }}
    />
  );
}

/**
 * Знак способа на кнопке: донор отдаёт их файлами разной ширины при общей
 * высоте 24 (СБП 48, карты 32 каждая, «Долями» 72, «Сплит» 90). Ширину
 * задаёт сам файл, поэтому здесь фиксируется только высота — подогнать всё
 * под квадрат значит нарисовать другие знаки.
 */
function MethodMark({ label, src }: { label: string; src: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        height={24}
        className="shrink-0"
        style={{ height: "24px", width: "auto", display: "block" }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{
        fontSize: "var(--t-font-body)",
        fontWeight: "var(--t-emphasis-weight)",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
