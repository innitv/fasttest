import {
  PrimaryButton,
  STICKY_PANEL_RESERVE,
  StickyCtaPanel,
} from "@demo/components/PrimaryButton";
import { CheckGlyph, SurfaceCard } from "@demo/components/primitives";
import { COPY } from "@demo/content/copy";
import type { BankPayload } from "@demo/theme/bank-payload";
import type { TenantConfig } from "@demo/theme/tenant.schema";

interface Props {
  tenant: TenantConfig;
  payload: BankPayload;
  onRestart: () => void;
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  `O-4` — ОБРАТНАЯ СТОРОНА АРХИТЕКТУРНОЙ ГРАНИЦЫ
 *
 *  Экран банка не читает ни одного токена подрядчика. Этот экран не читает
 *  ни одного токена банка: во всём файле нет ни одной переменной `--bank-*`.
 *  Проверяется grep в обе стороны.
 *
 *  Смысл кадра: тема подрядчика вернулась целиком — интеграция не забрала
 *  пользователя себе.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Метка успеха окрашена в `brand.primary` тенанта, а не в зелёный:
 * зелёный не принадлежит ни одной теме и ввёл бы 26-ю ось темизации.
 * Второй, нецветовой канал смысла — слово «оплачен» в заголовке.
 *
 * Размещение CTA следует оси 20 темы: sticky у `flowwow-like`, в потоке
 * у `uchi-like`. Структура блока сводки различается по оси 1. Это и есть
 * доказательство, что экран собран по осям, а не перекрашен.
 */
export function PaidConfirmationScreen({ tenant, payload, onRestart }: Props) {
  const sticky = tenant.cta.placement === "sticky";

  const summary =
    tenant.archetype === "cart_checkout" ? (
      // Архетип A: белая full-bleed секция радиусом 20 на сером фоне
      <SurfaceCard
        testId="paid-summary"
        style={{ paddingInline: "var(--t-page-padding)", paddingBlock: "4px" }}
      >
        <div
          className="flex w-full items-center justify-between"
          style={{ minHeight: "var(--t-row-height)", gap: "12px" }}
        >
          <span
            style={{
              fontSize: "var(--t-font-body)",
              fontWeight: "var(--t-label-weight)" as unknown as number,
              color: "var(--t-text-primary)",
            }}
          >
            {payload.merchant}
          </span>
          <span
            style={{
              fontSize: "var(--t-font-body)",
              fontWeight: 400,
              color: "var(--t-text-primary)",
              whiteSpace: "nowrap",
            }}
          >
            {payload.summaryDetail}
          </span>
        </div>
      </SurfaceCard>
    ) : (
      // Архетип B: карточек нет — текст на фоне с разделителем сверху
      <div
        data-testid="paid-summary"
        className="flex w-full flex-col"
        style={{ paddingInline: "var(--t-page-padding)" }}
      >
        <span
          aria-hidden="true"
          style={{
            height: "1px",
            width: "100%",
            background: "var(--t-surface-divider)",
            marginBottom: "12px",
          }}
        />
        <span
          style={{
            fontSize: "var(--t-font-body)",
            fontWeight: 400,
            color: "var(--t-text-primary)",
          }}
        >
          {payload.merchant}
        </span>
        <span
          style={{
            marginTop: "2px",
            fontSize: "var(--t-font-caption)",
            color: "var(--t-text-secondary)",
          }}
        >
          {payload.summaryDetail}
        </span>
      </div>
    );

  const cta = (
    <PrimaryButton
      label={COPY["paid.cta"]}
      loadingLabel={COPY["paid.cta"]}
      state="default"
      onClick={onRestart}
      testId="paid-restart-cta"
    />
  );

  return (
    <div
      data-testid="paid-confirmation"
      data-archetype={tenant.archetype}
      className="relative flex h-full w-full flex-col"
    >
      <div
        data-testid="scroll-container"
        className="no-scrollbar relative flex flex-1 flex-col overflow-y-auto"
        style={{ paddingBottom: sticky ? STICKY_PANEL_RESERVE : "24px" }}
      >
        <div
          className="flex flex-col items-center"
          style={{ paddingTop: "132px", paddingInline: "var(--t-page-padding)" }}
        >
          {/* Метка успеха: заливка brand.primary, глиф по автоподбору */}
          <span
            data-testid="success-mark"
            aria-hidden="true"
            className="flex items-center justify-center"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "9999px",
              background: "var(--t-brand-primary)",
              color: "var(--t-brand-primary-on)",
            }}
          >
            <CheckGlyph size={28} />
          </span>

          <h1
            data-testid="paid-title"
            style={{
              margin: 0,
              marginTop: "20px",
              fontSize: "var(--t-font-h1)",
              fontWeight: 700,
              color: "var(--t-text-primary)",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {payload.paidTitle}
          </h1>

          <span
            data-testid="paid-amount"
            style={{
              marginTop: "8px",
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--t-text-primary)",
            }}
          >
            {payload.amount}
          </span>

          <p
            style={{
              margin: 0,
              marginTop: "8px",
              maxWidth: "288px",
              fontSize: "var(--t-font-body)",
              fontWeight: 400,
              color: "var(--t-text-primary)",
              textAlign: "center",
              lineHeight: 1.35,
            }}
          >
            {COPY["paid.body"]}
          </p>

          <p
            data-testid="paid-demo-note"
            style={{
              margin: 0,
              marginTop: "16px",
              fontSize: "var(--t-font-caption)",
              color: "var(--t-text-secondary)",
              textAlign: "center",
            }}
          >
            {COPY["paid.demo_note"]}
          </p>
        </div>

        <div style={{ marginTop: "32px" }}>{summary}</div>

        {!sticky && (
          <div
            style={{
              marginTop: "24px",
              paddingInline: "var(--t-page-padding)",
            }}
          >
            {cta}
          </div>
        )}
      </div>

      {sticky && <StickyCtaPanel>{cta}</StickyCtaPanel>}
    </div>
  );
}
