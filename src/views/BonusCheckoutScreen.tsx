import { useState, type CSSProperties, type ReactNode } from "react";

import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { CheckGlyph } from "@demo/components/primitives";
import { COPY, resolveCtaLabel } from "@demo/content/copy";
import { OZON_METHOD_ID } from "@demo/theme/tenant.schema";
import type { ScreenProps } from "./screen-props";

/**
 * `S-G` — архетип `bonus_checkout`, донор Bombbar
 * (`bombbar.ru/cart/order`, снят по computed styles).
 *
 * Порядок зон донора: шапка «логотип + служба поддержки» → H1 → карточка
 * контактов с плашкой бонусов → карточка способа получения с ЧИПАМИ и пунктом
 * выдачи → карточка комментария → карточка оплаты → согласия → КНОПКА → и
 * только под ней «Ваш заказ» с составом и раскрашенными итогами.
 *
 * Почему это не `store_checkout`: там секции идут full-bleed, а шаг помечен
 * галочкой готовности. Здесь каждая секция — ИНСЕТНАЯ карточка с рамкой и
 * заголовком внутри, готовность не показывается вовсе, зато экран продаёт
 * регистрацию плашкой бонусов и раскрашивает итоги: скидка красная, доставка
 * зелёная, бонусы отдельной строкой. Это разный разговор с покупателем, и
 * подстановка в чужой архетип читается как перекрашенный MONOCHROME.
 */
