import { formatMoney } from "@demo/content/copy";
import type { Diagnostic } from "./build-theme";
import type { TenantConfig } from "./tenant.schema";

/**
 * Payload экранов банка.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  ДАННЫЕ ТЕНАНТА ≠ ТЕМА ТЕНАНТА
 *
 *  Экраны `O-1`…`O-3` показывают имя мерчанта и сумму — и не читают ни
 *  одного токена подрядчика. Так работает реальный банк: он знает, кому
 *  вы платите, но рисует это своим шрифтом на своём синем.
 *
 *  Практическое следствие: компоненты банка получают этот объект и
 *  НЕ получают theme. Здесь нет ни одного цвета, радиуса и отступа.
 * ═══════════════════════════════════════════════════════════════════════
 */
export interface BankPayload {
  /** Имя мерчанта — `display_name` тенанта. */
  merchant: string;
  /** Отформатированная сумма платежа, одна на все экраны маршрута. */
  amount: string;
  /** Сумма в копейках — источник истины, из которого получена строка. */
  amountKopecks: number;
  /** Метка кнопки возврата на `O-3`. */
  returnLabel: string;
  /** Заголовок подтверждения на `O-4`. */
  paidTitle: string;
  /** Значение чипа назначения платежа на `O-2`. */
  paymentPurpose: string;
  /** Значение чипа категории операции на `O-3`. */
  paymentCategory: string;
  /** Строка сводки на `O-4`. */
  summaryDetail: string;
  /** Остаток на счёте пользователя. Один для всех тенантов. */
  balance: string;
}

/**
 * Дефолты по архетипу. Подобраны так, чтобы новый подрядчик получал верную
 * строку, ничего не заполняя: «Вернуться в магазин» неверно для подписки
 * ровно так же, как «Заказ оплачен».
 */
const ARCHETYPE_DEFAULTS: Record<
  TenantConfig["archetype"],
  Pick<
    BankPayload,
    "returnLabel" | "paidTitle" | "paymentPurpose" | "paymentCategory" | "summaryDetail"
  >
> = {
  cart_checkout: {
    returnLabel: "Вернуться в магазин",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    paymentCategory: "Покупки",
    summaryDetail: "Заказ № 1042",
  },
  subscription_payment: {
    returnLabel: "Вернуться в приложение",
    paidTitle: "Подписка оплачена",
    paymentPurpose: "Оплата подписки",
    paymentCategory: "Подписки",
    summaryDetail: "Подписка на год",
  },
  store_checkout: {
    returnLabel: "Вернуться в магазин",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    paymentCategory: "Покупки",
    summaryDetail: "Заказ № 4821",
  },
  ticket_checkout: {
    returnLabel: "Вернуться к событию",
    paidTitle: "Билет оплачен",
    paymentPurpose: "Оплата билета",
    paymentCategory: "Развлечения",
    summaryDetail: "Билет на событие",
  },
};

function pick(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export interface BankPayloadResult {
  payload: BankPayload;
  diagnostics: Diagnostic[];
}

/**
 * Сборка payload из конфига тенанта.
 *
 * Отсутствие мерчанта или суммы — `E_BANK_PAYLOAD`, ошибка сборки.
 * Пустая строка на экране банка недопустима: наблюдатель увидит дыру там,
 * где должно стоять имя подрядчика.
 */
export function buildBankPayload(tenant: TenantConfig): BankPayloadResult {
  const diagnostics: Diagnostic[] = [];
  const defaults = ARCHETYPE_DEFAULTS[tenant.archetype];

  const merchant = tenant.display_name.trim();
  const amountKopecks = tenant.content.totals.sum - tenant.content.totals.discount;

  if (merchant.length === 0) {
    diagnostics.push({
      code: "E_BANK_PAYLOAD",
      severity: "error",
      message: "display_name пуст: экранам банка нечего показать в поле мерчанта",
      detail: "Пустая строка на экране банка недопустима — сборка падает, а не рендерит дыру.",
    });
  }

  if (amountKopecks <= 0) {
    diagnostics.push({
      code: "E_BANK_PAYLOAD",
      severity: "error",
      message: `Сумма к оплате равна ${amountKopecks} копеек — экраны банка показали бы нулевой платёж`,
      detail: "totals.sum − totals.discount должно быть положительным.",
    });
  }

  return {
    payload: {
      merchant,
      amount: formatMoney(Math.max(0, amountKopecks)),
      amountKopecks,
      returnLabel: pick(tenant.content.return_label, defaults.returnLabel),
      paidTitle: pick(tenant.content.paid_title, defaults.paidTitle),
      paymentPurpose: pick(tenant.content.payment_purpose, defaults.paymentPurpose),
      paymentCategory: pick(tenant.content.payment_category, defaults.paymentCategory),
      summaryDetail: pick(tenant.content.summary_detail, defaults.summaryDetail),
      balance: tenant.demo.balance,
    },
    diagnostics,
  };
}
