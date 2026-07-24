/**
 * Нормализация и форматирование номера телефона (screens-phone-check.md).
 *
 * Правило одно: привести к 10 цифрам, а не отвергнуть. Отказ на вставке
 * в демо бессмысленен — единственное, что он даёт, это заминку на сцене.
 * Ни одна из функций не хранит и не передаёт номер: это чистые функции.
 */

/**
 * Извлекает цифры, отбрасывает ведущую «7»/«8» у длинной вставки, обрезает
 * до 10. Примеры: «8 999 123-45-67» → 9991234567; «+7 999…» → то же;
 * «+7 (999) 123-45-67 доб. 12» → первые 10 после отбрасывания ведущей 7.
 */
export function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && (digits[0] === "7" || digits[0] === "8")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Форматирует до 10 цифр по маске «900 000-00-00» (группировка 3-3-2-2). */
export function formatPhoneMask(digits: string): string {
  const d = digits.slice(0, 10);
  let out = d.slice(0, 3);
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}
