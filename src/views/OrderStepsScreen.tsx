import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { ChevronDown } from "@demo/components/primitives";
import { COPY, formatMoney, resolveCtaLabel } from "@demo/content/copy";
import { OZON_METHOD_ID, type TenantConfig } from "@demo/theme/tenant.schema";
import type { ScreenProps } from "./screen-props";
import { SHEET_OVERLAY_SPEC, SHEET_SCRIM_SPEC } from "./stage-motion";

/**
 * `S-G` — архетип `order_steps`, донор RML (`radimirailubvi.ru/checkout`).
 *
 * Снят целиком обходом DOM с координатами и вычисленными стилями.
 *
 * Каркас «шаги заказа → кнопка → состав под ней» роднит его со
 * `store_checkout`, и на этом сходство кончается. Расходятся четыре вещи, и
 * каждая узнаётся раньше палитры:
 *
 * 1. Активный шаг — не строки реквизитов, а ФОРМА доставки: поиск города,
 *    радио способа, сетка адресных карточек. Сетка появляется только при
 *    самовывозе — это состояние шага, а не постоянный блок.
 * 2. Пройденный шаг — карточка-сводка ЗАЛИВКОЙ без рамки, подпись и значение
 *    в две колонки, правка круглой кнопкой с карандашом в углу.
 * 3. Шапка несёт знак бренда и корзину, а не заголовок экрана.
 * 4. H2 «Оформление заказа» стоит ПОД кнопкой оплаты, открывая состав заказа,
 *    а не над экраном как его название.
 *
 * Порядок зон донора: шапка → шаг 01 с галочкой → карточка-сводка → шаг 02 →
 * город → способы получения → адреса → кнопка → H2 состава → строки товаров →
 * итоги.
 *
 * Способа оплаты на экране донора нет вовсе: кнопка ведёт сразу в платёжный
 * фрейм. Разводящая шторка «Ozon Банк / другие способы» — ровно то, что демо
 * достраивает, поэтому список способов живёт в ней, а не в потоке страницы.
 */
