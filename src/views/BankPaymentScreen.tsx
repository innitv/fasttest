import { BankWordmark } from "@demo/components/bank/BankWordmark";
import {
  AvatarBadge,
  BankPrimaryButton,
  CloseCircleButton,
  IllustrationSlot,
  StaticChip,
} from "@demo/components/bank/bank-primitives";
import { BANK_COPY, COPY } from "@demo/content/copy";
import type { BankPayload } from "@demo/theme/bank-payload";

interface Props {
  payload: BankPayload;
  loading: boolean;
  onPay: () => void;
  onClose: () => void;
}

/**
 * `O-2` — оплата в приложении банка.
 *
 * Показывает ДАННЫЕ тенанта (мерчант, сумма) и не читает ни одного его
 * ТОКЕНА. Так работает реальный банк: он знает, кому вы платите, но рисует
 * это своим шрифтом на своём синем.
 *
 * Лист устроен как «верхний блок HUG → гибкий разделитель FILL → нижний
 * блок HUG». Именно разделитель делает положение кнопки инвариантным:
 * перенос имени мерчанта на вторую строку съедает разделитель, а не
 * двигает карточку счёта и кнопку. Это приёмочный тест, а не пожелание.
 *
 * Пустота в середине — композиционный приём донора, а не незаполненный
 * макет: он прижимает сумму к верху, средства и действие — к низу.
 */
