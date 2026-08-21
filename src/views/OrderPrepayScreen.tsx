import { useState, type CSSProperties } from "react";

import { PaymentAmountSheet } from "@demo/components/PaymentAmountSheet";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { resolveCtaLabel } from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";

/**
 * Архетип `order_prepay`, донор Tripster (страница заказа аудиогида).
 *
 * Экран оплачивает УЖЕ СОЗДАННЫЙ заказ: полей ввода на нём нет ни одного,
 * состава со счётчиками нет, шагов нет. Всё, что он делает, — ОБЪЯСНЯЕТ
 * сумму: плашка-памятка о том, что будет после оплаты, серая карта с
 * условиями и единственной кнопкой, расшифровка стоимости на две стороны
 * сделки и правила возврата. Поэтому и порядок блоков донорский: сначала
 * что покупается и у кого, потом чем это кончится, и только потом деньги.
 *
 * Второе, что узнаётся раньше палитры: у донора почти НУЛЕВЫЕ скругления на
 * секциях — карта оплаты и плашка-памятка прямоугольные и во всю ширину, а
 * скругление появляется только у интерактивного (кнопка 8, строка способа 12,
 * лист шторки 16). Отсюда `radius.card = 0` в теме, и любое скругление секции
 * по месту здесь — расхождение с донором.
 *
 * Третье: гарнитура вариативная, и веса донора не два, а пять — 400 текст,
 * 475 кнопка и строки способов, 550 суммы, 725/800 заголовки. Ступень 550
 * живёт в `--t-emphasis-weight`; писать `font-weight` числом по месту нельзя,
 * это ось темы.
 */
