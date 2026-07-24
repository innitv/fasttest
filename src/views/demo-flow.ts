/**
 * Стадии сквозного сценария демо.
 *
 * Архетип A (cart_checkout):
 *   `contractor` → `push` → `splash` → `bank_payment` → `bank_success` → `paid`
 *
 * Архетип B (subscription_payment): между подрядчиком и пушем встаёт отдельный
 * экран оплаты выбранным способом (донорская модель Uchi — тап по способу
 * ведёт на свой экран, а не раскрывает поле инлайн):
 *   `contractor` → `ozon_rail` → `push` → `splash` → … → `paid`
 *
 * `ozon_rail` — ещё экран ПОДРЯДЧИКА (тема `--t-*`), не банк: смена айдентики
 * наступает только на пуше. Поле проверки телефона переезжает сюда с инлайна.
 *
 * Замкнутый круг: подрядчик показывает, что пользователь возвращается к нему
 * с оплаченным заказом, а не уходит в банк навсегда.
 */
export type DemoStage =
  | "contractor"
  | "ozon_rail"
  | "push"
  | "splash"
  | "bank_payment"
  | "bank_success"
  | "paid";

export const DEMO_STAGES: readonly DemoStage[] = [
  "contractor",
  "ozon_rail",
  "push",
  "splash",
  "bank_payment",
  "bank_success",
  "paid",
];

export function parseStage(value: string | null): DemoStage | null {
  return DEMO_STAGES.includes(value as DemoStage) ? (value as DemoStage) : null;
}

/**
 * Точки, в которых демо может остановиться, и способ продолжить.
 * Из `screens-ozon.md` → «Состояния, в которых демо может остановиться».
 */
export const TERMINAL_STATES = [
  {
    stage: "push" as DemoStage,
    state: "Баннер висит поверх экрана подрядчика; автоскрытия нет",
    continueWith: "тап по баннеру или свайп вверх",
  },
  {
    stage: "contractor" as DemoStage,
    state: "Отмена по «×» на экране оплаты: заказ не оплачен",
    continueWith: "повторный тап по главной кнопке",
  },
  {
    stage: "paid" as DemoStage,
    state: "Подтверждение оплаты",
    continueWith: "«Начать сначала» — он же перезапуск демо",
  },
] as const;
