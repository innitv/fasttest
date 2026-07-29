import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton, STICKY_PANEL_RESERVE, StickyCtaPanel } from "@demo/components/PrimaryButton";
import { ScreenHeader } from "@demo/components/ScreenHeader";
import { CheckGlyph, NeutralPlate } from "@demo/components/primitives";
import { COPY, resolveCtaLabel } from "@demo/content/copy";
import { OZON_METHOD_ID } from "@demo/theme/tenant.schema";
import type { ScreenProps } from "./screen-props";

/**
 * `S-E` — архетип `store_checkout`, четвёртая калибровочная крайность.
 *
 * Снят целиком с чекаута магазина одежды: не «строки реквизитов + оплата»,
 * а последовательность ШАГОВ ЗАКАЗА. Каждый шаг — секция с заголовком
 * капсом, галочкой готовности и своей ссылкой правки; галочка здесь несёт
 * состояние, а не украшает. Ниже кнопки лежит состав корзины с миниатюрой
 * и тремя строками итогов — донор ставит действие ПЕРЕД составом, и этот
 * порядок узнаётся раньше палитры.
 *
 * Порядок зон донора (`monochrome.ru/order`, снят по computed styles):
 * шапка с логотипом → H1 → адрес аккаунта → секции шагов → сертификат →
 * способ оплаты → юридическая сноска → кнопка → корзина → итоги.
 */
import { useState } from "react";

