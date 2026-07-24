/**
 * Анонимная аналитика демо.
 *
 * Payload содержит только `method_id`, `archetype`, `tenant_id` —
 * ни персональных данных, ни введённых в форму значений.
 * Сигналы перечислены в `screens.md` → `analytics_test_hooks`.
 */

export type AnalyticsSignal =
  | "payment_method_selected"
  | "handoff_started"
  | "handoff_shown"
  | "handoff_returned"
  // Сигналы флоу банка. Payload тот же: без PII, без введённых значений.
  | "bank_payment_started"
  | "bank_payment_succeeded"
  | "bank_payment_cancelled"
  | "returned_to_contractor"
  | "demo_restarted"
  // Проверка клиентства. Payload несёт только result — ни одной цифры номера.
  | "phone_check_started"
  | "phone_check_result";

export interface AnalyticsPayload {
  method_id: string | null;
  archetype: string;
  tenant_id: string;
  /**
   * Только для `phone_check_result`. Никогда не содержит номер, его часть,
   * длину, хеш или производную — только исход проверки.
   */
  result?: "client" | "not_client";
}

export interface AnalyticsEvent extends AnalyticsPayload {
  signal: AnalyticsSignal;
  at: number;
}

declare global {
  interface Window {
    __demoAnalytics?: AnalyticsEvent[];
  }
}

export function track(signal: AnalyticsSignal, payload: AnalyticsPayload): void {
  const event: AnalyticsEvent = { signal, ...payload, at: Date.now() };
  if (typeof window !== "undefined") {
    window.__demoAnalytics = window.__demoAnalytics ?? [];
    window.__demoAnalytics.push(event);
  }
  if (import.meta.env.DEV) {
    console.debug("[analytics]", event);
  }
}
