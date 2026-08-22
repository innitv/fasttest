import type { CSSProperties } from "react";

import { PaymentMethodList } from "@demo/components/PaymentMethodList";
import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { resolveCtaLabel } from "@demo/content/copy";
import type { ButtonState } from "@demo/components/PrimaryButton";
import type { TenantConfig } from "@demo/theme/tenant.schema";
import type { PhoneGateSlot } from "./screen-props";

interface Props {
  tenant: TenantConfig;
  selectedMethod: string | null;
  onSelectMethod: (id: string) => void;
  ctaState: ButtonState;
  ctaLoadingLabel: string;
  ctaSentLabel: string;
  onCta: () => void;
  onBack: () => void;
  phoneGate: PhoneGateSlot | null;
}

/**
 * `S-J-pay` — второй экран подрядчика архетипа `carrier_delivery`: страница
 * оплаты донора EWA (ewaproduct.com/ru/checkout/confirm-order).
 *
 * Это ещё экран ПОДРЯДЧИКА (тема `--t-*`), а не банк: смена айдентики
 * наступает только на пуше. Отличие от `OzonRailScreen` архетипа B
 * принципиальное: там отдельный экран ОДНОГО способа (донор Uchi ведёт на
 * него тапом), здесь — собственный экран ВЫБОРА оплаты донора, где «Ozon
 * Банк» встаёт в его готовую сетку карточек-логотипов первой из пяти. Демо
 * здесь ничего не достраивает сверх донора — второй такой случай после MYBOX.
 *
 * Две вещи донора, которые легко потерять:
 *
 * 1. Заголовок секции набран КАПСОМ и весом 700 («ИНФОРМАЦИЯ О ЗАКАЗЕ»,
 *    «СПОСОБЫ ОПЛАТЫ») — на экране доставки заголовки блоков, наоборот,
 *    обычные 14/500. Один и тот же шрифт, две разные роли.
 * 2. Кнопка называется «ОПЛАТИТЬ» капсом и стоит ПОД согласиями, внутри той
 *    же карточки счёта, что и суммы со способами оплаты. Отдельной липкой
 *    панели у донора нет.
 */
