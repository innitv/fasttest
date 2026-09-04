import { useState, type CSSProperties } from "react";

import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import {
  PrimaryButton,
  STICKY_PANEL_RESERVE,
  StickyCtaPanel,
} from "@demo/components/PrimaryButton";
import {
  COPY,
  formatMoney,
  methodAccessibleName,
  resolveCtaLabel,
} from "@demo/content/copy";
import { OZON_METHOD_ID } from "@demo/theme/tenant.schema";
import type { ScreenProps } from "./screen-props";

/**
 * Архетип `subscription_bind`, донор Яндекс Пэй (подключение Яндекс Плюса).
 *
 * Экран НЕ оплачивает счёт: он подключает регулярное списание. Пользователь
 * платит рубль сейчас и разрешает списывать подписку дальше — поэтому
 * порядок блоков донорский: сначала «что подключается» с условием будущей
 * цены, потом «чем платить», и только в конце сумма ближайшего списания и
 * кнопка. Итогов и состава заказа нет вовсе: считать нечего.
 *
 * Донор двухколоночный (слева подключение, справа оплата). В телефоне
 * колонки становятся ЗОНАМИ по вертикали: лавандовая зона подключения
 * сверху, белая зона оплаты снизу — тот же порядок чтения, что у донора
 * слева направо, и та же граница материалов.
 *
 * Сценарий демо встраивается в СУЩЕСТВУЮЩИЙ список донора: «Ozon Банк»
 * встаёт первой строкой среди привязанных карт, а не в достроенную шторку.
 * Подпись строки называет платёжный сервис, через который пойдут списания.
 */