export function OrderPrepayScreen({
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

  const [noticeOpen, setNoticeOpen] = useState(content.notice?.expanded ?? false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };

  /*
   * Карта оплаты у донора УЖЕ страницы: её внешний отступ 20 против 16 у
   * текста выше (ширина 335 при вьюпорте 375), а внутреннее поле — обычные
   * 16. Это его метрика, а не ось темы — в схеме поле страницы одно, и
   * подменять им отступ карты значит стереть разницу. Пара 20/16 держит
   * ширину строки внутри карты равной донорской (303): при перепутанных
   * местами значениях строка становится на 24 px шире, условия укладываются
   * в меньшее число строк, и карта не добирает высоту (замер 342 против 402).
   */
  const cardInset = "20px";
  const cardPad = "16px";

  const bodyText: CSSProperties = {
    fontSize: "var(--t-font-body)",
    lineHeight: 1.5,
    fontWeight: "var(--t-label-weight)",
    color: "var(--t-text-primary)",
  };

  const captionText: CSSProperties = {
    fontSize: "var(--t-font-caption)",
    lineHeight: 1.43,
    fontWeight: "var(--t-label-weight)",
    color: "var(--t-text-primary)",
  };

  /** Заголовки секций донора — H3 того же кегля, что H1, и того же веса. */
  const sectionTitle: CSSProperties = {
    fontSize: "var(--t-font-section-title)",
    lineHeight: 1.3,
    fontWeight: "var(--t-title-weight)",
    color: "var(--t-text-primary)",
    margin: 0,
  };

  const linkText: CSSProperties = { color: "var(--t-link)" };

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount,
  );

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  /*
   * Главная кнопка у этого донора двухрежимна, и это его модель, а не наша
   * надстройка: пока способ не выбран, «Оплатить» ОТКРЫВАЕТ шторку способов —
   * отдельной строки способа на экране нет. Выбранный способ превращает ту же
   * кнопку в подтверждение платежа.
   */
  const handleCta = () => {
    if (selectedMethod === null) {
      setSheetOpen(true);
      return;
    }
    onCta();
  };

  return (
    <div
      data-screen-root
      className="relative flex h-full w-full flex-col"
      style={{ background: "var(--t-surface-background)" }}
    >
      {/*
        ── Шапка сайта ───────────────────────────────────────────────────
        Донорская: 56 px, без границы и тени, бургер слева, знак по центру,
        поиск справа. Ни заголовка, ни стрелки возврата — страница заказа
        открывается по ссылке из письма, а не из каталога.
      */}
      <header
        data-testid="screen-header"
        data-style="centered_logo"
        className="flex w-full shrink-0 items-center justify-between"
        style={{ height: "56px", ...pad, background: "var(--t-surface-background)" }}
      >
        <span
          aria-hidden
          className="flex items-center justify-center"
          style={{ width: "24px", height: "24px", color: "var(--t-text-primary)" }}
        >
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
            <path
              d="M0 1h20M0 7h20M0 13h20"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        {content.header_logo && (
          <img
            src={content.header_logo}
            alt={tenant.display_name}
            style={{ height: "24px", width: "auto" }}
          />
        )}
        <span
          aria-hidden
          className="flex items-center justify-center"
          style={{ width: "24px", height: "24px", color: "var(--t-text-primary)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6.4" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M13.8 13.8 18 18"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </header>

      <div
        data-testid="order-scroll"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{ paddingBottom: "var(--k-page-bottom-reserve)" }}
      >
        {/* ── Зона 1: номер заказа ────────────────────────────────────── */}
        {content.order_ref && (
          <div
            data-testid="order-ref"
            className="flex items-baseline"
            style={{ ...pad, marginTop: "16px", gap: "8px" }}
          >
            <span
              style={{
                fontSize: "var(--t-font-h1)",
                // 25 px на кегле 20 — межстрочный донора, а не `normal` (30 у
                // Inter). Разница в 5 px здесь съедает донорский зазор до H1.
                lineHeight: 1.25,
                fontWeight: "var(--t-emphasis-weight)",
                color: "var(--t-text-primary)",
              }}
            >
              {content.order_ref.label}
            </span>
            <span style={{ ...captionText }}>{content.order_ref.number}</span>
          </div>
        )}

        {/* ── Зона 2: название покупки ────────────────────────────────── */}
        <h1
          data-testid="order-title"
          style={{
            ...pad,
            fontSize: "var(--t-font-h1)",
            lineHeight: 1.3,
            fontWeight: "var(--t-title-weight)",
            /*
             * У донора заголовок заказа набран ССЫЛКОЙ и ведёт на страницу
             * самой покупки. Демо этой страницы не имеет, поэтому переносим
             * только вид: цвет ссылки без интерактивности — фальшивая ссылка
             * в никуда хуже её отсутствия.
             */
            color: content.title_as_link ? "var(--t-link)" : "var(--t-text-primary)",
            margin: "18px 0 0",
          }}
        >
          {content.title}
        </h1>

        {/* ── Зона 3: организатор ─────────────────────────────────────── */}
        {content.organizer && (
          <div
            data-testid="order-organizer"
            className="flex items-center"
            style={{
              ...pad,
              gap: "12px",
              // Блок донора h43 при аватаре 36 и границе 1 — на поля остаётся
              // по 3 px. Строка организатора у него прижата к аватару, а не
              // разложена по вертикали.
              paddingBlock: "3px",
              marginTop: "16px",
              borderBottom: "var(--t-border-width) solid var(--t-surface-divider)",
            }}
          >
            {content.organizer.avatar ? (
              <img
                src={content.organizer.avatar}
                alt=""
                aria-hidden
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span
                aria-hidden
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "var(--t-surface-card)",
                  color: "var(--t-text-primary)",
                  fontSize: "var(--t-font-caption)",
                  fontWeight: "var(--t-emphasis-weight)",
                }}
              >
                {content.organizer.name.slice(0, 1)}
              </span>
            )}
            <span style={{ ...bodyText, lineHeight: 1.25 }}>
              {content.organizer.name}
            </span>
          </div>
        )}

        {/* ── Зона 4: плашка-памятка (аккордеон) ──────────────────────── */}
        {content.notice && (
          <section
            data-testid="order-notice"
            style={{
              // Плашка донора идёт во всю ширину и без скругления: поля она
              // держит своими, а не полями страницы.
              background: "var(--t-notice-fill)",
              borderRadius: "var(--t-radius-card)",
              marginTop: "32px",
            }}
          >
            <button
              type="button"
              aria-expanded={noticeOpen}
              data-testid="notice-toggle"
              onClick={() => setNoticeOpen((value) => !value)}
              className="flex w-full items-center justify-between text-left"
              style={{
                minHeight: "56px",
                gap: "8px",
                // Отступы донора: 32 слева под точку-маркер, 20 справа под шеврон.
                padding: "16px 20px 16px 32px",
                background: "none",
                border: "none",
                color: "var(--t-notice-on)",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {/* Точка-маркер 16 px на левом поле — единственный цветной знак плашки. */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "20px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "var(--t-notice-marker)",
                }}
              />
              <span
                style={{
                  fontSize: "17px",
                  lineHeight: 1.41,
                  fontWeight: "var(--t-title-weight)",
                }}
              >
                {content.notice.title}
              </span>
              <span
                aria-hidden
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: "20px",
                  height: "20px",
                  transform: noticeOpen ? "rotate(180deg)" : "none",
                  transition: "transform var(--k-motion-medium) ease-out",
                }}
              >
                <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
                  <path
                    d="M1 1l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            {/*
              Раскрытие — сдвиг внутри контрола: `--k-motion-medium` из общего
              слоя демо. Сетка `0fr → 1fr` даёт анимируемую высоту без
              измерения содержимого; под reduce длительность обнуляется
              глобальным правилом.
            */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: noticeOpen ? "1fr" : "0fr",
                transition: "grid-template-rows var(--k-motion-medium) ease-out",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <ul
                  data-testid="notice-items"
                  style={{
                    margin: 0,
                    padding: "0 20px 35px 32px",
                    listStyle: "disc",
                    color: "var(--t-notice-on)",
                  }}
                >
                  {content.notice.items.map((item) => (
                    <li key={item} style={{ ...bodyText, color: "var(--t-notice-on)" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── Зона 5: заголовок оплаты ────────────────────────────────── */}
        <h2
          data-testid="payment-title"
          style={{ ...pad, ...sectionTitle, lineHeight: 1.4, marginTop: "16px" }}
        >
          {tenant.payment_list.section_title ?? tenant.cta.label}
        </h2>

        {/* ── Зона 6: серая карта оплаты ──────────────────────────────── */}
        {content.payment_card && (
          <section
            data-testid="payment-card"
            style={{
              background: "var(--t-surface-form)",
              borderRadius: "var(--t-radius-card)",
              marginTop: "16px",
              marginInline: cardInset,
              padding: cardPad,
            }}
          >
            <p style={{ ...captionText, margin: 0 }}>{content.payment_card.terms}</p>

            {content.payment_card.promo_link && (
              <p
                data-testid="promo-link"
                style={{ ...captionText, ...linkText, margin: "16px 0 0" }}
              >
                {content.payment_card.promo_link}
              </p>
            )}

            <div
              className="flex items-center justify-between"
              style={{ gap: "12px", marginTop: "16px" }}
            >
              <span
                style={{
                  ...bodyText,
                  lineHeight: 1.5,
                  fontWeight: "var(--t-emphasis-weight)",
                }}
              >
                {content.payment_card.due_label}
              </span>
              <span
                data-testid="payment-due"
                style={{
                  // Сумма у донора набрана кеглем ТЕКСТА (16/24), а не кеглем
                  // цены: `typography.price` — ось карточки тарифа, её кламп
                  // начинается с 18 и к строке расчёта отношения не имеет.
                  fontSize: "var(--t-font-body)",
                  lineHeight: 1.5,
                  fontWeight: "var(--t-emphasis-weight)",
                  color: "var(--t-text-primary)",
                }}
              >
                {content.payment_card.due_value}
              </span>
            </div>

            {content.payment_card.currency_note && (
              <p style={{ ...captionText, margin: "24px 0 0" }}>
                {content.payment_card.currency_note}
              </p>
            )}

            {/*
              Проверка клиентства встаёт ВНУТРЬ карты оплаты, над кнопкой: у
              этого донора нет ни строки способа, ни формы, и единственное
              место, где поле не выглядит чужим, — рядом с суммой и кнопкой.
            */}
            {selectedMethod === "ozon" && phoneGate && (
              <div style={{ marginTop: "8px" }}>
                <PhoneGateBlock {...phoneGate} />
              </div>
            )}

            <div style={{ marginTop: "32px" }}>
              <PrimaryButton
                label={ctaLabel}
                loadingLabel={ctaLoadingLabel}
                sentLabel={ctaSentLabel}
                state={disabled ? "disabled" : ctaState}
                onClick={handleCta}
              />
            </div>

            {/*
              Ряд платёжных систем. У донора это ЦЕЛЬНАЯ блок-картинка (259×26,
              логотипы в собственных цветах), и она забирается картинкой —
              подписи в том же порядке рисовали второй, отличающийся макет
              поверх готового. `systems` остаётся фолбэком для тем, у которых
              картинки нет.
            */}
            {content.payment_card.systems_image ? (
              <div
                data-testid="payment-systems"
                className="flex items-center justify-center"
                style={{ marginTop: "12px" }}
              >
                <img
                  src={content.payment_card.systems_image.src}
                  alt={content.payment_card.systems.join(", ")}
                  style={{
                    width: `${content.payment_card.systems_image.width}px`,
                    height: `${content.payment_card.systems_image.height}px`,
                    // Колонка бывает уже донорских 375: картинка ужимается
                    // пропорционально, а не вылезает за поля карты.
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            ) : (
              content.payment_card.systems.length > 0 && (
                <div
                  data-testid="payment-systems"
                  className="flex flex-wrap items-center justify-center"
                  style={{ gap: "8px", marginTop: "12px" }}
                >
                  {content.payment_card.systems.map((system) => (
                    <span
                      key={system}
                      style={{
                        fontSize: "var(--t-font-caption)",
                        lineHeight: 1.43,
                        color: "var(--t-text-secondary)",
                      }}
                    >
                      {system}
                    </span>
                  ))}
                </div>
              )
            )}

            {content.payment_card.secure_note && (
              <p
                data-testid="secure-note"
                className="flex items-center justify-center"
                style={{
                  ...captionText,
                  color: "var(--t-text-secondary)",
                  gap: "8px",
                  margin: "32px 0 0",
                }}
              >
                <span aria-hidden className="flex shrink-0 items-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect
                      x="4.2"
                      y="8.6"
                      width="11.6"
                      height="8"
                      rx="1.6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M7 8.6V6.8a3 3 0 0 1 6 0v1.8"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                {content.payment_card.secure_note}
              </p>
            )}
          </section>
        )}

        {/* ── Зона 7: расшифровка стоимости ───────────────────────────── */}
        {content.cost_breakdown && (
          <section data-testid="cost-breakdown" style={{ ...pad, marginTop: "40px" }}>
            <h3 style={sectionTitle}>{content.cost_breakdown.title}</h3>

            {/*
              Строки состава у донора стоят подряд: их разделяет межстрочный
              интервал 24, а не зазор. Блок целиком укладывается в донорские
              227 px только так — с зазорами 8 он вырастает до 251.
            */}
            <div className="flex flex-col" style={{ marginTop: "16px", gap: "0" }}>
              {content.cost_breakdown.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between"
                  style={{ gap: "12px" }}
                >
                  <span style={bodyText}>{row.label}</span>
                  <span style={bodyText}>{row.value}</span>
                </div>
              ))}
              {content.cost_breakdown.total && (
                <div
                  className="flex items-baseline justify-between"
                  style={{ gap: "12px" }}
                >
                  <span style={bodyText}>{content.cost_breakdown.total.label}</span>
                  <span style={bodyText}>{content.cost_breakdown.total.value}</span>
                </div>
              )}
            </div>

            {/*
              Разделитель и то, что под ним, — смысл всей секции: итог уже
              назван, а ниже он раскладывается на две стороны сделки — что
              уходит площадке и что организатору напрямую.
            */}
            {content.cost_breakdown.split_rows.length > 0 && (
              <div
                className="flex flex-col"
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  gap: "0",
                  borderTop: "var(--t-border-width) solid var(--t-surface-divider)",
                }}
              >
                {content.cost_breakdown.split_rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between"
                    style={{ gap: "12px" }}
                  >
                    <span style={bodyText}>{row.label}</span>
                    <span style={bodyText}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {content.cost_breakdown.note && (
              <p style={{ ...bodyText, margin: "8px 0 0" }}>
                {renderNote(content.cost_breakdown.note, content.cost_breakdown.note_link)}
              </p>
            )}
          </section>
        )}

        {/* ── Зона 8: правила ─────────────────────────────────────────── */}
        {content.info_sections.map((section) => (
          <section
            key={section.title}
            data-testid="info-section"
            style={{ ...pad, marginTop: "40px" }}
          >
            <h3 style={sectionTitle}>{section.title}</h3>
            {/*
              Блок донора h71 при строках 26 + 20 + 20: на зазоры остаётся 5 px
              суммарно. Ссылка стоит прямо под фразой — это продолжение
              предложения, а не отдельный блок.
            */}
            <p style={{ ...bodyText, lineHeight: 1.25, margin: "5px 0 0" }}>
              {section.text}
            </p>
            {section.link && (
              <p style={{ ...bodyText, ...linkText, lineHeight: 1.25, margin: "0" }}>
                {section.link}
              </p>
            )}
          </section>
        ))}
      </div>

      {/*
        Шторка способов — сосед скролл-контейнера, а не его содержимое: внутри
        него `absolute inset-0` привязался бы к прокручиваемому блоку, и лист
        уезжал бы вместе с прокруткой.
      */}
      {content.payment_sheet && (
        <PaymentAmountSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          methods={tenant.payment_list.methods}
          selected={selectedMethod}
          onSelect={(id) => {
            onSelectMethod(id);
            setSheetOpen(false);
          }}
          title={content.payment_sheet.title}
          note={content.payment_sheet.note}
        />
      )}
    </div>
  );
}

/**
 * Примечание со ссылкой внутри строки: у донора ссылкой набрана только
 * подстрока («нам в чат»), а не весь абзац. Подстрока подчёркнута и остаётся
 * цветом текста — это его способ отличать ссылку в тексте от ссылки-действия.
 */
function renderNote(note: string, link: string | null) {
  if (!link || !note.includes(link)) return note;
  const [before, after] = note.split(link);
  return (
    <>
      {before}
      <span style={{ textDecoration: "underline" }}>{link}</span>
      {after}
    </>
  );
}