export function CarrierPaymentScreen({
  tenant,
  selectedMethod,
  onSelectMethod,
  ctaState,
  ctaLoadingLabel,
  ctaSentLabel,
  onCta,
  onBack,
  phoneGate,
}: Props) {
  const { content } = tenant;

  const payable = content.totals.sum - content.totals.discount;
  const ctaLabel = resolveCtaLabel(
    tenant.cta.pay_label ?? tenant.cta.label,
    tenant.cta.include_amount,
    payable,
  );

  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };
  const LINE = 1.2;

  const sectionCaps: CSSProperties = {
    margin: 0,
    fontSize: "var(--t-font-section-title)",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    textTransform: "uppercase",
    color: "var(--t-text-primary)",
    lineHeight: LINE,
  };

  const groupTitle: CSSProperties = {
    fontSize: "var(--t-font-body)",
    fontWeight: "var(--t-label-weight)",
    color: "var(--t-text-primary)",
    lineHeight: LINE,
  };

  const groupBody: CSSProperties = {
    marginTop: "6px",
    fontSize: "var(--t-font-body)",
    color: "var(--t-text-primary)",
    lineHeight: 1.35,
  };

  return (
    <div className="relative flex h-full w-full flex-col">
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
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад к доставке"
            style={{
              display: "flex",
              alignItems: "center",
              minWidth: "var(--k-tap-min)",
              minHeight: "var(--k-tap-min)",
              marginInlineStart: "-12px",
              paddingInline: "12px",
              color: "var(--t-brand-primary-on)",
            }}
          >
            <span aria-hidden style={{ fontSize: "18px", lineHeight: 1 }}>
              ‹
            </span>
          </button>

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
        </div>
      </header>

      <div
        data-testid="screen-scroll"
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ background: "var(--t-surface-background)" }}
      >
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
          <span>Доставка</span>
          <span aria-hidden>/</span>
          <span style={{ color: "var(--t-text-primary)" }}>Подтверждение</span>
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
            fontWeight: "var(--t-title-weight)",
            textTransform: "uppercase",
            color: "var(--t-text-primary)",
            lineHeight: 1,
          }}
        >
          Оплата
        </h1>

        <div className="flex flex-col" style={{ ...pad, gap: "40px", paddingBottom: "24px" }}>
          {/* ── Информация о заказе ────────────────────────────────── */}
          <section
            data-testid="order-info"
            style={{
              background: "var(--t-surface-card)",
              borderRadius: "19px",
              padding: "19px 14px",
            }}
          >
            <h2 style={sectionCaps}>Информация о заказе</h2>

            {content.pickup_point && (
              <div style={{ marginTop: "18px" }}>
                <div style={groupTitle}>Адрес и способ доставки</div>
                <div style={groupBody}>
                  {content.pickup_point.title}
                  <br />
                  {content.pickup_point.address}
                </div>
              </div>
            )}

            {content.recipient && (
              <div style={{ marginTop: "18px" }}>
                <div style={groupTitle}>Получатель</div>
                <div style={groupBody}>
                  {content.recipient.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {content.pickup_point && (
              <div
                style={{
                  marginTop: "22px",
                  fontSize: "var(--t-font-body)",
                  color: "var(--t-text-primary)",
                  lineHeight: LINE,
                }}
              >
                Ждём вас в пункте выдачи {tenant.display_name}
              </div>
            )}
          </section>

          {/* ── Счёт: суммы, способы оплаты, согласия, кнопка ──────── */}
          <section
            data-testid="totals"
            style={{ background: "var(--t-surface-card-alt)", borderRadius: "19px", padding: "18px 13px" }}
          >
            <div className="flex items-baseline justify-between">
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--t-font-section-title)",
                  fontWeight: "var(--t-title-weight)",
                  color: "var(--t-text-primary)",
                }}
              >
                Итого
              </h2>
              <span
                style={{
                  /* Как на доставке: итог мельче заголовка и жирнее. */
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
              style={{ marginTop: "13px", height: "1px", background: "var(--t-surface-divider)" }}
            />

            <div
              className="flex items-baseline justify-between"
              style={{ marginTop: "16px", fontSize: "16px", color: "var(--t-text-primary)" }}
            >
              <span>Стоимость товаров</span>
              <span>{formatRub(content.totals.sum)}</span>
            </div>

            <h2 style={{ ...sectionCaps, marginTop: "26px" }}>
              {tenant.payment_list.section_title ?? "Способы оплаты"}
            </h2>

            <div style={{ marginTop: "14px" }}>
              <PaymentMethodList
                layout={tenant.payment_list.layout}
                methods={tenant.payment_list.methods}
                selected={selectedMethod}
                onSelect={onSelectMethod}
                padded={false}
              />
            </div>

            {phoneGate?.expanded && (
              <div style={{ marginTop: "16px" }}>
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

            {/*
             * Согласия донора: два чекбокса мелким кеглем под способами оплаты.
             * В демо они уже отмечены — ничего не отправляется, а неотмеченный
             * чекбокс глушил бы кнопку и прятал главное действие маршрута.
             */}
            <div
              data-testid="agreements"
              className="flex flex-col"
              style={{
                gap: "10px",
                marginTop: "20px",
                fontSize: "10px",
                color: "var(--t-text-secondary)",
                lineHeight: 1.3,
              }}
            >
              <label className="flex items-start" style={{ gap: "9px" }}>
                <span
                  aria-hidden
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: "13px",
                    height: "13px",
                    marginTop: "1px",
                    borderRadius: "3px",
                    border: "1px solid var(--t-surface-border)",
                    background: "var(--t-surface-form)",
                  }}
                />
                <span>
                  Даю согласие на обработку своих персональных данных и согласен с условиями
                  публичной оферты и политикой конфиденциальности
                </span>
              </label>
            </div>

            <div style={{ marginTop: "18px" }}>
              <PrimaryButton
                label={ctaLabel}
                loadingLabel={ctaLoadingLabel}
                sentLabel={ctaSentLabel}
                state={selectedMethod === null ? "disabled" : ctaState}
                onClick={onCta}
              />
            </div>
          </section>

          {content.referral && (
            <section data-testid="referral" style={{ paddingInline: "14px" }}>
              <h2
                style={{
                  margin: 0,
                  /* Гарнитура сайта донора, как на экране доставки. */
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

function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks / 100);
  return `${rub.toLocaleString("ru-RU").replace(/ /g, " ")} ₽`;
}