export function SubscriptionBindScreen({
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
  const bind = content.bind;

  const upsell = bind?.plans.find((plan) => plan.toggle) ?? null;
  const [upsellOn, setUpsellOn] = useState(upsell?.default_on ?? false);
  const [consentOn, setConsentOn] = useState(bind?.consent?.default_checked ?? true);

  const pad: CSSProperties = { paddingInline: "var(--t-page-padding)" };

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount,
  );

  const disabled =
    forcedState === "cta_disabled" ||
    (tenant.cta.requires_selection && selectedMethod === null);

  const nextChargeNote =
    (upsellOn ? upsell?.next_charge_note : null) ?? bind?.next_charge_note ?? null;

  const captionText: CSSProperties = {
    fontSize: "var(--t-font-caption)",
    lineHeight: 1.38,
    color: "var(--t-text-secondary)",
  };

  /** Сноска донора — карточка тонального фона, а не абзац под кнопкой. */
  const noteCard: CSSProperties = {
    ...captionText,
    margin: 0,
    lineHeight: 1.45,
    background: "var(--t-surface-form)",
    borderRadius: "var(--t-radius-card)",
    padding: "14px 12px",
  };

  return (
    <div
      data-screen-root
      className="relative flex h-full w-full flex-col"
      style={{ background: "var(--t-surface-background)" }}
    >
      {/* ── Зона 1: строка аккаунта и закрытие ─────────────────────────
          Шапки сайта на этой форме нет вовсе: вверху только тот, кому
          подключают подписку, и крестик. Это платёжная форма поверх
          сервиса, а не страница сервиса. */}
      <header
        data-testid="screen-header"
        data-style="centered_logo"
        className="flex w-full shrink-0 items-center justify-between"
        style={{ height: "56px", ...pad }}
      >
        <span className="flex min-w-0 items-center" style={{ gap: "10px" }}>
          <span
            aria-hidden
            className="shrink-0"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "9999px",
              background: "var(--t-surface-border)",
            }}
          />
          <span
            data-testid="account-email"
            style={{
              fontSize: "var(--t-font-body)",
              color: "var(--t-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {content.account_email}
          </span>
        </span>

        <button
          type="button"
          aria-label={COPY["a11y.close"]}
          className="tap-press flex shrink-0 items-center justify-center"
          style={{
            width: "var(--k-tap-min)",
            height: "var(--k-tap-min)",
            marginInlineEnd: "-10px",
            background: "none",
            border: "none",
            color: "var(--t-text-primary)",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path
              d="M1 1l16 16M17 1L1 17"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex-1 overflow-y-auto"
        style={{
          // Резерв под липкую панель: без него последняя карточка уходит
          // под кнопку и «Оплата через Пэй» не долистывается.
          paddingBottom: STICKY_PANEL_RESERVE,
        }}
      >
        {/* ── Зона 2: что подключается ────────────────────────────────
            Лавандовая зона донора: заголовок и карточки условий. Цена здесь
            не итог, а УСЛОВИЕ — «столько сейчас, столько потом». */}
        {bind && (
          <section
            data-testid="bind-block"
            className="flex flex-col"
            style={{ ...pad, paddingBottom: "24px", gap: "12px" }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "var(--t-font-h1)",
                fontWeight: "var(--t-title-weight)",
                lineHeight: 1.15,
                color: "var(--t-text-primary)",
              }}
            >
              {bind.title}
            </h1>

            {bind.plans.map((plan) => (
              <article
                key={plan.id}
                data-testid={"bind-plan-" + plan.id}
                style={{
                  background: "var(--t-surface-card)",
                  borderRadius: "var(--t-radius-card)",
                  padding: "16px",
                }}
              >
                <div className="flex items-start" style={{ gap: "12px" }}>
                  {plan.logo && (
                    <img
                      src={plan.logo}
                      alt={plan.logo_alt ?? ""}
                      width={40}
                      height={40}
                      className="shrink-0"
                      style={{ borderRadius: "9999px" }}
                    />
                  )}

                  <div className="flex min-w-0 flex-1 flex-col" style={{ gap: "2px" }}>
                    <span
                      style={{
                        fontSize: "var(--t-font-body)",
                        fontWeight: "var(--t-emphasis-weight)",
                        color: "var(--t-text-primary)",
                      }}
                    >
                      {plan.title}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--t-font-body)",
                        lineHeight: 1.3,
                        color: "var(--t-text-primary)",
                      }}
                    >
                      {plan.price_accent && (
                        <span style={{ color: "var(--t-link)" }}>{plan.price_accent}</span>
                      )}
                      {plan.price_rest}
                    </span>
                  </div>

                  {/* Тумблер апселла: трек 44×26, зона нажатия 44 задаётся
                      САМОЙ кнопкой — фон с padding дал бы серый овал 44×44
                      вместо переключателя донора. */}
                  {plan.toggle && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={upsellOn}
                      aria-label={plan.title}
                      data-testid={"bind-toggle-" + plan.id}
                      onClick={() => setUpsellOn((v) => !v)}
                      className="tap-press flex shrink-0 items-center justify-end"
                      style={{
                        width: "var(--k-tap-min)",
                        height: "var(--k-tap-min)",
                        marginBlock: "-9px",
                        marginInlineEnd: "-6px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        aria-hidden
                        className="relative block"
                        style={{
                          width: "44px",
                          height: "26px",
                          borderRadius: "9999px",
                          background: upsellOn
                            ? "var(--t-brand-fill)"
                            : "var(--t-surface-track)",
                          transition: "background var(--k-motion-fast)",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: upsellOn ? "21px" : "3px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "9999px",
                            background: "var(--t-surface-card)",
                            transition: "left var(--k-motion-fast)",
                          }}
                        />
                      </span>
                    </button>
                  )}
                </div>

                {plan.features.length > 0 && (
                  <ul
                    className="flex flex-col"
                    style={{
                      margin: "12px 0 0",
                      padding: 0,
                      listStyle: "none",
                      gap: "4px",
                    }}
                  >
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex"
                        style={{ ...captionText, gap: "6px" }}
                      >
                        <span aria-hidden>•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </section>
        )}

        {/* ── Зона 3: чем платить ─────────────────────────────────────
            Белая зона донора. Список СМЕШАННЫЙ: привязанные способы, способ
            с переходом вглубь и строки-действия лежат в одном списке через
            разделители, а не разнесены по секциям. */}
        <section
          data-testid="payment-section"
          className="flex flex-col"
          style={{
            marginInline: "var(--t-page-padding)",
            background: "var(--t-surface-card)",
            borderRadius: "var(--t-radius-card)",
            padding: "16px",
          }}
        >
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "var(--t-font-section-title)",
              fontWeight: "var(--t-title-weight)",
              lineHeight: 1.2,
              color: "var(--t-text-primary)",
            }}
          >
            {bind?.methods_title ?? COPY["payment.methods_title"]}
          </h2>

          <div role="radiogroup" aria-label={COPY["a11y.payment_group"]}>
            {tenant.payment_list.methods.map((method, index) => {
              const selectable = method.row_action === "select";
              const isSelected = selectable && selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  role={selectable ? "radio" : undefined}
                  aria-checked={selectable ? isSelected : undefined}
                  aria-label={
                    selectable
                      ? methodAccessibleName(method.label, isSelected)
                      : method.label
                  }
                  data-testid={"method-" + method.id}
                  data-selected={isSelected || undefined}
                  onClick={() => selectable && onSelectMethod(method.id)}
                  className="flex w-full items-center"
                  style={{
                    minHeight: "var(--k-tap-min)",
                    height: "var(--t-row-height)",
                    gap: "14px",
                    background: "none",
                    border: "none",
                    borderTop:
                      index === 0
                        ? "none"
                        : "var(--t-border-width) solid var(--t-surface-divider)",
                    padding: 0,
                    textAlign: "left",
                    cursor: selectable ? "pointer" : "default",
                  }}
                >
                  {/* Плашка логотипа 40×40 есть у КАЖДОЙ строки, включая
                      действия: у донора в ней знак «плюс». */}
                  <span
                    aria-hidden
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: method.logo_src ? "transparent" : "var(--t-surface-form)",
                      color: "var(--t-text-secondary)",
                      overflow: "hidden",
                    }}
                  >
                    {method.logo_src ? (
                      <img
                        src={method.logo_src}
                        alt=""
                        width={40}
                        height={40}
                        style={{ display: "block" }}
                      />
                    ) : method.row_action === "add" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M8 1v14M1 8h14"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      /*
                       * Знак средства оплаты, пока файла логотипа нет. У
                       * донора плашка есть у КАЖДОЙ строки и всегда занята:
                       * пустой серый квадрат на её месте читается не как
                       * «логотип не задан», а как «картинка не загрузилась».
                       */
                      <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                        <rect
                          x="0.75"
                          y="0.75"
                          width="18.5"
                          height="12.5"
                          rx="2.25"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path d="M1 5h18" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      style={{
                        fontSize: "var(--t-font-body)",
                        color: "var(--t-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {method.label}
                    </span>
                    {method.caption && (
                      <span style={{ ...captionText, marginTop: "1px" }}>
                        {method.caption}
                      </span>
                    )}
                  </span>

                  {/* Правый край строки: галочка у выбранного, шеврон у
                      способа с переходом, ничего у действия. */}
                  {isSelected && (
                    <svg
                      width="18"
                      height="14"
                      viewBox="0 0 18 14"
                      fill="none"
                      aria-hidden
                      className="shrink-0"
                      style={{ color: "var(--t-brand-primary)" }}
                    >
                      <path
                        d="M1 7.5l5.5 5L17 1"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {method.row_action === "chevron" && (
                    <svg
                      width="8"
                      height="14"
                      viewBox="0 0 8 14"
                      fill="none"
                      aria-hidden
                      className="shrink-0"
                      style={{ color: "var(--t-text-secondary)" }}
                    >
                      <path
                        d="M1 1l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Проверка клиентства: раскрывается выбором «Ozon Банк» ── */}
          {phoneGate && (
            <div style={{ marginTop: "16px" }}>
              <PhoneGateBlock
                expanded={phoneGate.expanded && selectedMethod === OZON_METHOD_ID}
                digits={phoneGate.digits}
                error={phoneGate.error}
                checking={phoneGate.checking}
                onChange={phoneGate.onChange}
                onSubmit={phoneGate.onSubmit}
                focusSignal={phoneGate.focusSignal}
              />
            </div>
          )}

        </section>

        {/*
          ── Зона 4: пояснения карточками ──────────────────────────────
          У донора каждая сноска — СВОЯ карточка тонального фона на
          лавандовом, а не абзац мелким текстом под кнопкой: и про
          следующее списание, и правовая строка весят на экране столько
          же, сколько блок способов. Набранные текстом на белом, они
          читаются как примечание, которого можно не заметить, — а
          именно они объясняют, на что даётся согласие.
        */}
        <div
          className="flex flex-col"
          style={{
            ...pad,
            paddingTop: "12px",
            paddingBottom: "20px",
            gap: "8px",
          }}
        >
          {nextChargeNote && (
            <p data-testid="next-charge-note" style={noteCard}>
              {nextChargeNote}
            </p>
          )}

          {content.legal_note && <p style={noteCard}>{content.legal_note}</p>}

          {bind?.consent && (
            <label className="flex items-start" style={{ ...noteCard, gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consentOn}
                onChange={(event) => setConsentOn(event.target.checked)}
                data-testid="consent-checkbox"
                style={{
                  width: "22px",
                  height: "22px",
                  flexShrink: 0,
                  accentColor: "var(--t-brand-primary)",
                }}
              />
              <span>{bind.consent.text}</span>
            </label>
          )}

          {bind?.rail && (
            <p
              data-testid="pay-rail"
              className="flex items-center justify-center"
              style={{ ...captionText, margin: "8px 0 0" }}
            >
              {bind.rail}
            </p>
          )}
        </div>
      </div>

      {/*
        ── Зона 5: липкая панель оплаты ────────────────────────────────
        У донора сумма ближайшего списания и кнопка прижаты к низу экрана
        и лежат на своей белой панели поверх прокрутки: сколько спишется
        СЕЙЧАС, видно в любой точке страницы, а не только долистав до
        конца. Инлайн-кнопка на её месте меняла бы смысл — «подключить»
        становилось бы хвостом длинного текста согласий.
      */}
      <StickyCtaPanel>
        <span
          data-testid="charge-now"
          className="block"
          style={{
            marginBottom: "10px",
            fontSize: "var(--t-font-body)",
            fontWeight: "var(--t-emphasis-weight)",
            color: "var(--t-text-primary)",
          }}
        >
          {(bind?.charge_now_label ?? COPY["totals.payable.label"]) +
            " " +
            formatMoney(content.totals.sum - content.totals.discount)}
        </span>

        <PrimaryButton
          label={ctaLabel}
          loadingLabel={ctaLoadingLabel}
          sentLabel={ctaSentLabel}
          state={disabled ? "disabled" : ctaState}
          onClick={onCta}
          testId="primary-cta"
        />
      </StickyCtaPanel>
    </div>
  );
}