export function BonusCheckoutScreen({
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

  const [receiveChoice, setReceiveChoice] = useState(content.fulfillment?.selected ?? "");
  const [agreements, setAgreements] = useState<boolean[]>(() =>
    content.agreements.map((item) => item.checked),
  );

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount,
  );

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  const ctaButton = (
    <PrimaryButton
      label={ctaLabel}
      loadingLabel={ctaLoadingLabel}
      sentLabel={ctaSentLabel}
      state={disabled ? "disabled" : ctaState}
      onClick={onCta}
    />
  );

  const toggleAgreement = (index: number) =>
    setAgreements((all) => all.map((value, i) => (i === index ? !value : value)));

  const formAgreements = content.agreements
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.placement === "form");
  const ctaAgreements = content.agreements
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.placement === "cta");

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ── Зона 1: шапка «логотип + поддержка» ────────────────────── */}
      <header
        data-testid="screen-header"
        data-style="logo_support"
        className="flex w-full shrink-0 items-center justify-between"
        style={{
          paddingInline: "var(--t-page-padding)",
          paddingBlock: "16px",
          gap: "12px",
          background: "var(--t-surface-card)",
        }}
      >
        {content.header_logo ? (
          <img
            data-testid="header-logo"
            src={content.header_logo}
            alt={tenant.display_name}
            style={{ maxWidth: "55%", height: "auto" }}
          />
        ) : (
          <span
            data-testid="header-logo"
            style={{
              fontSize: "var(--t-font-section-title)",
              fontWeight: "var(--t-title-weight)",
              color: "var(--t-text-primary)",
            }}
          >
            {tenant.brand.logo.text ?? tenant.display_name}
          </span>
        )}

        {tenant.header.support && (
          <span className="flex shrink-0 flex-col items-end">
            <span
              style={{
                fontSize: "var(--t-font-caption)",
                fontWeight: 700,
                color: "var(--t-text-primary)",
                whiteSpace: "nowrap",
              }}
            >
              {tenant.header.support.phone}
            </span>
            <span
              style={{
                fontSize: "var(--t-font-caption)",
                color: "var(--t-text-primary)",
                whiteSpace: "nowrap",
              }}
            >
              {tenant.header.support.caption}
            </span>
          </span>
        )}
      </header>

      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{ paddingBottom: "var(--k-page-bottom-reserve)" }}
      >
        {/* ── Зона 2: заголовок ──────────────────────────────────────── */}
        <h1
          data-testid="page-title"
          style={{
            margin: 0,
            paddingInline: "var(--t-page-padding)",
            paddingTop: "18px",
            paddingBottom: "18px",
            fontSize: "var(--t-font-h1)",
            fontWeight: "var(--t-title-weight)",
            color: "var(--t-text-primary)",
            lineHeight: 1.2,
          }}
        >
          {content.title}
        </h1>

        <div className="flex w-full flex-col" style={{ gap: "var(--t-block-gap)" }}>
          {/* ── Зона 3: контакты и бонусы ────────────────────────────── */}
          {content.sections.map((section, index) => (
            <SectionCard key={section.title} testId={`order-section-${index + 1}`}>
              <h2 style={sectionTitleStyle}>{section.title}</h2>

              {/* Плашка бонусов стоит первой в карточке контактов: донор
                  продаёт регистрацию ровно там, где просит данные. */}
              {index === 0 && content.bonus_banner && (
                <div
                  data-testid="bonus-banner"
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "var(--t-brand-tonal)",
                    color: "var(--t-brand-tonal-on)",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--t-font-body)",
                      fontWeight: 700,
                      lineHeight: 1.4,
                    }}
                  >
                    {content.bonus_banner.title}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "var(--t-font-body)",
                      lineHeight: 1.4,
                    }}
                  >
                    {content.bonus_banner.text}
                  </p>
                </div>
              )}

              {/*
                Строка «данные не указаны» отбита СВЕРХУ линией, а действие
                стоит справа от неё: у донора это не заголовок с кнопкой, а
                пустое поле, которое просит заполнения.
              */}
              {section.rows.map((row, rowIndex) => (
                <div
                  key={`${section.title}-${rowIndex}`}
                  className="flex w-full items-center"
                  style={{
                    gap: "12px",
                    minHeight: "44px",
                    borderTop:
                      rowIndex === 0
                        ? "var(--t-border-width) solid var(--t-surface-border)"
                        : undefined,
                    paddingTop: rowIndex === 0 ? "10px" : undefined,
                  }}
                >
                  <span
                    className="min-w-0 flex-1"
                    style={{
                      fontSize: "var(--t-font-body)",
                      color: section.done
                        ? "var(--t-text-primary)"
                        : "var(--t-text-secondary)",
                    }}
                  >
                    {row.label ? `${row.label}: ${row.value}` : row.value}
                  </span>
                  {rowIndex === 0 && section.action_label && (
                    <AccentAction
                      testId={`section-action-${index + 1}`}
                      label={section.action_label}
                    />
                  )}
                </div>
              ))}
            </SectionCard>
          ))}

          {/* ── Зона 4: способ получения чипами ──────────────────────── */}
          {content.fulfillment && (
            <SectionCard testId="fulfillment-card">
              {/*
                Заголовок и чипы стоят В ОДНОЙ строке: способ получения у этого
                донора не занимает отдельного блока вовсе, он умещается справа
                от подписи. Вынести чипы под заголовок — значит отдать выбору
                вдвое больше высоты, чем отдаёт донор.
              */}
              <div
                className="flex w-full items-start justify-between"
                style={{ gap: "12px" }}
              >
                <h2 style={{ ...sectionTitleStyle, maxWidth: "40%" }}>
                  {content.fulfillment.title}
                </h2>
                {content.fulfillment.presentation === "chips" && (
                  <div
                    role="radiogroup"
                    aria-label={content.fulfillment.title}
                    data-testid="fulfillment-chips"
                    className="flex shrink-0 flex-wrap justify-end"
                    style={{ gap: "8px" }}
                  >
                    {content.fulfillment.options.map((option) => {
                      const active = option.id === receiveChoice;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-testid={`fulfillment-chip-${option.id}`}
                          data-selected={active}
                          onClick={() => setReceiveChoice(option.id)}
                          style={{
                            minHeight: "var(--k-tap-min)",
                            paddingInline: "16px",
                            borderRadius: "var(--t-radius-chip)",
                            background: active
                              ? "var(--t-brand-primary)"
                              : "var(--t-brand-tonal)",
                            /*
                             * Рамка невыбранного чипа — тон в тон подложке, а
                             * не серая: у донора она кремовая, на полтона
                             * темнее заливки, и читается как край плашки.
                             * Серая граница на кремовом фоне превращает чип в
                             * обычную кнопку формы.
                             */
                            border: active
                              ? "var(--t-border-width) solid var(--t-brand-primary)"
                              : "var(--t-border-width) solid var(--t-brand-tonal)",
                            color: active
                              ? "var(--t-brand-primary-on)"
                              : "var(--t-brand-tonal-on)",
                            fontSize: "var(--t-font-caption)",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          {option.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {content.fulfillment.pickup && (
                <div className="flex w-full items-start" style={{ gap: "12px" }}>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      data-testid="pickup-title"
                      style={{
                        fontSize: "var(--t-font-body)",
                        fontWeight: 700,
                        color: "var(--t-text-primary)",
                        lineHeight: 1.4,
                      }}
                    >
                      {content.fulfillment.pickup.title}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--t-font-body)",
                        color: "var(--t-text-primary)",
                        lineHeight: 1.4,
                        // Адрес донора многострочный, переносы значимы.
                        whiteSpace: "pre-line",
                      }}
                    >
                      {content.fulfillment.pickup.address}
                    </span>
                    {content.fulfillment.pickup.meta && (
                      <span
                        data-testid="pickup-meta"
                        style={{
                          marginTop: "4px",
                          fontSize: "var(--t-font-body)",
                          fontWeight: 700,
                          color: "var(--t-text-primary)",
                        }}
                      >
                        {content.fulfillment.pickup.meta}
                      </span>
                    )}
                  </div>
                  {content.fulfillment.pickup.action_label && (
                    <AccentAction
                      testId="pickup-action"
                      label={content.fulfillment.pickup.action_label}
                    />
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Зона 5: комментарий ──────────────────────────────────── */}
          {content.comment_field && (
            <SectionCard testId="comment-card">
              <h2 style={sectionTitleStyle}>{content.comment_field.title}</h2>
              <textarea
                data-testid="comment-field"
                aria-label={content.comment_field.title}
                placeholder={content.comment_field.placeholder}
                rows={3}
                style={{
                  width: "100%",
                  padding: "12px",
                  resize: "none",
                  background: "var(--t-surface-card)",
                  border: "var(--t-border-width) solid var(--t-surface-border)",
                  borderRadius: "var(--t-radius-field)",
                  // Кегль поля не ниже 16: иначе Safari на iOS зумит страницу
                  // при фокусе, и через viewport это не отключается.
                  fontSize: "var(--k-field-font)",
                  fontFamily: "inherit",
                  color: "var(--t-text-primary)",
                }}
              />
            </SectionCard>
          )}

          {/* ── Зона 6: оплата — точка вставки «Ozon Банк» ───────────── */}
          <SectionCard testId="payment-block">
            <h2 style={sectionTitleStyle}>
              {tenant.payment_list.section_title ?? COPY["payment.section_title"]}
            </h2>
            <PaymentMethodList
              layout={tenant.payment_list.layout}
              methods={tenant.payment_list.methods}
              selected={selectedMethod}
              onSelect={onSelectMethod}
              padded={false}
              renderAfter={(methodId) =>
                phoneGate && methodId === OZON_METHOD_ID ? (
                  <div style={{ paddingBottom: "4px" }}>
                    <PhoneGateBlock {...phoneGate} />
                  </div>
                ) : null
              }
            />
          </SectionCard>

          {/* ── Зона 7: согласия под формой ──────────────────────────── */}
          {formAgreements.length > 0 && (
            <div
              className="flex w-full flex-col"
              style={{ paddingInline: "var(--t-page-padding)", gap: "10px" }}
            >
              {formAgreements.map(({ item, index }) => (
                <AgreementRow
                  key={item.text}
                  testId={`agreement-${index + 1}`}
                  text={item.text}
                  links={item.links}
                  checked={agreements[index]}
                  onToggle={() => toggleAgreement(index)}
                />
              ))}
            </div>
          )}

          {/* ── Зона 8: кнопка, а ПОД НЕЙ состав заказа ──────────────── */}
          <SectionCard testId="cart-block">
            {ctaButton}

            {ctaAgreements.map(({ item, index }) => (
              <AgreementRow
                key={item.text}
                testId={`agreement-${index + 1}`}
                text={item.text}
                links={item.links}
                checked={agreements[index]}
                onToggle={() => toggleAgreement(index)}
                compact
              />
            ))}

            {content.cart && (
              <>
                {content.cart.title && (
                  <h2 data-testid="cart-title" style={sectionTitleStyle}>
                    {content.cart.title}
                  </h2>
                )}

                {content.cart.use_line_items &&
                  content.line_items.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      data-testid={`line-item-${index + 1}`}
                      className="flex w-full items-start"
                      style={{ gap: "12px" }}
                    >
                      {item.media && (
                        <span className="shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.image_alt ?? item.title}
                              width={60}
                              height={60}
                              style={{
                                width: "60px",
                                height: "60px",
                                objectFit: "cover",
                                borderRadius: "var(--t-radius-card)",
                              }}
                            />
                          ) : (
                            <span
                              aria-hidden
                              style={{
                                display: "block",
                                width: "60px",
                                height: "60px",
                                borderRadius: "var(--t-radius-card)",
                                background: "var(--t-surface-border)",
                              }}
                            />
                          )}
                        </span>
                      )}

                      <span className="flex min-w-0 flex-1 flex-col">
                        {item.period && (
                          <span
                            style={{
                              fontSize: "var(--t-font-caption)",
                              color: "var(--t-text-primary)",
                              lineHeight: 1.4,
                            }}
                          >
                            {item.period}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "var(--t-font-body)",
                            fontWeight: 600,
                            color: "var(--t-text-primary)",
                            lineHeight: 1.3,
                          }}
                        >
                          {item.title}
                        </span>
                        {item.quantity !== null && (
                          <span
                            data-testid={`line-item-${index + 1}-quantity`}
                            style={{
                              fontSize: "var(--t-font-caption)",
                              color: "var(--t-text-secondary)",
                            }}
                          >
                            {item.quantity} шт.
                          </span>
                        )}
                      </span>

                      <span
                        style={{
                          fontSize: "var(--t-font-body)",
                          fontWeight: 700,
                          color: "var(--t-text-primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.price}
                      </span>
                    </div>
                  ))}

                {/* Итоги: цвет значения несёт смысл. Скидка красная, бесплатная
                    доставка зелёная — у донора цветных значений ровно два, и
                    раскрашивать остальные нельзя. */}
                <div
                  data-testid="totals-block"
                  data-variant="cart_rows"
                  className="flex w-full flex-col"
                  style={{
                    paddingTop: "12px",
                    gap: "10px",
                    borderTop: "var(--t-border-width) solid var(--t-surface-border)",
                  }}
                >
                  {content.cart.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex w-full items-baseline justify-between"
                      style={{ gap: "12px" }}
                    >
                      <span className="flex min-w-0 items-baseline" style={{ gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "var(--t-font-body)",
                            fontWeight: row.emphasis ? 700 : 400,
                            color: "var(--t-text-primary)",
                          }}
                        >
                          {row.label}
                        </span>
                        {row.hint && (
                          <span
                            style={{
                              fontSize: "var(--t-font-caption)",
                              color: "var(--t-text-secondary)",
                            }}
                          >
                            {row.hint}
                          </span>
                        )}
                      </span>
                      <span
                        data-testid={row.emphasis ? "totals-value" : undefined}
                        style={{
                          fontSize: "var(--t-font-body)",
                          fontWeight: 700,
                          color: toneColor(row.tone),
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}

                  {/*
                    Итог у донора живёт СПРАВА в строке с бонусами, а под ними
                    идёт вторая строка: зачёркнутая цена без скидки слева и вес
                    заказа справа. Отдельной строкой списка итог вставал бы над
                    бонусами — порядка «сначала сумма, потом что начислим» у
                    донора нет.
                  */}
                  {(content.cart.total ||
                    content.cart.bonus ||
                    content.cart.note ||
                    content.cart.old_total) && (
                    <div
                      className="flex w-full flex-col"
                      style={{
                        paddingTop: "10px",
                        gap: "2px",
                        borderTop: "var(--t-border-width) solid var(--t-surface-border)",
                      }}
                    >
                      <div
                        className="flex w-full items-baseline justify-between"
                        style={{ gap: "12px" }}
                      >
                        {content.cart.bonus && (
                          <span
                            data-testid="cart-bonus"
                            className="min-w-0"
                            style={{
                              fontSize: "var(--t-font-body)",
                              color: "var(--t-text-primary)",
                            }}
                          >
                            {content.cart.bonus}
                          </span>
                        )}
                        {content.cart.total && (
                          <span
                            data-testid="totals-value"
                            className="ml-auto"
                            style={{
                              fontSize: "var(--t-font-body)",
                              fontWeight: 700,
                              color: "var(--t-text-primary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {content.cart.total.label} {content.cart.total.value}
                          </span>
                        )}
                      </div>

                      {(content.cart.old_total || content.cart.note) && (
                        <div
                          className="flex w-full items-baseline justify-between"
                          style={{ gap: "12px" }}
                        >
                          {content.cart.old_total && (
                            <span
                              style={{
                                fontSize: "var(--t-font-caption)",
                                color: "var(--t-text-secondary)",
                                textDecoration: "line-through",
                              }}
                            >
                              {content.cart.old_total}
                            </span>
                          )}
                          {content.cart.note && (
                            <span
                              className="ml-auto"
                              style={{
                                fontSize: "var(--t-font-caption)",
                                color: "var(--t-text-secondary)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {content.cart.note}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--t-font-section-title)",
  fontWeight: "var(--t-title-weight)",
  color: "var(--t-text-primary)",
};

function toneColor(tone: "default" | "discount" | "positive"): string {
  if (tone === "discount") return "var(--t-surface-danger)";
  if (tone === "positive") return "var(--t-surface-positive, var(--t-text-primary))";
  return "var(--t-text-primary)";
}

/**
 * Инсетная карточка-секция: заголовок ВНУТРИ рамки, поля страницы уменьшены.
 * Для full-bleed доноров это анти-паттерн R1, для этого — его собственный вид.
 */
function SectionCard({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <section
      data-testid={testId}
      className="flex w-full flex-col"
      style={{
        // Замер донора: карточка отбита от края 8 px, внутреннее поле 16,
        // расстояние между блоками внутри — 20. Поле страницы (H1, согласия)
        // при этом больше: инсет карточки меньше поля текста, и именно это
        // делает карточки «вставленными», а не просто обведёнными.
        marginInline: "8px",
        width: "auto",
        padding: "16px",
        gap: "20px",
        background: "var(--t-surface-card)",
        border: "var(--t-border-width) solid var(--t-surface-border)",
        borderRadius: "var(--t-radius-card)",
      }}
    >
      {children}
    </section>
  );
}

/** Действие-ссылка цветом бренда: «Заполнить», «Изменить». */
function AccentAction({ label, testId }: { label: string; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="flex shrink-0 items-center"
      style={{
        minHeight: "var(--k-tap-min)",
        background: "none",
        border: "none",
        padding: 0,
        fontSize: "var(--t-font-caption)",
        fontWeight: 500,
        color: "var(--t-brand-text-on-bg)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Чекбокс согласия. Подписи ссылок подсвечены брендом и подчёркнуты:
 * подчёркивание — второй канал, он переживает коррекцию контраста.
 */
function AgreementRow({
  text,
  links,
  checked,
  onToggle,
  testId,
  compact = false,
}: {
  text: string;
  links: string[];
  checked: boolean;
  onToggle: () => void;
  testId: string;
  compact?: boolean;
}) {
  return (
    <label
      data-testid={testId}
      className="flex w-full items-start"
      style={{ gap: "10px", cursor: "pointer" }}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      <span
        aria-hidden
        className="flex items-center justify-center"
        style={{
          width: "16px",
          height: "16px",
          marginTop: "2px",
          flexShrink: 0,
          borderRadius: "2px",
          border: checked
            ? "var(--t-border-width) solid var(--t-brand-primary)"
            : "var(--t-border-width) solid var(--t-surface-border)",
          background: checked ? "var(--t-brand-primary)" : "var(--t-surface-card)",
        }}
      >
        {checked && <CheckGlyph size={10} color="var(--t-brand-primary-on)" />}
      </span>
      <span
        style={{
          fontSize: "var(--t-font-caption)",
          lineHeight: 1.5,
          color: compact ? "var(--t-text-secondary)" : "var(--t-text-primary)",
        }}
      >
        {renderWithLinks(text, links)}
      </span>
    </label>
  );
}

/** Подсветка перечисленных подстрок как ссылок внутри сплошного текста. */
function renderWithLinks(text: string, links: string[]): ReactNode {
  if (links.length === 0) return text;
  const pattern = links
    .map((link) => link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "g"));
  return parts.map((part, index) =>
    links.includes(part) ? (
      <span
        key={`${part}-${index}`}
        style={{ color: "var(--t-brand-text-on-bg)", textDecoration: "underline" }}
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
}
