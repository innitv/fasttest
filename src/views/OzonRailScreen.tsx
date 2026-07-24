import { PhoneGateBlock } from "@demo/components/PhoneGateBlock";
import { PrimaryButton } from "@demo/components/PrimaryButton";
import { NeutralPlate } from "@demo/components/primitives";
import { ScreenHeader } from "@demo/components/ScreenHeader";
import { COPY, resolveCtaLabel } from "@demo/content/copy";
import type { ButtonState } from "@demo/components/PrimaryButton";
import type { TenantConfig } from "@demo/theme/tenant.schema";
import type { PhoneGateSlot } from "./screen-props";

interface Props {
  tenant: TenantConfig;
  ctaState: ButtonState;
  ctaLoadingLabel: string;
  ctaSentLabel: string;
  onCta: () => void;
  onBack: () => void;
  /** Блок проверки телефона; здесь всегда раскрыт (это его собственный экран). */
  phoneGate: PhoneGateSlot | null;
}

/**
 * `S-B-ozon` — отдельный экран «Оплата через Ozon Банк» (только архетип B).
 *
 * Донорская модель Uchi: тап по способу оплаты ведёт на отдельный экран
 * этого способа, а не раскрывает поле инлайн. Это ещё экран ПОДРЯДЧИКА
 * (тема `--t-*`, тот же centered-logo хедер), смена айдентики наступает
 * только на пуше — поэтому ни одного токена `--bank-*` здесь нет.
 *
 * У донора на этом месте прогрузка тремя точками; у нас вместо неё — поле
 * ввода номера телефона (переиспользован `PhoneGateBlock`), проверка
 * клиентства и та же главная кнопка «Оплатить {сумма}». Кнопка запускает
 * проверку номера: «Проверяем номер…» → «Отправили push».
 */
export function OzonRailScreen({
  tenant,
  ctaState,
  ctaLoadingLabel,
  ctaSentLabel,
  onCta,
  onBack,
  phoneGate,
}: Props) {
  const { content } = tenant;

  const ctaLabel = resolveCtaLabel(
    tenant.cta.label,
    tenant.cta.include_amount,
    content.totals.sum - content.totals.discount,
  );

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
          paddingInline: "var(--t-page-padding)",
          paddingBottom: "var(--k-page-bottom-reserve)",
        }}
      >
        {/* ── Назад: возврат на экран подписки ──────────────────────── */}
        <button
          type="button"
          data-testid="ozon-rail-back"
          onClick={onBack}
          className="tap-press flex items-center"
          style={{
            minHeight: "var(--k-tap-min)",
            gap: "4px",
            background: "none",
            border: "none",
            padding: 0,
            marginTop: "12px",
            color: "var(--t-text-primary)",
            fontSize: "var(--t-font-body)",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1 }}>
            ‹
          </span>
          {COPY["nav.back"]}
        </button>

        {/* ── H1 «Оплата через Ozon Банк» + значок способа (заглушка) ── */}
        <div
          className="flex items-center"
          style={{ gap: "12px", marginTop: "8px", marginBottom: "20px" }}
        >
          <NeutralPlate
            width="40px"
            height="40px"
            style={{
              background: "var(--t-surface-card)",
              boxShadow: "inset 0 0 0 var(--t-border-width) var(--t-surface-border)",
              flexShrink: 0,
            }}
          />
          <h1
            data-testid="page-title"
            style={{
              margin: 0,
              fontSize: "var(--t-font-h1)",
              fontWeight: "var(--t-title-weight)" as unknown as number,
              textAlign: "left",
              color: "var(--t-text-primary)",
              lineHeight: 1.2,
            }}
          >
            {COPY["bank.rail"]}
          </h1>
        </div>

        {/* ── Поле проверки телефона: всегда раскрыто, без авто-скролла ── */}
        {phoneGate && <PhoneGateBlock {...phoneGate} autoReveal={false} />}

        {/* ── Главная кнопка: запускает проверку номера ─────────────── */}
        <div style={{ marginTop: "8px" }}>
          <PrimaryButton
            label={ctaLabel}
            loadingLabel={ctaLoadingLabel}
            sentLabel={ctaSentLabel}
            state={ctaState}
            onClick={onCta}
          />
        </div>
      </div>
    </div>
  );
}
