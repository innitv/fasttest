import { useState, type CSSProperties } from "react";

import { Chevron } from "@demo/components/primitives";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { resolveCtaLabel } from "@demo/content/copy";
import type { ScreenProps } from "./screen-props";

/**
 * `S-J` — архетип `carrier_delivery`, донор EWA PRODUCT
 * (ewaproduct.com/ru/checkout/delivery).
 *
 * Каркас донора: чекаут разбит на ТРИ шага крошками сверху, и это первый
 * донор, у которого доставка и оплата разведены по разным страницам. Отсюда
 * главное следствие для демо: здесь нет выбора способа оплаты вовсе — кнопка
 * «Оформить заказ» ведёт на страницу оплаты донора (`CarrierPaymentScreen`),
 * и «Ozon Банк» встаёт в его собственную сетку там.
 *
 * Что узнаётся раньше палитры:
 *
 * 1. Сетка перевозчиков 3×2, где карточка это логотип, срок и цена. Выбранная
 *    обведена рамкой в фирменную магенту — единственное цветное пятно экрана
 *    вместе со словом «бесплатно».
 * 2. Итоги лежат в карточке ДРУГОГО фона (card_alt против card) и другого
 *    радиуса (19 против 14). У донора это два разных материала: форма и счёт.
 *    Свести их к одному — потерять его вид.
 * 3. Перед итогами стоит витрина допродажи «Возьмите пакет» с фотографиями и
 *    кнопкой «В корзину» у каждой позиции. Это не состав заказа: состава на
 *    экране доставки у донора нет вообще, только суммы.
 * 4. Город набран ПОДЧЁРКНУТЫМ полем Material, а не полем в рамке; тумблер
 *    международной доставки стоит выше города и делит экран надвое.
 *
 * Зазор между секциями у донора 9-10 px, а перед карточкой итогов — 49:
 * счёт отделён от формы воздухом, а не линией.
 */
