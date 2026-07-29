import type { PhoneGateError } from "@demo/components/PhoneGateBlock";
import type { ButtonState } from "@demo/components/PrimaryButton";
import type { TenantConfig } from "@demo/theme/tenant.schema";

/**
 * Принудительные состояния для съёмки и ревью.
 * Задаются параметром `?state=`; в обычном сценарии равны `null`.
 */
export type ForcedState =
  | "ozon_selected"
  | "cta_sent"
  | "cta_disabled"
  | "field_error"
  | "promo_open"
  | "phone_expanded"
  | "phone_checking"
  | "phone_error"
  | null;

export const FORCED_STATES: readonly Exclude<ForcedState, null>[] = [
  "ozon_selected",
  "cta_sent",
  "cta_disabled",
  "field_error",
  "promo_open",
  "phone_expanded",
  "phone_checking",
  "phone_error",
];

/**
 * Проброс блока проверки телефона в экран подрядчика. Состояние живёт в
 * `ScreenHost`; экран только размещает блок в своей точке вставки.
 */
export interface PhoneGateSlot {
  expanded: boolean;
  digits: string;
  error: PhoneGateError;
  checking: boolean;
  onChange: (digits: string) => void;
  onSubmit: () => void;
  focusSignal: number;
}

export interface ScreenProps {
  tenant: TenantConfig;
  selectedMethod: string | null;
  onSelectMethod: (id: string) => void;
  ctaState: ButtonState;
  /** Метка кнопки в состоянии loading (проверка номера). */
  ctaLoadingLabel: string;
  /** Метка терминального состояния `sent` («Отправили push»). */
  ctaSentLabel: string;
  onCta: () => void;
  forcedState: ForcedState;
  /** Блок проверки телефона; `null`, если `phone_gate` выключен. */
  phoneGate: PhoneGateSlot | null;
  /**
   * Сообщает наверх сумму выбранной позиции — архетип `plan_sheet`, где на
   * одном экране несколько тарифов с разной ценой. Без этого экраны банка
   * показали бы сумму из `totals`, а шторка — цену выбранного тарифа, и
   * демо противоречило бы себе на соседних экранах.
   */
  onSelectAmount?: (sumKopecks: number) => void;
}
