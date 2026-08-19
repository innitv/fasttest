import { useState, type CSSProperties } from "react";

import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { COPY, resolveCtaLabel } from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";

/**
 * `S-I` — архетип `pickup_checkout`, донор MYBOX (mybox.ru/moskva).
 *
 * Каркас донора: узкая шапка сайта, а под ней ЛИСТ, поднятый поверх страницы
 * и скруглённый сверху. Чекаут у MYBOX — не страница, а нижняя шторка, и это
 * первое, что видно: содержимое начинается не от верха экрана, а от края
 * листа. Свернуть лист в обычную страницу значит потерять единственную
 * структурную рифму со шторкой выбора оплаты, которая открывается из него же.
 *
 * Второе, что узнаётся раньше палитры: во всём чекауте донора НЕТ ни одного
 * жирного начертания. Golos загружен единственным весом 400, иерархия держится
 * только кеглем (22 / 20 / 18 / 16 / 14 / 13 / 12). Поэтому `label_weight` и
 * `title_weight` в теме равны 400, и любое `font-weight` по месту здесь —
 * расхождение с донором, а не украшение.
 */
export function PickupCheckoutScreen({
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

  // Счётчики приборов живут в экране: у донора это состояние строки заказа, а
  // не конфигурация темы. Ноль — стартовое значение всех шести позиций.
  const [utensilCounts, setUtensilCounts] = useState<Record<string, number>>({});
  const [changeChip, setChangeChip] = useState(content.change_chips?.selected ?? "");
  const [pickupTime, setPickupTime] = useState(content.pickup_time?.selected ?? "");
  const [costOption, setCostOption] = useState<string | null>(null);
  const [receiptOn, setReceiptOn] = useState(content.receipt_toggle?.default_on ?? false);
  const [comment, setComment] = useState("");

  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };

  /*
   * Межстрочный интервал донора, а не наш дефолтный.
   *
   * У MYBOX строки набраны плотно: 16 px текста занимает 18 px высоты, 22 px
   * заголовка — 25, 14 px названия — 16. Дефолтные 1.5 из препроцессора
   * добавляют по 6-8 px на КАЖДОЙ строке, и к низу экрана это накапливает
   * 107 px — при том что все зазоры между блоками выставлены по донору
   * точно. Расхождение, которое не видно в отдельно взятом блоке и хорошо
   * заметно целиком.
   */
  const LINE = 1.15;

  const sectionTitle: CSSProperties = {
    fontSize: "var(--t-font-section-title)",
    // 20 px заголовка секции у донора занимает 25 px.
    lineHeight: 1.25,
    fontWeight: "var(--t-title-weight)",
    color: "var(--t-text-primary)",
    margin: 0,
  };

  const bodyText: CSSProperties = {
    fontSize: "var(--t-font-body)",
    lineHeight: LINE,
    fontWeight: "var(--t-label-weight)",
    color: "var(--t-text-primary)",
  };

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount,
  );

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  // Чипы сдачи привязаны к способу оплаты: у донора они существуют только
  // при наличных. В демо это то место, где переключение на «Ozon Банк»
  // видно структурно — блок исчезает, а не перекрашивается.
  const chipsVisible =
    content.change_chips !== null &&
    selectedMethod !== null &&
    content.change_chips.visible_for.includes(selectedMethod);

  const setCount = (name: string, delta: number) =>
    setUtensilCounts((prev) => {
      const next = Math.max(0, (prev[name] ?? 0) + delta);
      return { ...prev, [name]: next };
    });

  /** Круглая кнопка счётчика 32×32. На нуле минус приглушён рамкой донора. */
  const counterButton = (
    label: string,
    onClick: () => void,
    muted: boolean,
    glyph: string,
  ) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        width: "32px",
        height: "32px",
        flexShrink: 0,
        borderRadius: "var(--t-radius-control)",
        background: "var(--t-surface-form)",
        border: `var(--t-border-width) solid ${
          muted ? "var(--t-brand-disabled)" : "var(--t-text-primary)"
        }`,
        color: muted ? "var(--t-brand-disabled)" : "var(--t-text-primary)",
        fontSize: "16px",
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div
      data-screen-root
      className="relative flex h-full w-full flex-col"
      style={{ background: "var(--t-surface-background)" }}
    >
      {/*
        Каркас донора: корзина MYBOX — это ШТОРКА поверх страницы каталога, а
        не отдельная страница. Видно это по трём вещам разом: страница под
        ней притемнена, лист начинается не от верха экрана (y=85), а над его
        краем висит круглая кнопка закрытия. Развернуть лист на весь экран
        значит потерять и это, и рифму со шторкой выбора оплаты, которая
        открывается из него же тем же движением.
      */}
      <div
        aria-hidden
        data-testid="page-scrim"
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
      />

      {/*
        ── Шапка сайта ПОД притемнением ─────────────────────────────────
        Она непозиционированная намеренно: `page-scrim` абсолютный и потому
        рисуется поверх неё. Шапка здесь — часть притемнённой страницы, а не
        активный слой: пока корзина открыта, каталогом не пользуются.
      */}
      <header
        data-testid="screen-header"
        data-style="logo_cart"
        className="flex w-full shrink-0 items-center justify-between"
        style={{
          height: "57px",
          ...pad,
          background: "var(--t-surface-background)",
        }}
      >
        <span
          style={{
            fontSize: "var(--t-font-section-title)",
            fontWeight: "var(--t-title-weight)",
            color: "var(--t-accent)",
            letterSpacing: "0.02em",
          }}
        >
          {tenant.brand.logo.text ?? tenant.display_name}
        </span>
        {/*
          Справа у донора стоит «Ещё» — вход в меню каталога. На экране
          корзины он бесполезен: пока лист открыт, каталог притемнён и
          недоступен. Ставим иконку корзины — она и объясняет, что за лист
          открыт, и совпадает с `header.style = logo_cart` темы.
        */}
        <span
          aria-hidden
          data-testid="header-cart"
          className="flex items-center"
          style={{ color: "var(--t-text-primary)", position: "relative" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 5h2.2l2.2 9.6a1.6 1.6 0 0 0 1.6 1.2h7.8a1.6 1.6 0 0 0 1.55-1.2L20 8H6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="19.5" r="1.4" fill="currentColor" />
            <circle cx="17" cy="19.5" r="1.4" fill="currentColor" />
          </svg>
          {tenant.header.cart_dot && (
            <span
              style={{
                position: "absolute",
                top: "1px",
                right: "1px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--t-accent)",
              }}
            />
          )}
        </span>
      </header>

      {/*
        Лист чекаута. `relative` обязателен: шторка оплаты позиционируется
        `absolute` относительно экрана, а не окна, — демо живёт в рамке
        телефона, и фиксированный слой уехал бы за её пределы.
      */}
      <div
        data-testid="pickup-sheet"
        className="no-scrollbar relative z-10 flex-1 overflow-y-auto"
        style={{
          background: "var(--t-surface-background)",
          borderRadius: "24px 24px 0 0",
          lineHeight: LINE,
          // Лист начинается ниже шапки, оставляя полосу притемнённой
          // страницы: 85 у донора при шапке 57.
          marginTop: "28px",
          // У донора здесь 50 — место под кнопку закрытия, висящую над краем
          // листа. Кнопку сняли решением владельца, и запас вместе с ней:
          // иначе лист открывается пустой полосой без причины.
          paddingTop: "25px",
          paddingBottom: "var(--k-page-bottom-reserve)",
        }}
      >
        {/* ── Зона 1: адрес самовывоза ─────────────────────────────────── */}
        {content.address && (
          <section data-testid="pickup-address" style={pad}>
            <div className="flex items-start justify-between" style={{ gap: "8px" }}>
              <h1
                style={{
                  fontSize: "var(--t-font-h1)",
                  lineHeight: 1.14,
                  fontWeight: "var(--t-title-weight)",
                  color: "var(--t-text-primary)",
                  margin: 0,
                }}
              >
                {content.address.title}
              </h1>
              <button
                type="button"
                aria-label={content.address.action_label}
                data-testid="address-edit"
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: "44px",
                  height: "44px",
                  marginTop: "-10px",
                  marginRight: "-12px",
                  background: "none",
                  border: "none",
                  color: "var(--t-text-primary)",
                  cursor: "pointer",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path
                    d="M13.4 3.6a1.7 1.7 0 0 1 2.4 2.4l-8.3 8.3-3.2.8.8-3.2 8.3-8.3Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p style={{ ...bodyText, margin: "28px 0 0" }}>{content.address.subtitle}</p>
            {/*
              Срок готовности — факт о заказе, отдельный от выбора времени
              ниже. У донора это третья строка адресного блока, а не часть
              радио-пары.
            */}
            {content.pickup_eta && (
              <p data-testid="pickup-eta" style={{ ...bodyText, margin: "18px 0 0" }}>
                {content.pickup_eta}
              </p>
            )}
          </section>
        )}

        {/* ── Зона 2: состав заказа со счётчиками ──────────────────────── */}
        <section data-testid="order-items" style={{ ...pad, marginTop: "40px" }}>
          {/*
            Заголовок состава и очистка корзины — одна строка: у донора
            иконка мусорки прижата к правому краю на уровне «Заказа».
          */}
          <div className="flex items-center justify-between" style={{ gap: "8px" }}>
            <h2 style={sectionTitle}>{content.items_title ?? content.title}</h2>
            <button
              type="button"
              aria-label={COPY["cart.clear"]}
              data-testid="cart-clear"
              className="flex shrink-0 items-center justify-center"
              style={{
                width: "44px",
                height: "44px",
                marginRight: "-10px",
                background: "none",
                border: "none",
                color: "var(--t-text-primary)",
                cursor: "pointer",
              }}
            >
              <svg width="24" height="26" viewBox="0 0 24 26" fill="none" aria-hidden>
                <path
                  d="M4 7h16M9.5 7V4.8c0-.6.5-1.1 1.1-1.1h2.8c.6 0 1.1.5 1.1 1.1V7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M6.2 7.5 7.3 20.4c.06.8.73 1.4 1.5 1.4h6.4c.78 0 1.44-.6 1.5-1.4L17.8 7.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M10.4 11v7M13.6 11v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {/*
            Строка позиции у донора трёхколоночная: иконка, текст, и СПРАВА
            колонка «цена сверху — счётчик под ней». Собранная столбиком
            (название → граммовка → счётчик) она даёт шаг 113 px вместо
            донорских 92 — то есть состав заказа растягивается на треть
            экрана лишнего.
          */}
          <div className="flex flex-col" style={{ marginTop: "16px", gap: "29px" }}>
            {content.line_items.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                data-testid="line-item"
                className="flex items-start"
                style={{ gap: "10px" }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.image_alt ?? item.title}
                    style={{
                      width: "58px",
                      height: "58px",
                      flexShrink: 0,
                      borderRadius: "13px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    aria-hidden
                    style={{
                      width: "58px",
                      height: "58px",
                      flexShrink: 0,
                      borderRadius: "13px",
                      background: "var(--t-surface-card)",
                    }}
                  />
                )}
                {/*
                  Колонка текста тянется на весь остаток строки, и ограничивать
                  её нельзя: правая колонка перестаёт прижиматься к краю и цена
                  повисает в 28 px от него. Узким у донора выглядит только
                  НАЗВАНИЕ — оно обрывается об цену сверху, ширина задана ему.
                */}
                <div className="flex flex-1 flex-col" style={{ gap: "6px" }}>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: "var(--t-label-weight)",
                      color: "var(--t-text-primary)",
                      margin: 0,
                      // Донор держит название в 114 px: справа сверху стоит
                      // цена, и колонка обрывается об неё.
                      maxWidth: "114px",
                    }}
                  >
                    {item.title}
                  </p>
                  <span
                    style={{
                      fontSize: "var(--t-font-caption)",
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {item.period}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end" style={{ gap: "10px" }}>
                  <span
                    style={{
                      fontSize: "var(--t-font-price)",
                      fontWeight: "var(--t-label-weight)",
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {item.price}
                  </span>
                  <div className="flex items-center" style={{ gap: "12px" }}>
                    {counterButton(COPY["counter.decrease"], () => undefined, false, "−")}
                    <span style={bodyText}>{item.quantity}</span>
                    {counterButton(COPY["counter.increase"], () => undefined, false, "+")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Зона 3: сетка приборов 2×N ───────────────────────────────── */}
        {content.utensils && (
          <section data-testid="utensils" style={{ ...pad, marginTop: "32px" }}>
            {content.utensils.title && (
              <h2 style={{ ...sectionTitle, marginBottom: "16px" }}>
                {content.utensils.title}
              </h2>
            )}
            {/*
              Три колонки, а не две: у донора сетка 111 + 111 + 111 при поле
              345 и зазоре 6. На двух колонках карточка раздувается до 162, а
              шесть приборов занимают три ряда вместо двух — блок вырастает на
              175 px и перестаёт читаться как приложение к заказу.
            */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "6px",
              }}
            >
              {content.utensils.items.map((item) => {
                const count = utensilCounts[item.name] ?? 0;
                return (
                  <div
                    key={item.name}
                    data-testid="utensil-card"
                    className="flex flex-col items-center"
                    style={{
                      background: "var(--t-surface-card)",
                      borderRadius: "var(--t-radius-card)",
                      padding: "8px",
                      gap: "9px",
                    }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        aria-hidden
                        style={{ width: "68px", height: "68px", objectFit: "contain" }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        style={{
                          width: "68px",
                          height: "68px",
                          borderRadius: "50%",
                          background: "var(--t-surface-form)",
                        }}
                      />
                    )}
                    <div className="flex flex-col items-center" style={{ gap: "4px" }}>
                      <span style={{ fontSize: "13px", color: "var(--t-text-primary)" }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize: "13px", color: "var(--t-text-secondary)" }}>
                        {item.caption}
                      </span>
                    </div>
                    <div className="flex items-center" style={{ gap: "12px" }}>
                      {counterButton(
                        COPY["counter.decrease"],
                        () => setCount(item.name, -1),
                        count === 0,
                        "−",
                      )}
                      {/* Цифра счётчика у донора окрашена брендом, а не текстом. */}
                      <span style={{ ...bodyText, color: "var(--t-accent)" }}>{count}</span>
                      {counterButton(
                        COPY["counter.increase"],
                        () => setCount(item.name, 1),
                        false,
                        "+",
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {content.utensils.hint && (
              <p
                data-testid="utensils-hint"
                className="flex items-start"
                style={{
                  ...bodyText,
                  color: "var(--t-accent)",
                  // Иконка на левом поле (x=15), текст с x=47 — то есть
                  // подсказка выровнена по левому краю, а не центрирована.
                  gap: "12px",
                  margin: "25px 0 0",
                  textAlign: "left",
                }}
              >
                {content.utensils.hint_icon && (
                  <img
                    src={content.utensils.hint_icon}
                    alt=""
                    aria-hidden
                    style={{ width: "20px", height: "20px", flexShrink: 0, marginTop: "1px" }}
                  />
                )}
                <span>{content.utensils.hint}</span>
              </p>
            )}
          </section>
        )}

        {/* ── Зона 4: время получения ──────────────────────────────────── */}
        {content.pickup_time && (
          <section data-testid="pickup-time" style={{ ...pad, marginTop: "32px" }}>
            <h2 style={sectionTitle}>{content.pickup_time.title}</h2>
            <div
              role="radiogroup"
              aria-label={content.pickup_time.title}
              className="flex flex-col"
              style={{ marginTop: "16px", gap: "0px" }}
            >
              {content.pickup_time.options.map((option) => (
                <RadioRow
                  key={option.id}
                  label={option.label}
                  checked={pickupTime === option.id}
                  onSelect={() => setPickupTime(option.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Зона 5: способ оплаты (строка → шторка) ──────────────────── */}
        <section data-testid="payment-section" style={{ ...pad, marginTop: "32px" }}>
          <h2 style={sectionTitle}>
            {tenant.payment_list.section_title ?? COPY["payment.methods_title"]}
          </h2>
          <div style={{ marginTop: "16px" }}>
            <PaymentMethodList
              layout={tenant.payment_list.layout}
              methods={tenant.payment_list.methods}
              selected={selectedMethod}
              onSelect={onSelectMethod}
              padded={false}
              sheet={
                content.payment_sheet
                  ? {
                      title: content.payment_sheet.title,
                      ctaLabel: content.payment_sheet.cta_label,
                    }
                  : undefined
              }
              renderAfter={(methodId) =>
                methodId === "ozon" && phoneGate ? (
                  <div style={{ marginTop: "16px" }}>
                    <PhoneGateBlock {...phoneGate} />
                  </div>
                ) : null
              }
            />
          </div>

          {chipsVisible && content.change_chips && (
            <div
              data-testid="change-chips"
              className="flex flex-wrap"
              style={{ marginTop: "26px", gap: "8px" }}
            >
              {content.change_chips.options.map((option) => {
                const active = changeChip === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChangeChip(option)}
                    style={{
                      minHeight: "36px",
                      paddingInline: "15px",
                      borderRadius: "var(--t-radius-chip)",
                      background: "transparent",
                      border: `var(--t-border-width) solid ${
                        active ? "var(--t-accent)" : "var(--t-text-primary)"
                      }`,
                      // У донора выбранный чип красит и рамку, и ТЕКСТ:
                      // заливки в этом состоянии нет вовсе.
                      color: active ? "var(--t-accent)" : "var(--t-text-primary)",
                      fontSize: "var(--t-font-body)",
                      fontWeight: "var(--t-label-weight)",
                      cursor: "pointer",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Зона 6: комментарий ──────────────────────────────────────── */}
        {content.comment_field && (
          <section data-testid="comment" style={{ ...pad, marginTop: "32px" }}>
            <h2 style={sectionTitle}>{content.comment_field.title}</h2>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={content.comment_field.placeholder}
              rows={2}
              style={{
                width: "100%",
                // Донорское поле 50 px. После уплотнения строки rows={2}
                // даёт 37, поэтому высота задана явно.
                height: "50px",
                marginTop: "16px",
                border: "none",
                outline: "none",
                resize: "none",
                background: "var(--t-surface-form)",
                color: "var(--t-text-primary)",
                // 16 px — наш порог против зума iOS, он перебивает донора.
                fontSize: "var(--k-field-font)",
                fontWeight: "var(--t-label-weight)",
              }}
            />
          </section>
        )}

        {/* ── Зона 7: стоимость заказа ─────────────────────────────────── */}
        <section data-testid="totals" style={{ ...pad, marginTop: "30px" }}>
          <h2 style={sectionTitle}>Стоимость заказа</h2>
          <div className="flex items-center justify-between" style={{ marginTop: "16px" }}>
            <span style={bodyText}>Еда</span>
            <span style={bodyText}>{formatRub(content.totals.sum)}</span>
          </div>

          {content.cost_options.length > 0 && (
            <div className="flex flex-col" style={{ marginTop: "8px", gap: "0px" }}>
              {content.cost_options.map((option) => (
                <RadioRow
                  key={option.id}
                  label={option.label}
                  checked={costOption === option.id}
                  onSelect={() =>
                    setCostOption((prev) => (prev === option.id ? null : option.id))
                  }
                />
              ))}
            </div>
          )}

          <div
            className="flex items-center justify-between"
            style={{
              marginTop: "15px",
              paddingTop: "15px",
              // Разделитель донора — сплошная линия ЦВЕТА ТЕКСТА, а не
              // светло-серая: это единственная линия на всём экране.
              borderTop: `var(--t-border-width) solid var(--t-surface-divider)`,
            }}
          >
            <span style={bodyText}>Итого</span>
            <span style={bodyText}>
              {formatRub(content.totals.sum - content.totals.discount)}
            </span>
          </div>
        </section>

        {/* ── Зона 8: тумблер электронного чека ────────────────────────── */}
        {content.receipt_toggle && (
          <section
            data-testid="receipt-toggle"
            className="flex items-center justify-between"
            style={{ ...pad, marginTop: "32px", gap: "12px" }}
          >
            <span style={bodyText}>{content.receipt_toggle.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={receiptOn}
              aria-label={content.receipt_toggle.label}
              onClick={() => setReceiptOn((value) => !value)}
              style={{
                width: "50px",
                height: "25px",
                flexShrink: 0,
                borderRadius: "150px",
                border: `var(--t-border-width) solid var(--t-text-primary)`,
                background: receiptOn ? "var(--t-accent)" : "transparent",
                position: "relative",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: "3px",
                  left: receiptOn ? "28px" : "3px",
                  width: "17px",
                  height: "17px",
                  borderRadius: "50%",
                  background: receiptOn
                    ? "var(--t-surface-background)"
                    : "var(--t-text-primary)",
                  transition: "left 160ms ease",
                }}
              />
            </button>
          </section>
        )}

        {/* ── Зона 9: кнопка оформления ────────────────────────────────── */}
        <div style={{ ...pad, marginTop: "53px" }}>
          <PrimaryButton
            label={ctaLabel}
            loadingLabel={ctaLoadingLabel}
            sentLabel={ctaSentLabel}
            state={disabled ? "disabled" : ctaState}
            onClick={onCta}
          />
        </div>
      </div>
    </div>
  );
}

/** Строка выбора с кольцом бренда — время получения и варианты расчёта. */
function RadioRow({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex w-full items-center text-left"
      style={{
        minHeight: "44px",
        gap: "8px",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        className="flex items-center justify-center"
        style={{
          width: "22px",
          height: "22px",
          flexShrink: 0,
          borderRadius: "50%",
          border: `var(--t-border-width) solid ${
            checked ? "var(--t-accent)" : "var(--t-text-primary)"
          }`,
        }}
      >
        {checked ? (
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "var(--t-accent)",
            }}
          />
        ) : null}
      </span>
      <span
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: "var(--t-label-weight)",
          color: "var(--t-text-primary)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/** Копейки → «1030 ₽». Донор не отбивает разряды на этих суммах. */
function formatRub(kopecks: number): string {
  return `${Math.round(kopecks / 100)} ₽`;
}