export function BankPaymentScreen({
  payload,
  loading,
  onPay,
  onClose,
}: Props) {
  return (
    <div
      data-testid="bank-payment"
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: "var(--bank-surface)", fontFamily: "var(--bank-font)" }}
    >
      <span aria-live="assertive" className="sr-only">
        {BANK_COPY.livePayment(payload.amount, payload.merchant)}
      </span>

      {/* ── Зона 2: синяя зона с радиальным свечением ──────────────── */}
      <div
        data-testid="bank-hero"
        className="absolute inset-x-0 top-0"
        style={{
          height: "var(--bank-hero-h)",
          background:
            "radial-gradient(circle 180px at 50% 175px, rgba(255,255,255,0.12), rgba(255,255,255,0) 70%), var(--bank-primary)",
        }}
      >
        <div className="relative h-full">
          {/* ── Верхняя полоса банка: вордмарк по центру, закрытие справа.
              Раньше это был центральный слот статус-бара iOS; статус-бара
              больше нет, вордмарк остаётся как маркер айдентики банка.
              Высота полосы = --bank-header-h (нативная iOS, web-adjusted):
              вордмарк и крестик центрируются по вертикали, а не липнут к
              верхней кромке. Вордмарк белый (--bank-on-primary) — он на синем
              hero, как на доноре и на O-3. ─────────────────────────────── */}
          <div
            className="absolute inset-x-0 top-0 flex items-center justify-center"
            style={{
              height: "var(--bank-header-h)",
              paddingInline: "var(--bank-page-padding)",
            }}
          >
            <BankWordmark variant="micro" color="var(--bank-on-primary)" />

            {/* ── Зона 3: крестик, ⌀33, зона нажатия 44. Привязан к
                правому краю колонки — раскладка fluid. Центрируется по
                вертикали полосы. ─────────────────────────────────────── */}
            <div
              className="absolute"
              style={{
                top: "50%",
                transform: "translateY(-50%)",
                width: "var(--k-tap-min)",
                height: "var(--k-tap-min)",
                // Видимый круг ⌀33 отступает 16 от правого края; зона нажатия
                // 44 центрируется вокруг него и заходит внутрь поля.
                right:
                  "calc(var(--bank-page-padding) - (var(--k-tap-min) - var(--bank-close-d)) / 2)",
              }}
            >
              <CloseCircleButton
                label={COPY["a11y.close_no_payment"]}
                onClick={onClose}
                testId="bank-close-payment"
              />
            </div>
          </div>

          {/* ── Зона 4: слот иллюстрации, низ вплотную к листу ────── */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: "2px" }}
          >
            <IllustrationSlot />
          </div>
        </div>
      </div>

      {/* ── Зона 5: лист. HUG → FILL → HUG ─────────────────────────── */}
      <div
        data-testid="bank-sheet"
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{
          top: "var(--bank-hero-h)",
          background: "var(--bank-surface)",
          borderTopLeftRadius: "var(--bank-radius-sheet-top)",
          borderTopRightRadius: "var(--bank-radius-sheet-top)",
          paddingInline: "var(--bank-page-padding)",
        }}
      >
        {/* ── Зона 6: мерчант, назначение, сумма. HUG ─────────────── */}
        <div
          data-testid="merchant-block"
          className="flex shrink-0"
          style={{ paddingTop: "18px", gap: "12px" }}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <h1
              data-testid="bank-merchant"
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                lineHeight: "28px",
                color: "var(--bank-text-primary)",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }}
            >
              {payload.merchant}
            </h1>

            <span style={{ marginTop: "8px" }}>
              {/* Чип статичен: у донора это кнопка с шевроном, в демо она
                  ничего не открывает. Строка несёт ЗНАЧЕНИЕ назначения,
                  а не имя поля — иначе читается как пустое поле ввода. */}
              <StaticChip testId="bank-purpose-chip">
                {payload.paymentPurpose}
              </StaticChip>
            </span>

            <span
              data-testid="bank-amount"
              style={{
                marginTop: "22px",
                fontSize: "27px",
                fontWeight: 700,
                lineHeight: 1.15,
                color: "var(--bank-text-primary)",
              }}
            >
              {payload.amount}
            </span>

            {/* Демо-пометка занимает позицию донорской строки «Без
                комиссии»: тот же отступ, кегль и цвет. Сумму и
                предупреждение нельзя разделить кадрированием. */}
            <span
              data-testid="bank-demo-note-payment"
              style={{
                marginTop: "10px",
                fontSize: "13px",
                fontWeight: 400,
                color: "var(--bank-text-secondary)",
              }}
            >
              {COPY["bank.demo_note"]}
            </span>
          </div>

          <AvatarBadge
            size="var(--bank-avatar-payment)"
            radius="var(--bank-radius-avatar-small)"
            style={{ marginTop: "12px" }}
          />
        </div>

        {/* ── Зона 7: гибкий разделитель. Инвариант кнопки ────────── */}
        <div data-testid="flexible-spacer" style={{ flex: "1 1 0", minHeight: "24px" }} />

        {/* ── Зона 8: карточка счёта. Не интерактивна: счёт один ──── */}
        <div
          data-testid="account-card"
          className="flex shrink-0 items-center"
          style={{
            height: "var(--bank-account-card-h)",
            borderRadius: "var(--bank-radius-account-card)",
            background: "var(--bank-surface-muted)",
            paddingLeft: "15px",
            gap: "17px",
          }}
        >
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center"
            style={{
              width: "var(--bank-account-icon-d)",
              height: "var(--bank-account-icon-d)",
              borderRadius: "9999px",
              background: "var(--bank-surface)",
              color: "var(--bank-primary)",
              fontSize: "15px",
              fontWeight: 700,
            }}
          >
            ₽
          </span>
          <span className="flex min-w-0 flex-col">
            <span
              style={{
                fontSize: "14px",
                fontWeight: 400,
                color: "var(--bank-text-secondary)",
              }}
            >
              {COPY["bank.account_label"]}
            </span>
            <span
              data-testid="bank-balance"
              style={{
                fontSize: "17px",
                fontWeight: 700,
                color: "var(--bank-text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {payload.balance}
            </span>
          </span>
        </div>

        {/* ── Зона 9: кнопка и rail-строка. HUG ───────────────────── */}
        <div className="shrink-0" style={{ marginTop: "16.7px" }}>
          <BankPrimaryButton
            label={BANK_COPY.cta(payload.amount)}
            loadingLabel={COPY["bank.cta_loading"]}
            loading={loading}
            onClick={onPay}
            testId="bank-pay-cta"
          />

          {/* Строка про СБП заменена: чужой товарный знак + решение №2.
              Левый вордмарк-начертание убран (правка O-2): осталась одна
              подпись «Оплата через Ozon Банк», отцентрированная по колонке. */}
          <div className="flex items-center justify-center" style={{ marginTop: "18px" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 400,
                color: "var(--bank-text-secondary)",
              }}
            >
              {COPY["bank.rail"]}
            </span>
          </div>
        </div>

        <div
          className="shrink-0"
          style={{ height: "calc(25px + env(safe-area-inset-bottom, 0px))" }}
        />
      </div>
    </div>
  );
}