export function StoreCheckoutScreen({
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

  const [giftChecked, setGiftChecked] = useState(false);

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount,
  );

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

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

  const pad = { paddingInline: "var(--t-page-padding)" };

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
          paddingBottom: inlineCta ? "var(--k-page-bottom-reserve)" : STICKY_PANEL_RESERVE,
        }}
      >
        {/* ── Зона 1: заголовок и аккаунт ──────────────────────────── */}
        <div style={{ ...pad, paddingTop: "16px" }}>
          <h1
            data-testid="page-title"
            style={{
              margin: 0,
              fontSize: "var(--t-font-h1)",
              fontWeight: "var(--t-title-weight)" as unknown as number,
              color: "var(--t-text-primary)",
              lineHeight: 1.3,
            }}
          >
            {content.title}
          </h1>
          {content.account_email && (
            <p
              data-testid="account-email"
              style={{
                margin: "6px 0 0",
                fontSize: "var(--t-font-caption)",
                color: "var(--t-text-secondary)",
              }}
            >
              {content.account_email}
            </p>
          )}
        </div>

        {/* ── Зона 2: секции-шаги заказа ───────────────────────────── */}
        {content.sections.map((section, index) => (
          <section
            key={section.title}
            data-testid={`order-section-${index + 1}`}
            style={{ ...pad, paddingTop: "28px" }}
          >
            <div className="flex items-center" style={{ gap: "8px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: 400,
                  textTransform: "uppercase",
                  color: "var(--t-text-primary)",
                }}
              >
                {section.title}
              </h2>
              {/* Галочка = шаг заказа пройден. Донор ставит её вплотную к
                  заголовку, а не в конец строки. */}
              {section.done && (
                <span
                  data-testid={`section-done-${index + 1}`}
                  aria-label={COPY["section.done"]}
                  style={{ display: "flex", color: "var(--t-text-primary)" }}
                >
                  <CheckGlyph />
                </span>
              )}
            </div>

            {/*
              Содержимое шага лежит в карточке с рамкой, а заголовок остаётся
              СНАРУЖИ неё — донорская вложенность. Плоский текст на белом читался
              как черновик: рамка здесь и есть граница шага.
            */}
            <div
              className="flex w-full flex-col"
              style={{
                marginTop: "12px",
                padding: "16px",
                gap: "10px",
                border: "var(--t-border-width) solid var(--t-surface-border)",
                borderRadius: "var(--t-radius-card)",
              }}
            >
              {section.rows.map((row, rowIndex) => (
                <div key={`${section.title}-${rowIndex}`} className="flex w-full flex-col">
                  {row.label && (
                    <div className="flex w-full items-baseline" style={{ gap: "8px" }}>
                      <span
                        className="min-w-0 flex-1"
                        style={{
                          fontSize: "var(--t-font-caption)",
                          color: "var(--t-text-secondary)",
                        }}
                      >
                        {row.label}
                      </span>
                      {/* Ссылка правки живёт на первой строке секции: у донора
                          она выровнена по подписи, а не по заголовку. */}
                      {rowIndex === 0 && section.action_label && (
                        <button
                          type="button"
                          data-testid={`section-action-${index + 1}`}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            fontSize: "var(--t-font-caption)",
                            color: "var(--t-text-primary)",
                            textDecoration: "underline",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          {section.action_label}
                        </button>
                      )}
                    </div>
                  )}
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "var(--t-font-body)",
                      lineHeight: 1.35,
                      color: "var(--t-text-primary)",
                      // Донор держит часы работы отдельной строкой под адресом;
                      // без `pre-line` перенос из конфига схлопывается в пробел.
                      whiteSpace: "pre-line",
                    }}
                  >
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* ── Зона 3: оплата ───────────────────────────────────────── */}
        <section data-testid="payment-block" style={{ ...pad, paddingTop: "28px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--t-font-section-title)",
              fontWeight: 400,
              textTransform: "uppercase",
              color: "var(--t-text-primary)",
            }}
          >
            {tenant.payment_list.section_title ?? COPY["payment.section_title"]}
          </h2>

          {/*
            Сертификат — не подпись, а чекбокс: у донора слева от текста стоит
            скруглённый квадрат 14×14 (радиус 5). Без него строка читается как
            заголовок, а не как то, что можно отметить.
          */}
          {content.gift_certificate && (
            <label
              data-testid="gift-certificate"
              className="flex items-center"
              style={{ marginTop: "16px", gap: "8px", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={giftChecked}
                onChange={(event) => setGiftChecked(event.target.checked)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="flex items-center justify-center"
                style={{
                  width: "14px",
                  height: "14px",
                  flexShrink: 0,
                  borderRadius: "5px",
                  border: "var(--t-border-width) solid var(--t-surface-border)",
                  background: giftChecked
                    ? "var(--t-brand-primary)"
                    : "var(--t-surface-card)",
                }}
              >
                {giftChecked && <CheckGlyph size={9} color="var(--t-brand-on)" />}
              </span>
              <span
                style={{
                  fontSize: "var(--t-font-caption)",
                  textTransform: "uppercase",
                  color: "var(--t-text-primary)",
                }}
              >
                {content.gift_certificate}
              </span>
            </label>
          )}

          {/* Общей рамки вокруг группы у донора нет: рамку несёт каждый способ. */}
          <div style={{ marginTop: "12px" }}>
            <PaymentMethodList
              layout={tenant.payment_list.layout}
              methods={tenant.payment_list.methods}
              selected={selectedMethod}
              onSelect={onSelectMethod}
              padded={false}
              renderAfter={(methodId) =>
                phoneGate && methodId === OZON_METHOD_ID ? (
                  <div style={{ paddingInline: "20px", paddingBottom: "4px" }}>
                    <PhoneGateBlock {...phoneGate} />
                  </div>
                ) : null
              }
            />
          </div>

          {content.legal_note && (
            <p
              data-testid="legal-note"
              style={{
                margin: "20px 0 0",
                fontSize: "var(--t-font-caption)",
                lineHeight: 1.4,
                textTransform: "uppercase",
                color: "var(--t-text-primary)",
              }}
            >
              {content.legal_note}
            </p>
          )}

          {inlineCta && <div style={{ marginTop: "20px" }}>{ctaButton}</div>}
        </section>

        {/* ── Зона 4: корзина ПОД кнопкой ──────────────────────────── */}
        {content.cart && (
          <section
            data-testid="cart-block"
            style={{ ...pad, marginTop: "28px" }}
          >
            {/*
              Рамка корзины МЯГЧЕ, чем у секций-шагов (у донора .06 против .13):
              состав заказа уже подтверждён и не спорит за внимание с шагами,
              которые пользователь заполняет.
            */}
            <div
              style={{
                padding: "10px",
                border: "var(--t-border-width) solid var(--t-surface-divider)",
                borderRadius: "var(--t-radius-card)",
              }}
            >
              {/*
                В карточке донора нет ни названия товара, ни размера — только
                изображение: название живёт его подписью. Прежний текст рядом с
                миниатюрой был моей достройкой и делал блок чужим.
                Плашка вместо фото — демо не тащит чужие ассеты, но пропорция
                65×97 и прямые углы донора сохранены.
              */}
              <NeutralPlate
                width="65px"
                height="97px"
                label={content.cart.item_title}
                style={{ borderRadius: 0 }}
              />

            <div
              className="flex w-full items-center justify-between"
              style={{ marginTop: "10px", gap: "12px" }}
            >
              {content.cart.edit_label && (
                <button
                  type="button"
                  data-testid="cart-edit"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: "var(--t-font-caption)",
                    color: "var(--t-text-primary)",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  {content.cart.edit_label}
                </button>
              )}
              {content.cart.quantity_label && (
                <span
                  style={{
                    fontSize: "var(--t-font-caption)",
                    color: "var(--t-text-secondary)",
                  }}
                >
                  {content.cart.quantity_label}
                </span>
              )}
            </div>
            </div>

            {/*
              Итоги лежат ВНЕ карточки товара: у донора рамка обрамляет только
              состав заказа, а суммы идут ниже строками с тонкой линией. Внутри
              карточки они читались как часть товара.
            */}
            <div
              data-testid="totals-block"
              data-variant="cart_rows"
              className="flex w-full flex-col"
              style={{ marginTop: "25px" }}
            >
              {content.cart.rows.map((row, rowIndex) => {
                const last = rowIndex === (content.cart?.rows.length ?? 0) - 1;
                return (
                <div
                  key={row.label}
                  className="flex w-full items-center justify-between"
                  style={{
                    gap: "12px",
                    // Слагаемые отделены линией снизу, итоговая строка её не
                    // имеет и отбита сверху — так закрывается список у донора.
                    paddingBottom: last ? 0 : "10px",
                    marginTop: last ? "10px" : 0,
                    borderBottom: last
                      ? "none"
                      : "var(--t-border-width) solid var(--t-surface-divider)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--t-font-caption)",
                      color: row.emphasis
                        ? "var(--t-text-primary)"
                        : "var(--t-text-secondary)",
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    data-testid={row.emphasis ? "totals-value" : undefined}
                    style={{
                      fontSize: "var(--t-font-caption)",
                      fontWeight: row.emphasis
                        ? ("var(--t-label-weight)" as unknown as number)
                        : 400,
                      color: row.emphasis
                        ? "var(--t-text-primary)"
                        : "var(--t-text-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {!inlineCta && <StickyCtaPanel>{ctaButton}</StickyCtaPanel>}
    </div>
  );
}
