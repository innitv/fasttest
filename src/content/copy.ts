/**
 * Константные строки интерфейса.
 *
 * Источник — `copy-deck.md` → UI Strings, колонка «Тип» = `constant`.
 * Строки типа `tenant` живут в `tenant.json` и сюда не попадают.
 * Ни одна строка здесь не сочинена: каждая имеет ключ из copy-deck.
 */
export const COPY = {
  // ── Общее для обоих архетипов ──────────────────────────────────────
  "payment.method.ozon": "Ozon Банк",
  "payment.method.sbp": "СБП",
  "handoff.title": "Переход в Ozon Банк",
  "handoff.body": "Оплата продолжится на стороне Ozon Банк",
  "handoff.demo_note": "Демонстрация: платёж не выполняется",
  "handoff.back": "Вернуться",
  // Терминальный статус главной кнопки после успешной проверки номера.
  // Заменил прежний `cta.loading` «Открываем Ozon Банк…»: банк открывает тап
  // по push, а не кнопка (правка после живого демо). Один текст, не два —
  // отправка push и его появление совпадают.
  "cta.sent": "Отправили push",

  // ── Архетип A ──────────────────────────────────────────────────────
  "nav.back": "Назад",
  "payment.section_title": "Оплата",
  "totals.label": "Итого",
  "extras.label": "Пожелания к заказу",
  "extras.value": "Выбрать",

  // ── Архетип B ──────────────────────────────────────────────────────
  "form.card_number.label": "Номер карты",
  "form.card_number.placeholder": "0000 0000 0000 0000",
  "form.expiry.label": "Срок действия",
  "form.expiry.placeholder": "ММ/ГГ",
  "form.cvc.label": "CVC-код",
  "form.cvc.placeholder": "000",
  "form.cvc.toggle.show": "Показать код",
  "form.cvc.toggle.hide": "Скрыть код",
  "form.error.card_number": "Проверьте номер карты",
  "form.error.expiry": "Срок действия в формате ММ/ГГ",
  "form.error.cvc": "CVC-код — 3 цифры",
  "autorenew.label": "Продлевать автоматически",
  "promo.label": "У меня есть промокод",
  "promo.field.placeholder": "Введите промокод",
  "promo.apply": "Применить",
  "totals.sum.label": "Итого",
  "totals.discount.label": "Скидка",
  "totals.payable.label": "К оплате",
  // Ключ `help_fab.label` из copy-deck намеренно отсутствует: плавающая
  // кнопка помощи удалена из демо решением пользователя 2026-07-23.

  // ── Проверка клиентства по номеру телефона (Phone Check Copy) ───────
  // Источник: copy-deck.md → Phone Check Copy (ратифицированные строки).
  "phone.label": "Номер телефона",
  "phone.prefix": "+7",
  "phone.placeholder": "900 000-00-00",
  "phone.hint": "Придёт push, по нему откроется банк",
  "phone.error.empty": "Введите номер телефона",
  "phone.error.incomplete": "Введите все 10 цифр номера",
  "phone.error.not_client": "Не нашли этот номер в Ozon Банке",
  "cta.checking": "Проверяем номер…",

  // ── Доступность ────────────────────────────────────────────────────
  "a11y.payment_group": "Способ оплаты",
  "a11y.handoff_live": "Переход в Ozon Банк",
  "a11y.phone.field": "Номер телефона, код страны плюс семь",
  "a11y.phone.checking": "Проверяем номер",

  // ══ Флоу банка ═════════════════════════════════════════════════════
  // Источник: copy-deck.md → Bank Flow Copy (ратифицированные строки).
  // Семь строк из тридцати переписаны на 05-copy; здесь итоговые версии.

  // O-0 — пуш
  "push.app": "Ozon Банк",
  "push.demo_tag": "Демонстрация",

  // O-2 — оплата
  "bank.demo_note": "Демонстрация: платёж не выполняется",
  "bank.account_label": "Основной счёт",
  "bank.cta_loading": "Проводим платёж…",
  "bank.rail": "Оплата через Ozon Банк",

  // O-3 — успех
  "bank.rail_header": "Ozon Банк",
  "bank.success_title": "Успешно",
  "bank.paid_via": "Оплата через Ozon Банк",
  "bank.docs_tile": "Чек",

  // O-4 — подтверждение в теме подрядчика
  "paid.body": "Оплата прошла через Ozon Банк",
  "paid.demo_note": "Демонстрация: платёж не выполняется",
  "paid.cta": "Начать сначала",

  // Доступность флоу банка
  "a11y.bank_logo": "Ozon Банк",
  "a11y.close": "Закрыть",
  "a11y.close_no_payment": "Закрыть, вернуться без оплаты",
  "a11y.splash_live": "Ozon Банк, загрузка",
} as const;

export type CopyKey = keyof typeof COPY;

/** «{метка}, способ оплаты, выбрано / не выбрано» — ключи a11y.method_*. */
export function methodAccessibleName(label: string, selected: boolean): string {
  return `${label}, способ оплаты, ${selected ? "выбрано" : "не выбрано"}`;
}

const RUB_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Копейки → «2 580 ₽». Валюта одна, поэтому форматтер один. */
export function formatMoney(kopecks: number): string {
  return RUB_FORMATTER.format(Math.round(kopecks / 100)).replace(/\s/g, " ");
}

/**
 * Производные строки флоу банка.
 *
 * Ни одна не хранит собственной копии суммы: и число, и мерчант приходят
 * из payload, который собран из `tenant.json`. Расхождение между экранами
 * разваливает демо на глазах у наблюдателя.
 */
export const BANK_COPY = {
  /** Заголовок пуша несёт СУММУ: её нельзя усечь, она главный элемент связности. */
  pushTitle: (amount: string) => `Платёж ${amount}`,
  /** Тело пуша усекается по МЕРЧАНТУ — он повторяется ещё дважды. */
  pushBody: (merchant: string) => `Подтвердите оплату · ${merchant}`,
  cta: (amount: string) => `Оплатить ${amount}`,
  successAmount: (amount: string) => `− ${amount}`,

  // Объявления смены экрана, aria-live="assertive".
  livePush: (amount: string) =>
    `Уведомление Ozon Банк. Платёж ${amount}, подтвердите оплату`,
  livePayment: (amount: string, merchant: string) => `Оплата ${amount}, ${merchant}`,
  liveSuccess: (amount: string) => `Оплата прошла успешно, ${amount}`,
} as const;

/** Подстановка суммы в метку кнопки, если `cta.include_amount = true`. */
export function resolveCtaLabel(
  template: string,
  includeAmount: boolean,
  amountKopecks: number,
): string {
  if (!includeAmount) return template.replace("{amount}", "").trim();
  const amount = formatMoney(amountKopecks);
  return template.includes("{amount}")
    ? template.replace("{amount}", amount)
    : `${template} ${amount}`;
}