export function OrderStepsScreen({
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
  const delivery = content.delivery;

  const [deliveryChoice, setDeliveryChoice] = useState(delivery?.selected ?? "");
  const [pointChoice, setPointChoice] = useState(delivery?.selected_point ?? "");

  /*
   * Шторка оплаты. Принудительные состояния съёмки касаются именно её —
   * выбор способа, поле телефона и терминальная метка кнопки живут внутри,
   * и по deep-link их надо открыть сразу, а не после нажатия.
   */
  const [sheetOpen, setSheetOpen] = useState(
    forcedState === "ozon_selected" ||
      forcedState === "cta_sent" ||
      forcedState === "cta_disabled" ||
      forcedState === "phone_expanded" ||
      forcedState === "phone_checking" ||
      forcedState === "phone_error",
  );

  const payable = content.totals.sum - content.totals.discount;
  const ctaLabel = resolveCtaLabel(tenant.cta.label, tenant.cta.include_amount, payable);

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  const pad = { paddingInline: "var(--t-page-padding)" };

  /** Дисплейная гарнитура: у донора ею набран весь интерфейс, кроме адресов. */
  const display = { fontFamily: "var(--t-font-display)" };

  const pickupOpen =
    delivery?.pickup_option_id !== null && deliveryChoice === delivery?.pickup_option_id;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ── Зона 1: шапка ────────────────────────────────────────── */}
      <OrderStepsHeader
        logo={content.header_logo}
        name={tenant.display_name}
        cartDot={tenant.header.cart_dot}
      />

      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{ paddingBottom: "var(--k-page-bottom-reserve)" }}
      >
        {/* ── Зона 2: шаги заказа ────────────────────────────────── */}
        {content.sections.map((section, index) => (
          <section
            key={section.title}
            data-testid={`order-section-${index + 1}`}
            style={{ ...pad, paddingTop: index === 0 ? "28px" : "30px" }}
          >
            <div className="flex items-center" style={{ gap: "10px" }}>
              <h2
                style={{
                  ...display,
                  margin: 0,
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: 400,
                  color: "var(--t-text-primary)",
                  lineHeight: 0.95,
                }}
              >
                {section.title}
              </h2>
              {/*
                Галочка донора — не глиф в цвет текста, а ЗАЛИТЫЙ КРУЖОК
                акцентом: салатовый на белом читается как отметка «шаг
                закрыт», и это единственное цветное пятно на всём экране,
                кроме знака бренда.
              */}
              {section.done && (
                <span
                  data-testid={`section-done-${index + 1}`}
                  aria-label={COPY["section.done"]}
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "var(--t-accent, var(--t-brand-primary))",
                  }}
                >
                  <StepCheck />
                </span>
              )}
            </div>

            {section.rows.length > 0 && (
              <SummaryCard
                rows={section.rows}
                actionLabel={section.action_label}
                actionKind={section.action_kind}
                presentation={content.sections_presentation}
                testId={`section-summary-${index + 1}`}
              />
            )}
          </section>
        ))}

        {/* ── Зона 3: форма доставки ─────────────────────────────── */}
        {delivery && (
          <section data-testid="delivery-step" style={{ ...pad, paddingTop: "30px" }}>
            {delivery.city && (
              <div className="flex w-full flex-col" style={{ gap: "8px" }}>
                <span
                  data-testid="delivery-city-label"
                  style={{
                    ...display,
                    fontSize: "var(--t-font-caption)",
                    color: "var(--t-text-primary)",
                    lineHeight: 1,
                  }}
                >
                  {delivery.city.label}
                </span>
                {/*
                  Поиск города у донора — капсула с рамкой и разделителем
                  перед стрелкой. Демо не ищет: значение задано темой, поле
                  показывает выбранный город и не открывает список.
                */}
                <div
                  data-testid="delivery-city-field"
                  className="flex w-full items-center"
                  style={{
                    height: "var(--t-control-height)",
                    paddingInline: "16px",
                    border: "var(--t-border-width) solid var(--t-surface-border)",
                    borderRadius: "var(--t-radius-field)",
                    color: "var(--t-text-secondary)",
                    fontSize: "var(--k-field-font)",
                    gap: "8px",
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{delivery.city.value}</span>
                  <span
                    aria-hidden
                    style={{
                      width: "1px",
                      height: "20px",
                      background: "var(--t-surface-border)",
                      flexShrink: 0,
                    }}
                  />
                  <span aria-hidden style={{ display: "flex", flexShrink: 0 }}>
                    <ChevronDown size={18} />
                  </span>
                </div>
              </div>
            )}

            {/* Способ получения: строка = кружок 30 px + подпись дисплейной. */}
            <div
              data-testid="delivery-options"
              className="flex w-full flex-col"
              style={{ marginTop: "30px" }}
            >
              {delivery.options.map((option) => {
                const active = option.id === deliveryChoice;
                return (
                  <label
                    key={option.id}
                    data-testid={`delivery-option-${option.id}`}
                    data-selected={active}
                    className="flex w-full items-center"
                    style={{
                      minHeight: "var(--k-tap-min)",
                      gap: "12px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="delivery-option"
                      className="sr-only"
                      checked={active}
                      onChange={() => setDeliveryChoice(option.id)}
                    />
                    <span
                      aria-hidden
                      className="flex items-center justify-center"
                      style={{
                        width: "30px",
                        height: "30px",
                        flexShrink: 0,
                        borderRadius: "50%",
                        border: "var(--t-border-width) solid var(--t-text-primary)",
                        // Выбранная строка у донора не красится брендом: кружок
                        // получает светлую заливку и чёрную точку внутри.
                        background: active
                          ? "var(--t-surface-form)"
                          : "var(--t-surface-background)",
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "var(--t-text-primary)",
                          }}
                        />
                      )}
                    </span>
                    <span
                      style={{
                        ...display,
                        fontSize: "var(--t-font-caption)",
                        color: "var(--t-text-primary)",
                      }}
                    >
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {/*
              Сетка адресов — состояние шага, а не постоянный блок: у донора
              она появляется только при выбранном самовывозе.
            */}
            {pickupOpen && (
              <div data-testid="pickup-points" style={{ marginTop: "30px" }}>
                {delivery.pickup_hint && (
                  <p
                    style={{
                      ...display,
                      margin: 0,
                      fontSize: "var(--t-font-caption)",
                      color: "var(--t-text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {delivery.pickup_hint}
                  </p>
                )}
                <div
                  className="flex w-full"
                  style={{ marginTop: "20px", gap: "5px", alignItems: "flex-start" }}
                >
                  {delivery.pickup_points.map((point) => {
                    const active = point.id === pointChoice;
                    return (
                      <label
                        key={point.id}
                        data-testid={`pickup-point-${point.id}`}
                        data-selected={active}
                        className="flex flex-col"
                        style={{
                          /*
                           * Ровно половина ряда минус зазор — и при одном
                           * адресе тоже. У донора одинокая карточка НЕ
                           * растягивается на всю ширину: пустая половина
                           * справа держит колонку и ритм страницы.
                           */
                          flex: "0 0 calc(50% - 2.5px)",
                          minWidth: 0,
                          padding: "16px",
                          gap: "12px",
                          background: "var(--t-surface-card)",
                          border: `${
                            active
                              ? "var(--t-selected-border-width)"
                              : "var(--t-border-width)"
                          } solid ${
                            active ? "var(--t-text-primary)" : "var(--t-surface-border)"
                          }`,
                          borderRadius: "8px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="pickup-point"
                          className="sr-only"
                          checked={active}
                          onChange={() => setPointChoice(point.id)}
                        />
                        {/*
                          Адрес многострочный, и переносы у донора значимы:
                          город, улица, ориентир и вывеска стоят каждый своей
                          строкой. `pre-line` сохраняет их из конфига.
                        */}
                        <span
                          style={{
                            fontSize: "var(--t-font-body)",
                            lineHeight: 1.5,
                            color: "var(--t-text-primary)",
                            whiteSpace: "pre-line",
                          }}
                        >
                          {point.address}
                        </span>
                        {point.hours && (
                          <span
                            style={{
                              fontSize: "var(--t-font-body)",
                              lineHeight: 1.5,
                              color: "var(--t-text-primary)",
                            }}
                          >
                            {point.hours}
                          </span>
                        )}
                        {point.phone && (
                          <span
                            style={{
                              fontSize: "var(--t-font-body)",
                              lineHeight: 1.5,
                              color: "var(--t-text-primary)",
                            }}
                          >
                            {point.phone}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Зона 4: кнопка оплаты ──────────────────────────────── */}
        <div style={{ ...pad, paddingTop: "30px" }}>
          <PrimaryButton
            label={ctaLabel}
            loadingLabel={ctaLoadingLabel}
            sentLabel={ctaSentLabel}
            state={disabled ? "disabled" : ctaState}
            onClick={() => setSheetOpen(true)}
            testId="open-payment-sheet"
          />
        </div>

        {/* ── Зона 5: состав заказа ПОД кнопкой ──────────────────── */}
        <section
          data-testid="cart-block"
          style={{
            marginTop: "40px",
            paddingBlock: "30px",
            // Состав лежит на белом, тогда как страница шага — на светло-сером:
            // у донора это разные поверхности, и граница между ними видна.
            background: "var(--t-surface-card)",
          }}
        >
          <div style={pad}>
            {content.items_title && (
              <h2
                data-testid="cart-title"
                style={{
                  ...display,
                  margin: 0,
                  fontSize: "var(--t-font-h1)",
                  fontWeight: "var(--t-title-weight)" as unknown as number,
                  color: "var(--t-text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {content.items_title}
              </h2>
            )}

            <div
              className="flex w-full flex-col"
              style={{ marginTop: "30px", gap: "15px" }}
            >
              {content.line_items.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  data-testid={`line-item-${index + 1}`}
                  className="flex w-full items-center"
                  style={{
                    padding: "12px",
                    gap: "12px",
                    background: "var(--t-surface-form)",
                  }}
                >
                  {item.media && (
                    <span className="relative flex shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.image_alt ?? item.title}
                          width={96}
                          height={96}
                          style={{
                            width: "96px",
                            height: "96px",
                            /*
                             * `contain`, а не `cover` — замер донора. Разница
                             * видна: фото товара портретное (1320×1600), и
                             * `cover` обрезал бы его сверху и снизу, показав
                             * товар крупнее, чем у донора. Вписывание по
                             * высоте оставляет поля по бокам — они и есть
                             * часть вида его корзины.
                             */
                            objectFit: "contain",
                            // Рамка в цвет карточки: у донора миниатюра лежит
                            // на серой плашке и отделена от неё белой кромкой.
                            border: "1px solid var(--t-surface-card)",
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden
                          style={{
                            display: "block",
                            width: "96px",
                            height: "96px",
                            background: "var(--t-surface-border)",
                          }}
                        />
                      )}
                      {/*
                        Количество — бейдж ПОВЕРХ угла миниатюры, вылезающий
                        за её край. Строкой «× 1» рядом с названием он не
                        заменяется: у донора это второе цветное пятно экрана.
                      */}
                      {item.quantity !== null && (
                        <span
                          data-testid={`line-item-${index + 1}-quantity`}
                          className="absolute flex items-center justify-center"
                          style={{
                            top: "-4px",
                            right: "-4px",
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: "var(--t-accent, var(--t-brand-primary))",
                            color: "var(--t-text-primary)",
                            fontFamily: "var(--t-font-display)",
                            fontSize: "10px",
                            lineHeight: 1,
                          }}
                        >
                          {item.quantity}
                        </span>
                      )}
                    </span>
                  )}

                  <span
                    className="min-w-0 flex-1"
                    style={{
                      ...display,
                      fontSize: "var(--t-font-caption)",
                      lineHeight: 1.2,
                      color: "var(--t-text-primary)",
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      ...display,
                      fontSize: "var(--t-font-caption)",
                      lineHeight: 1.2,
                      color: "var(--t-text-primary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.price}
                  </span>
                </div>
              ))}
            </div>

            {/*
              Итоги донора — не пара «подпись слева, значение справа», а
              цельные строки «Сумма: 5100 ₽» по левому краю. Разнесение по
              краям превращает их в таблицу, которой у него нет.
              Дисплейной гарнитуры здесь тоже нет: замер показал ровно тот же
              CodecPro 16/400, что и в адресах, — выделен только отступ перед
              итоговой строкой.
            */}
            {content.cart && content.cart.rows.length > 0 && (
              <div
                data-testid="totals-block"
                data-variant="inline_rows"
                className="flex w-full flex-col"
                style={{ marginTop: "15px", gap: "8px" }}
              >
                {content.cart.rows.map((row) => (
                  <p
                    key={row.label}
                    data-testid={row.emphasis ? "totals-payable" : undefined}
                    style={{
                      margin: row.emphasis ? "12px 0 0" : 0,
                      fontSize: "var(--t-font-body)",
                      lineHeight: 1.2,
                      color: "var(--t-text-primary)",
                    }}
                  >
                    <span>{row.label}: </span>
                    <span data-testid={row.emphasis ? "totals-value" : undefined}>
                      {row.value}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Шторка оплаты ──────────────────────────────────────────── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              data-testid="sheet-scrim"
              className="absolute inset-0"
              style={{ background: "rgba(10, 12, 16, 0.56)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={SHEET_SCRIM_SPEC}
              onClick={() => setSheetOpen(false)}
            />
            <motion.section
              data-testid="payment-sheet"
              role="dialog"
              aria-label={content.sheet_title ?? COPY["payment.section_title"]}
              className="absolute inset-x-0 bottom-0 flex flex-col"
              style={{
                background: "var(--t-surface-card)",
                padding: "var(--t-page-padding)",
                paddingBottom:
                  "calc(var(--t-page-padding) + env(safe-area-inset-bottom, 0px))",
                gap: "16px",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SHEET_OVERLAY_SPEC}
            >
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

              <div
                className="flex w-full items-baseline justify-between"
                style={{ gap: "12px" }}
              >
                <h2
                  style={{
                    ...display,
                    margin: 0,
                    fontSize: "var(--t-font-section-title)",
                    fontWeight: 400,
                    color: "var(--t-text-primary)",
                  }}
                >
                  {content.sheet_title ?? COPY["payment.section_title"]}
                </h2>
                <span
                  style={{
                    ...display,
                    fontSize: "var(--t-font-section-title)",
                    color: "var(--t-text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatMoney(payable)}
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
                    /*
                     * Боковые поля обязательны: блок живёт ВНУТРИ карточки
                     * метода, и без них поле телефона упирается в её рамку.
                     * Нижнее — только у РАСКРЫТОГО блока: на свёрнутом оно
                     * делало карточку «Ozon Банк» на 12 px выше соседней, и
                     * строки способов переставали быть одного роста.
                     */
                    <div
                      style={{
                        paddingInline: "16px",
                        paddingBottom: phoneGate.expanded ? "12px" : 0,
                      }}
                    >
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

/**
 * Шапка `logo_cart`: знак бренда и возврат слева, корзина справа.
 *
 * Залипающая и прозрачная — полосы и границы у донора нет, содержимое
 * проезжает под знаком. Обе кнопки-иконки обёрнуты в зону нажатия 44 px:
 * у донора они 28 и 10, но порог попадания пальцем перебивает донора
 * намеренно (README, пункт 5).
 */
function OrderStepsHeader({
  logo,
  name,
  cartDot,
}: {
  logo: string | null;
  name: string;
  cartDot: boolean;
}) {
  return (
    <header
      data-testid="screen-header"
      data-style="logo_cart"
      className="flex w-full shrink-0 items-center justify-between"
      style={{
        paddingInline: "var(--t-page-padding)",
        paddingBlock: "12px",
        color: "var(--t-text-primary)",
      }}
    >
      <div className="flex items-center" style={{ gap: "8px" }}>
        {logo ? (
          <img
            src={logo}
            alt={name}
            data-testid="brand-slot"
            style={{ height: "28px", width: "auto", display: "block" }}
          />
        ) : (
          <span
            data-testid="brand-slot"
            style={{
              fontFamily: "var(--t-font-display)",
              fontSize: "16px",
              color: "var(--t-text-primary)",
            }}
          >
            {name}
          </span>
        )}
        <span
          aria-hidden
          className="flex items-center justify-center"
          style={{ width: "var(--k-tap-min)", height: "var(--k-tap-min)" }}
        >
          <BackArrow />
        </span>
      </div>

      <span
        data-testid="header-cart"
        className="relative flex items-center justify-center"
        style={{ width: "var(--k-tap-min)", height: "var(--k-tap-min)" }}
      >
        <span
          aria-hidden
          className="flex items-center justify-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "var(--t-surface-form)",
          }}
        >
          <CartGlyph />
        </span>
        {cartDot && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "7px",
              right: "7px",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--t-accent, var(--t-brand-primary))",
            }}
          />
        )}
      </span>
    </header>
  );
}

/**
 * Карточка-сводка пройденного шага.
 *
 * `filled_summary` — заливка без рамки и без скругления, две колонки и
 * круглая кнопка правки в углу (донор RML). `bordered` оставлен для тем, где
 * шаг очерчен рамкой: подача — ось темы, а не свойство архетипа.
 */
function SummaryCard({
  rows,
  actionLabel,
  actionKind,
  presentation,
  testId,
}: {
  rows: { label: string | null; value: string }[];
  actionLabel: string | null;
  actionKind: "link" | "pencil";
  /*
   * Полный union схемы, а не два значения: подача `cards` принадлежит другому
   * архетипу (инсетные карточки Bombbar) и сюда не приходит, но сужать тип
   * в пропе — значит ронять сборку каждый раз, когда в схеме появляется
   * новая подача, которой этот экран не касается.
   */
  presentation: TenantConfig["content"]["sections_presentation"];
  testId: string;
}) {
  const filled = presentation === "filled_summary";

  return (
    <div
      data-testid={testId}
      className="relative flex w-full flex-col"
      style={{
        marginTop: "30px",
        padding: "15px",
        gap: "15px",
        background: filled ? "var(--t-surface-form)" : "transparent",
        border: filled
          ? "none"
          : "var(--t-border-width) solid var(--t-surface-border)",
        borderRadius: filled ? 0 : "var(--t-radius-card)",
      }}
    >
      {rows.map((row, index) => (
        <div key={`${row.value}-${index}`} className="flex w-full items-start">
          {row.label && (
            <span
              className="shrink-0"
              style={{
                // Колонки донора: подпись занимает треть ширины, значение
                // начинается по фиксированной линии, а не после текста.
                width: "35%",
                fontSize: "var(--t-font-caption)",
                fontWeight: 300,
                lineHeight: 1,
                color: "var(--t-text-secondary)",
              }}
            >
              {row.label}
            </span>
          )}
          <span
            className="min-w-0 flex-1"
            style={{
              fontSize: "var(--t-font-caption)",
              fontWeight: 300,
              lineHeight: 1,
              color: "var(--t-text-primary)",
              wordBreak: "break-word",
            }}
          >
            {row.value}
          </span>
        </div>
      ))}

      {actionLabel && actionKind === "pencil" && (
        /*
         * Видимый круг у донора 20 px, но нажимаемая область обязана быть 44:
         * порог зоны нажатия перебивает донора намеренно (README, пункт 5).
         * Поэтому кнопка прозрачная и крупная, а круг нарисован внутри неё —
         * смещение на (44−20)/2 держит его ровно там, где он у донора.
         */
        <button
          type="button"
          data-testid={`${testId}-action`}
          aria-label={actionLabel}
          className="absolute flex items-center justify-center"
          style={{
            top: "3px",
            right: "3px",
            width: "var(--k-tap-min)",
            height: "var(--k-tap-min)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--t-text-primary)",
          }}
        >
          <span
            aria-hidden
            className="flex items-center justify-center"
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "var(--t-surface-card)",
            }}
          >
            <PencilGlyph />
          </span>
        </button>
      )}

      {actionLabel && actionKind === "link" && (
        <button
          type="button"
          data-testid={`${testId}-action`}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            padding: 0,
            fontSize: "var(--t-font-caption)",
            color: "var(--t-text-primary)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** Галочка внутри залитого кружка шага: тонкая, в цвет текста. */
function StepCheck() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
      <path
        d="M1 4.2 3.6 6.8 9 1.2"
        stroke="var(--t-text-primary)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Стрелка возврата донора: тонкая, влево, с горизонтальной чертой. */
function BackArrow() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden="true">
      <path
        d="M1 6L5.59619 1.40381M1 6L5.59619 10.5962M1 6H10.1924"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Корзина донора: контурная тележка мелким штрихом. */
function CartGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M3.67 3.87h2.99a.42.42 0 0 1 .42.48l-.13 1.3a.43.43 0 0 1-.43.39H4.46a.43.43 0 0 1-.42-.35L3.67 3.87Z"
        stroke="currentColor"
        strokeWidth="0.33"
        strokeLinejoin="round"
      />
      <path
        d="m3.67 3.87-.18-.7a.19.19 0 0 0-.18-.14h-.27"
        stroke="currentColor"
        strokeWidth="0.33"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <circle cx="6.37" cy="6.72" r="0.28" fill="currentColor" />
      <circle cx="4.62" cy="6.72" r="0.28" fill="currentColor" />
    </svg>
  );
}

/** Карандаш правки в круглой кнопке карточки-сводки. */
function PencilGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
      <path
        d="M8.34 2.22 6.79.66a.55.55 0 0 0-.78 0L.51 6.16.01 8.34a.54.54 0 0 0 .53.66l2.3-.5L8.34 3a.55.55 0 0 0 0-.78Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
