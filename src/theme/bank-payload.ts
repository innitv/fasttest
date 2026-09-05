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
  /** Строка сводки на `O-4`. */
  summaryDetail: string;
  /** Остаток на счёте пользователя. Один для всех тенантов. */
  balance: string;
  /**
   * Правовая сноска под кнопкой: на что человек соглашается нажатием и где
   * согласие отозвать. `null` — платёж разовый, сноски нет.
   */
  consentNote: string | null;
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
    "returnLabel" | "paidTitle" | "paymentPurpose" | "summaryDetail"
  >
> = {
  cart_checkout: {
    returnLabel: "Вернуться в магазин",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    summaryDetail: "Заказ № 1042",
  },
  subscription_payment: {
    returnLabel: "Вернуться в приложение",
    paidTitle: "Подписка оплачена",
    paymentPurpose: "Оплата подписки",
    summaryDetail: "Подписка на год",
  },
  plan_sheet: {
    returnLabel: "Вернуться в приложение",
    paidTitle: "Абонемент оплачен",
    paymentPurpose: "Оплата абонемента",
    summaryDetail: "Абонемент",
  },
  store_checkout: {
    returnLabel: "Вернуться в магазин",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    summaryDetail: "Заказ № 4821",
  },
  order_steps: {
    returnLabel: "Вернуться в магазин",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    summaryDetail: "Заказ № 10482",
  },
  slot_delivery: {
    returnLabel: "Вернуться в магазин",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    summaryDetail: "Доставка воды",
  },
  bonus_checkout: {
    returnLabel: "Вернуться в магазин",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    summaryDetail: "Заказ № 3536",
  },
  ticket_checkout: {
    returnLabel: "Вернуться к событию",
    paidTitle: "Билет оплачен",
    paymentPurpose: "Оплата билета",
    summaryDetail: "Билет на событие",
  },
  carrier_delivery: {
    returnLabel: "Вернуться к заказу",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    summaryDetail: "Пункт выдачи, 4 позиции",
  },
  pickup_checkout: {
    returnLabel: "Вернуться к заказу",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Оплата заказа",
    summaryDetail: "Самовывоз, 4 позиции",
  },
  order_prepay: {
    // Заказ у этого архетипа уже создан, и платёж — предоплата по нему:
    // «Вернуться в магазин» врало бы дважды — магазина нет, и возвращаются
    // к конкретному заказу.
    returnLabel: "Вернуться к заказу",
    paidTitle: "Заказ оплачен",
    paymentPurpose: "Предоплата заказа",
    summaryDetail: "Предоплата по заказу",
  },
  /*
   * Условия будущих списаний экраны банка НЕ показывают (решение владельца
   * 2026-09-04): банк проводит платёж и называет его назначение, а то, КАК
   * дальше списывается подписка, объясняет форма подрядчика — там же, где
   * пользователь на это соглашается.
   */
  subscription_bind: {
    // Возврат — в тот же чекаут, из которого пользователь ушёл: подписка
    // подключается ВНУТРИ сценария подрядчика, а не в отдельном приложении.
    returnLabel: "Вернуться к подписке",
    paidTitle: "Подписка подключена",
    // «Оплата подписки» здесь врала бы: платёж один, а согласие даётся на
    // все будущие списания — назначение именно подключение.
    paymentPurpose: "Подключение подписки",
    summaryDetail: "Первое списание по подписке",
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
      summaryDetail: pick(tenant.content.summary_detail, defaults.summaryDetail),
      balance: tenant.demo.balance,
      consentNote: tenant.content.bank_consent_note,
    },
    diagnostics,
  };
}