export function CarrierDeliveryScreen({
  tenant,
  ctaState,
  ctaLoadingLabel,
  ctaSentLabel,
  onCta,
  forcedState,
}: ScreenProps) {
  const { content } = tenant;

  const [mode, setMode] = useState(content.carriers?.modes?.active ?? "");
  const [carrier, setCarrier] = useState<string | null>(content.carriers?.selected ?? null);
  const [intlOn, setIntlOn] = useState(content.intl_toggle?.default_on ?? false);

  const payable = content.totals.sum - content.totals.discount;
  const ctaLabel = resolveCtaLabel(tenant.cta.label, tenant.cta.include_amount, payable);
  const disabled = forcedState === "cta_disabled" || carrier === null;

  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };

  /*
   * Межстрочный интервал донора, а не дефолтный.
   *
   * У EWA 14 px текста занимает 17 px высоты, 18.75 заголовка — 19. Дефолтные
   * 1.5 добавляют по 4-6 px на каждой строке, а строк на этом экране много
   * (адрес ПВЗ, три строки часов, две позиции допродажи) — к низу набегает
   * под сотню, и нижний блок уезжает.
   */
  const LINE = 1.2;

  const card: CSSProperties = {
    background: "var(--t-surface-card)",
    borderRadius: "var(--t-radius-card)",
    padding: "13px 14px",
  };

  const sectionTitle: CSSProperties = {
    margin: 0,
    fontSize: "var(--t-font-body)",
    fontWeight: "var(--t-label-weight)" as unknown as number,
    color: "var(--t-text-primary)",
    lineHeight: LINE,
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ── Зона 1: чёрная шапка сайта ───────────────────────────────── */}
      <header data-testid="screen-header" data-style="logo_cart" className="shrink-0">
        {tenant.header.top_bar && (
          <div
            data-testid="header-top-bar"
            className="flex w-full items-center"
            style={{
              ...pad,
              height: "30px",
              gap: "6px",
              background: "var(--t-brand-primary)",
              fontSize: "var(--t-font-caption)",
              fontWeight: 600,
              color: "var(--t-brand-primary-on)",
            }}
          >
            <span>{tenant.header.top_bar.city}</span>
            <span aria-hidden style={{ opacity: 0.5 }}>
              |
            </span>
            <span>{tenant.header.top_bar.phone}</span>
          </div>
        )}

        <div
          className="flex w-full items-center"
          style={{
            ...pad,
            height: "73px",
            gap: "12px",
            background: "var(--t-brand-primary)",
          }}
        >
          {content.header_logo ? (
            <img
              data-testid="header-logo"
              src={content.header_logo}
              alt={tenant.display_name}
              /*
               * Знак донора в шапке белый. `invert(1)` красил бы магенту в
               * зелень — нужен именно обесцвет с последующей инверсией.
               */
              style={{ height: "17px", width: "auto", filter: "brightness(0) invert(1)" }}
            />
          ) : (
            <span data-testid="header-logo" style={{ color: "var(--t-brand-primary-on)" }}>
              {tenant.brand.logo.text ?? tenant.display_name}
            </span>
          )}

          <span
            aria-hidden
            className="ml-auto"
            style={{
              fontSize: "var(--t-font-caption)",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "var(--t-brand-primary-on)",
            }}
          >
            ВОЙТИ
          </span>
          <span
            aria-hidden
            className="flex flex-col justify-between"
            style={{ width: "18px", height: "12px" }}
          >
            {[0, 1, 2].map((i) => (
              <i
                key={i}
                style={{
                  display: "block",
                  height: "2px",
                  background: "var(--t-brand-primary-on)",
                }}
              />
            ))}
          </span>
        </div>
      </header>

      {/* ── Зона 2: прокручиваемое тело ──────────────────────────────── */}
      <div
        data-testid="screen-scroll"
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ background: "var(--t-surface-background)" }}
      >
        {/* Крошки: три шага чекаута донора, текущий не выделен цветом. */}
        <nav
          data-testid="checkout-steps"
          className="flex items-center"
          style={{
            ...pad,
            gap: "10px",
            paddingTop: "23px",
            fontSize: "var(--t-font-body)",
            color: "var(--t-text-secondary)",
            lineHeight: LINE,
          }}
        >
          <span>Корзина</span>
          <span aria-hidden>/</span>
          <span style={{ color: "var(--t-text-primary)" }}>Доставка</span>
          <span aria-hidden>/</span>
          <span>Подтверждение</span>
        </nav>

        <h1
          data-testid="screen-title"
          style={{
            ...pad,
            margin: 0,
            paddingTop: "18px",
            paddingBottom: "22px",
            fontFamily: "var(--t-font-display)",
            fontSize: "var(--t-font-h1)",
            fontWeight: "var(--t-title-weight)" as unknown as number,
            textTransform: "uppercase",
            color: "var(--t-text-primary)",
            lineHeight: 1,
          }}
        >
          {content.title}
        </h1>

        <div
          className="flex flex-col"
          style={{ ...pad, gap: "var(--t-block-gap)", paddingBottom: "24px" }}
        >
          {/* ── Тумблер международной доставки ─────────────────────── */}
          {content.intl_toggle && (
            <section
              data-testid="intl-toggle"
              style={{ ...card, minHeight: "46px" }}
              className="flex items-center justify-between"
            >
              <span style={sectionTitle}>{content.intl_toggle.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={intlOn}
                aria-label={content.intl_toggle.label}
                onClick={() => setIntlOn((v) => !v)}
                className="flex shrink-0 items-center justify-end"
                style={{
                  /*
                   * Зона нажатия 44 при видимом треке 28×18: расширяет её
                   * САМА КНОПКА, прозрачная, а трек нарисован внутри. Фон на
                   * кнопке с padding дал бы серый овал 44×44 вместо тумблера
                   * донора — так и вышло на первой сборке.
                   */
                  width: "var(--k-tap-min)",
                  height: "var(--k-tap-min)",
                  marginBlock: "-13px",
                  marginInlineEnd: "-8px",
                }}
              >
                <span
                  aria-hidden
                  className="relative block"
                  style={{
                    width: "28px",
                    height: "18px",
                    borderRadius: "9999px",
                    background: intlOn ? "var(--t-brand-fill)" : "var(--t-surface-track)",
                    transition: "background var(--k-motion-fast)",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: intlOn ? "12px" : "2px",
                      width: "14px",
                      height: "14px",
                      borderRadius: "9999px",
                      background: "var(--t-surface-form)",
                      transition: "left var(--k-motion-fast)",
                    }}
                  />
                </span>
              </button>
            </section>
          )}

          {/* ── Город: подчёркнутое поле Material ──────────────────── */}
          {content.city_field && (
            <section data-testid="city-field" style={{ ...card, paddingBottom: "10px" }}>
              <div
                style={{
                  fontSize: "var(--t-font-body)",
                  fontWeight: "var(--t-label-weight)" as unknown as number,
                  color: "var(--t-text-primary)",
                  lineHeight: LINE,
                }}
              >
                {content.city_field.label}
              </div>
              <div
                className="flex items-baseline"
                style={{
                  gap: "5px",
                  marginTop: "9px",
                  paddingBottom: "6px",
                  borderBottom: "1px solid var(--t-surface-border)",
                  /* Кегль поля не ниже 16: иначе Safari на iOS зумит экран. */
                  fontSize: "var(--k-field-font)",
                  color: "var(--t-text-primary)",
                  lineHeight: LINE,
                }}
              >
                <span>{content.city_field.value}</span>
                {content.city_field.placeholder && (
                  <span style={{ color: "var(--t-text-secondary)" }}>
                    {content.city_field.placeholder}
                  </span>
                )}
              </div>
            </section>
          )}

          {/* ── Способ получения: сегментед + сетка перевозчиков ───── */}
          {content.carriers && (
            <section data-testid="carriers" style={card}>
              <h2 style={sectionTitle}>{content.carriers.title}</h2>

              {content.carriers.modes && (
                <div
                  data-testid="carrier-modes"
                  role="tablist"
                  className="flex"
                  style={{ gap: "8px", marginTop: "15px" }}
                >
                  {content.carriers.modes.items.map((item) => {
                    const active = item.id === mode;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setMode(item.id)}
                        className="flex flex-1 items-center justify-center"
                        style={{
                          /*
                           * Зона нажатия 44 при видимой высоте донора 33.
                           * Красить фоном саму кнопку с внутренним padding
                           * нельзя: заливка растёт вместе с зоной, и сегмент
                           * выходит на 12 px выше донорского — именно так и
                           * вышло на первой сборке.
                           */
                          height: "var(--k-tap-min)",
                        }}
                      >
                        <span
                          aria-hidden
                          className="flex w-full items-center justify-center"
                          style={{
                            height: "33px",
                            borderRadius: "var(--t-radius-control)",
                            background: active
                              ? "var(--t-surface-control-active)"
                              : "var(--t-surface-form)",
                            color: active
                              ? "var(--t-brand-primary-on)"
                              : "var(--t-text-primary)",
                            fontSize: "var(--t-font-body)",
                            transition: "background var(--k-motion-fast)",
                          }}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                data-testid="carrier-grid"
                role="radiogroup"
                aria-label={content.carriers.title}
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "5px",
                  marginTop: "13px",
                }}
              >
                {content.carriers.items.map((item) => {
                  const selected = item.id === carrier;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${item.label}, ${item.eta}, ${item.price}`}
                      onClick={() => setCarrier(item.id)}
                      data-testid="carrier-card"
                      data-selected={selected || undefined}
                      className="flex flex-col items-center justify-center"
                      style={{
                        height: "73px",
                        gap: "4px",
                        padding: "6px 4px",
                        background: "var(--t-surface-form)",
                        borderRadius: "var(--t-radius-card)",
                        /*
                         * Рамка есть всегда, меняется только цвет: иначе
                         * карточка прыгает на 2 px при выборе.
                         */
                        border: `var(--t-selected-border-width) solid ${
                          selected ? "var(--t-brand-border-selected)" : "transparent"
                        }`,
                        transition: "border-color var(--k-motion-fast)",
                      }}
                    >
                      {item.logo ? (
                        <img
                          src={item.logo}
                          alt=""
                          aria-hidden
                          style={{ height: "11px", width: "auto", maxWidth: "100%" }}
                        />
                      ) : (
                        <span
                          aria-hidden
                          style={{
                            fontSize: "var(--t-font-caption)",
                            color: "var(--t-text-primary)",
                          }}
                        >
                          {item.label}
                        </span>
                      )}
                      <span
                        aria-hidden
                        style={{
                          /* Срок и цена у донора одного кегля — 11,72 → 12 (схема целая). */
                          fontSize: "12px",
                          color: "var(--t-text-secondary)",
                          lineHeight: LINE,
                          textAlign: "center",
                        }}
                      >
                        {item.eta}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          fontSize: "12px",
                          fontWeight: item.free ? 500 : 400,
                          color: item.free
                            ? "var(--t-surface-positive)"
                            : "var(--t-text-primary)",
                          lineHeight: LINE,
                        }}
                      >
                        {item.price}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Карточка выбранного ПВЗ — продолжение секции, не свой блок. */}
              {content.pickup_point && carrier !== null && (
                <div data-testid="pickup-point" style={{ marginTop: "18px" }}>
                  <div
                    className="flex items-center"
                    style={{ gap: "7px", color: "var(--t-text-primary)" }}
                  >
                    <span aria-hidden style={{ fontSize: "12px" }}>
                      ⊞
                    </span>
                    <span style={sectionTitle}>{content.pickup_point.title}</span>
                  </div>
                  <div
                    style={{
                      marginTop: "12px",
                      paddingLeft: "21px",
                      fontSize: "var(--t-font-body)",
                      color: "var(--t-text-primary)",
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ fontWeight: "var(--t-label-weight)" as unknown as number }}>
                      {content.pickup_point.address_label}
                    </div>
                    <div style={{ marginTop: "4px" }}>{content.pickup_point.address}</div>
                    <div
                      style={{
                        marginTop: "14px",
                        fontWeight: "var(--t-label-weight)" as unknown as number,
                      }}
                    >
                      {content.pickup_point.hours_label}
                    </div>
                    {content.pickup_point.hours.map((line) => (
                      <div key={line} style={{ marginTop: "2px" }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Полоса «до бесплатной доставки» ────────────────────── */}
          {content.free_delivery && (
            <section data-testid="free-delivery" style={card}>
              <div className="flex items-center" style={{ gap: "10px" }}>
                <span style={{ ...sectionTitle, flex: 1 }}>{content.free_delivery.label}</span>
                <span aria-hidden style={{ color: "var(--t-text-secondary)" }}>
                  <Chevron />
                </span>
              </div>
              <div
                aria-hidden
                style={{
                  marginTop: "11px",
                  height: "5px",
                  borderRadius: "9999px",
                  background: "var(--t-surface-form)",
                  overflow: "hidden",
                }}
              >
                <div
                  data-testid="free-delivery-bar"
                  style={{
                    width: `${content.free_delivery.progress_pct}%`,
                    height: "100%",
                    background: "var(--t-surface-progress)",
                  }}
                />
              </div>
              {content.free_delivery.hint && (
                <div
                  style={{
                    marginTop: "9px",
                    fontSize: "var(--t-font-caption)",
                    color: "var(--t-text-secondary)",
                    lineHeight: LINE,
                  }}
                >
                  {content.free_delivery.hint}
                </div>
              )}
            </section>
          )}

          {/* ── Данные получателя: строка с шевроном ───────────────── */}
          {content.recipient && (
            <section data-testid="recipient" style={card}>
              <div className="flex items-center" style={{ gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={sectionTitle}>{content.recipient.title}</div>
                  {content.recipient.lines.map((line, i) => (
                    <div
                      key={line}
                      style={{
                        marginTop: i === 0 ? "8px" : "2px",
                        fontSize: "var(--t-font-caption)",
                        color: "var(--t-text-secondary)",
                        lineHeight: LINE,
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <span aria-hidden style={{ color: "var(--t-text-secondary)" }}>
                  <Chevron />
                </span>
              </div>
            </section>
          )}

          {/* ── Витрина допродажи ──────────────────────────────────── */}
          {content.upsell && (
            <section data-testid="upsell" style={card}>
              <h2 style={sectionTitle}>{content.upsell.title}</h2>
              {content.upsell.caption && (
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "var(--t-font-caption)",
                    color: "var(--t-text-secondary)",
                    lineHeight: LINE,
                  }}
                >
                  {content.upsell.caption}
                </div>
              )}

              <div className="flex flex-col" style={{ gap: "18px", marginTop: "16px" }}>
                {content.upsell.items.map((item) => (
                  <div key={item.id} className="flex" style={{ gap: "12px" }}>
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.image_alt ?? ""}
                        style={{
                          width: "113px",
                          height: "113px",
                          flexShrink: 0,
                          borderRadius: "16px",
                          background: "var(--t-surface-form)",
                          objectFit: "cover",
                        }}
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div
                        style={{
                          fontSize: "var(--t-font-caption)",
                          color: "var(--t-text-primary)",
                          lineHeight: 1.3,
                        }}
                      >
                        {item.title}
                      </div>
                      {item.caption && (
                        <div
                          style={{
                            marginTop: "5px",
                            fontSize: "10px",
                            color: "var(--t-text-secondary)",
                            lineHeight: LINE,
                          }}
                        >
                          {item.caption}
                        </div>
                      )}
                      <div
                        style={{
                          marginTop: "6px",
                          fontSize: "var(--t-font-price)",
                          fontWeight: 600,
                          color: "var(--t-text-primary)",
                          lineHeight: LINE,
                        }}
                      >
                        {item.price}
                      </div>
                      <button
                        type="button"
                        data-testid="upsell-cta"
                        style={{
                          marginTop: "10px",
                          /* Кнопка донора узкая (141 px), а не во всю колонку. */
                          width: "141px",
                          maxWidth: "100%",
                          height: "42px",
                          minHeight: "var(--k-tap-min)",
                          borderRadius: "var(--t-radius-control)",
                          background: "var(--t-brand-primary)",
                          color: "var(--t-brand-primary-on)",
                          fontSize: "var(--t-font-caption)",
                        }}
                      >
                        {item.cta_label}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Итоги: другой материал, чем форма ──────────────────── */}
          <section
            data-testid="totals"
            style={{
              background: "var(--t-surface-card-alt)",
              borderRadius: "19px",
              padding: "18px 13px",
              marginTop: "39px",
            }}
          >
            <div className="flex items-baseline justify-between">
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: "var(--t-title-weight)" as unknown as number,
                  color: "var(--t-text-primary)",
                }}
              >
                Итого
              </h2>
              <span
                style={{
                  /*
                   * Сумма у донора МЕЛЬЧЕ заголовка (16,9 против 18,75; у нас 17 и 19) и при
                   * этом ЖИРНЕЕ (700 против 500). Одинаковый набор обеих строк
                   * читается как таблица; у донора это заголовок и итог.
                   */
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--t-text-primary)",
                }}
              >
                {formatRub(payable)}
              </span>
            </div>

            <div
              aria-hidden
              style={{
                marginTop: "13px",
                height: "1px",
                background: "var(--t-surface-divider)",
              }}
            />

            <div
              className="flex items-baseline justify-between"
              style={{
                marginTop: "16px",
                fontSize: "16px",
                color: "var(--t-text-primary)",
              }}
            >
              <span>Стоимость товаров</span>
              <span>{formatRub(content.totals.sum)}</span>
            </div>

            <div className="flex justify-end" style={{ marginTop: "10px" }}>
              <span
                data-testid="bonus-badge"
                style={{
                  /* Донор: 67×27 при кегле 16 — поля узкие, строка плотная. */
                  padding: "4px 8px",
                  borderRadius: "9999px",
                  background: "var(--t-brand-primary)",
                  color: "var(--t-brand-primary-on)",
                  fontSize: "16px",
                  fontWeight: 600,
                  lineHeight: 1.15,
                }}
              >
                = 22,6Б
              </span>
            </div>

            <div style={{ marginTop: "18px" }}>
              <PrimaryButton
                label={ctaLabel}
                loadingLabel={ctaLoadingLabel}
                sentLabel={ctaSentLabel}
                state={disabled ? "disabled" : ctaState}
                onClick={onCta}
              />
            </div>
          </section>

          {/* ── Реферальная покупка: хвост страницы ────────────────── */}
          {content.referral && (
            <section data-testid="referral" style={{ marginTop: "31px", paddingInline: "14px" }}>
              <h2
                style={{
                  margin: 0,
                  /*
                   * Единственный блок чекаута на гарнитуре САЙТА: у донора он
                   * вне компонента формы и набран Raleway 600. На основной
                   * гарнитуре запрос 600 уезжает к Bold 700 — заголовок
                   * выходит заметно жирнее донорского.
                   */
                  fontFamily: "var(--t-font-secondary)",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--t-text-primary)",
                }}
              >
                {content.referral.title}
              </h2>
              <div
                style={{
                  marginTop: "11px",
                  /* Подпись и значение поля у донора одного кегля — 16. */
                  fontSize: "var(--k-field-font)",
                  color: "var(--t-text-secondary)",
                }}
              >
                {content.referral.field_label}
              </div>
              <div
                style={{
                  marginTop: "4px",
                  paddingBottom: "7px",
                  borderBottom: "1px solid var(--t-surface-border)",
                  fontSize: "var(--k-field-font)",
                  color: "var(--t-text-primary)",
                }}
              >
                {content.referral.value}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Копейки → «4 360 ₽» с обычным пробелом разряда, как у донора. */
function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks / 100);
  return `${rub.toLocaleString("ru-RU").replace(/ /g, " ")} ₽`;
}
