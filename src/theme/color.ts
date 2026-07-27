/**
 * Цветовая математика темы.
 *
 * Реализует `design-brief.md` → Readability Guarantees:
 *   1. автоподбор on-color (белый → text_primary → сдвиг светлоты в OKLCH);
 *   3. тональная шкала из одного `brand.primary`.
 *
 * Все правила детерминированы и проверяются вычислением, а не глазом.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

export function hexToRgb(hex: string): Rgb {
  if (!isHexColor(hex)) {
    throw new Error(`Некорректный hex-цвет: ${hex}`);
  }
  let body = hex.slice(1);
  if (body.length === 3) {
    body = body
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return {
    r: parseInt(body.slice(0, 2), 16) / 255,
    g: parseInt(body.slice(2, 4), 16) / 255,
    b: parseInt(body.slice(4, 6), 16) / 255,
  };
}

function channelToHex(value: number): string {
  const byte = Math.round(clamp01(value) * 255);
  return byte.toString(16).padStart(2, "0");
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`.toUpperCase();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** Контраст двух цветов по WCAG 2.1, округление до сотых. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/** Полюса содержимого: единственные два «чернила», между которыми выбирают. */
export const LIGHT_INK = "#FFFFFF";
export const DARK_INK = "#111111";

/**
 * Тёмная ли поверхность.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  РЕЖИМ ТЕМЫ НЕ ОБЪЯВЛЯЕТСЯ — ОН ИЗМЕРЯЕТСЯ
 *
 *  В `tenant.json` нет и не будет поля «тема»: подрядчик присылает цвета,
 *  а не режим. Тёмность выводится из самого цвета поверхности, поэтому
 *  тёмный донор не требует ни нового поля, ни ветки «если тёмная тема».
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Критерий — какое из двух чернил читается лучше, а не порог светимости:
 * на средне-сером (#808080) белый даёт 3.95:1, чёрный 5.32:1, то есть
 * поверхность ещё светлая, хотя её светимость (0.216) уже ниже 0.5.
 */
export function isDarkColor(hex: string): boolean {
  return contrastRatio(hex, LIGHT_INK) > contrastRatio(hex, DARK_INK);
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { l: L, c, h };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hRad = (h * Math.PI) / 180;
  const A = c * Math.cos(hRad);
  const B = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.291485548 * B;

  const lc = l_ * l_ * l_;
  const mc = m_ * m_ * m_;
  const sc = s_ * s_ * s_;

  return {
    r: clamp01(
      linearToSrgb(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc),
    ),
    g: clamp01(
      linearToSrgb(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc),
    ),
    b: clamp01(
      linearToSrgb(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc),
    ),
  };
}

export function hexToOklch(hex: string): Oklch {
  return rgbToOklch(hexToRgb(hex));
}

export function oklchToHex(value: Oklch): string {
  return rgbToHex(oklchToRgb(value));
}

/** Сдвиг светлоты с сохранением тона; цветность гасится к краям шкалы. */
export function withLightness(hex: string, lightness: number): string {
  const base = hexToOklch(hex);
  const l = Math.min(0.99, Math.max(0.01, lightness));
  const damped = base.c * (1 - Math.abs(l - base.l) * 0.6);
  const c = l >= 0.9 ? Math.min(damped, 0.16) : Math.max(0, damped);
  return oklchToHex({ l, c, h: base.h });
}

/** Стопы тональной шкалы `brand.10 … brand.100` (Readability Guarantees §3). */
export const TONAL_STOPS = [
  0.97, 0.94, 0.88, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.22,
] as const;

export type TonalScale = Record<string, string>;

export function buildTonalScale(primary: string): TonalScale {
  const scale: TonalScale = {};
  TONAL_STOPS.forEach((stop, index) => {
    scale[`brand.${(index + 1) * 10}`] = withLightness(primary, stop);
  });
  return scale;
}

/**
 * Стоп тональной шкалы, отсчитанный от того конца, где стоит поверхность.
 *
 * Мягкая подложка бренда — это бренд, подтянутый к светлоте поверхности:
 * на светлой теме второй стоп сверху (`brand.20` = 0.94), на тёмной —
 * второй стоп снизу (`brand.90` = 0.30). Одно и то же расстояние от края
 * шкалы, только край выбирает поверхность, а не автор кода.
 *
 * `position` — номер стопа от края (1 = ближайший к поверхности).
 */
export function surfaceTonalStop(position: number, surfaceIsDark: boolean): number {
  const index = surfaceIsDark ? TONAL_STOPS.length - 1 - position : position;
  const clamped = Math.min(TONAL_STOPS.length - 1, Math.max(0, index));
  return TONAL_STOPS[clamped];
}

export interface OnColorResult {
  /** Итоговая заливка: исходная либо сдвинутая по светлоте. */
  fill: string;
  /** Цвет содержимого поверх заливки. */
  on: string;
  /** Достигнутый контраст. */
  contrast: number;
  /** Сколько шагов коррекции светлоты применено (0 — заливка не тронута). */
  steps: number;
  /** Правило не смогло достичь порога. */
  failed: boolean;
}

/** Пара чернил, из которой выбирается цвет содержимого. */
export interface InkPair {
  /** Светлое чернило. Практически всегда белый. */
  light: string;
  /** Тёмное чернило: `text_primary`, если он тёмный, иначе тёмная поверхность. */
  dark: string;
}

/**
 * Пара чернил темы.
 *
 * Раньше кандидатами были «белый → `text_primary`». На тёмной теме
 * `text_primary` сам белый, кандидат остаётся ОДИН, и любой светлый акцент
 * получает невидимый белый символ — при этом правило рапортует об успехе.
 * Поэтому тёмное чернило берётся из темы, а если тёмного в ней нет —
 * из полюса `DARK_INK`: выбор всегда идёт между двумя концами, а не между
 * тем, что случайно оказалось в конфиге.
 */
export function inkPair(textPrimary: string, ...darkFallbacks: string[]): InkPair {
  const dark =
    [textPrimary, ...darkFallbacks].find((candidate) => isDarkColor(candidate)) ??
    DARK_INK;
  const light = isDarkColor(textPrimary) ? LIGHT_INK : textPrimary;
  return { light, dark };
}

/**
 * Автоподбор on-color (Readability Guarantees §1).
 *
 * Порядок средств: светлое чернило → тёмное чернило → сдвиг светлоты
 * заливки в OKLCH шагами 0.04 (максимум 6). Заливка сдвигается ТОЛЬКО у
 * CTA; исходный `brand.primary` сохраняется для акцентов и обводок.
 *
 * `failed: true` означает, что порог не взят ни одним средством. Вызывающий
 * обязан сообщить об этом как о непройденной проверке: сообщение «символ
 * перекрашен» при `failed` — это диагностика, которая врёт.
 */
export function pickOnColor(
  fill: string,
  inks: InkPair,
  threshold = 4.5,
): OnColorResult {
  const evaluate = (candidateFill: string) => {
    const withLight = contrastRatio(candidateFill, inks.light);
    if (withLight >= threshold) {
      return { on: inks.light, contrast: withLight };
    }
    const withDark = contrastRatio(candidateFill, inks.dark);
    if (withDark >= threshold) {
      return { on: inks.dark, contrast: withDark };
    }
    return null;
  };

  /** Лучшее из двух чернил на заданной заливке — без учёта порога. */
  const bestInk = (candidateFill: string) => {
    const light = contrastRatio(candidateFill, inks.light);
    const dark = contrastRatio(candidateFill, inks.dark);
    return light >= dark
      ? { on: inks.light, contrast: light }
      : { on: inks.dark, contrast: dark };
  };

  const direct = evaluate(fill);
  if (direct) {
    return { fill, on: direct.on, contrast: direct.contrast, steps: 0, failed: false };
  }

  // Ни светлое, ни тёмное чернило не проходят — двигаем светлоту заливки в
  // ту сторону, которая быстрее набирает контраст с лучшим из двух.
  const base = hexToOklch(fill);
  const towardsDark =
    contrastRatio(fill, inks.light) >= contrastRatio(fill, inks.dark);
  const direction = towardsDark ? -1 : 1;

  const initial = bestInk(fill);
  let best: OnColorResult = {
    fill,
    on: initial.on,
    contrast: initial.contrast,
    steps: 0,
    failed: true,
  };

  for (let step = 1; step <= 6; step += 1) {
    const shifted = withLightness(fill, base.l + direction * 0.04 * step);
    const result = evaluate(shifted);
    if (result) {
      return {
        fill: shifted,
        on: result.on,
        contrast: result.contrast,
        steps: step,
        failed: false,
      };
    }
    const reached = bestInk(shifted);
    if (reached.contrast > best.contrast) {
      best = {
        fill: shifted,
        on: reached.on,
        contrast: reached.contrast,
        steps: step,
        failed: true,
      };
    }
  }

  return best;
}

/**
 * Затемняет (или осветляет) цвет ТЕКСТА до порога контраста на заданном фоне.
 * Применяется к зачёркнутым ценам и строке скидки: у донора они окрашены
 * бренд-цветом, который на фоне страницы даёт 2.75:1 (расхождение D5).
 */
export function ensureReadableOn(
  color: string,
  background: string,
  threshold = 4.5,
  maxSteps = 12,
): { color: string; contrast: number; corrected: boolean; failed: boolean } {
  const initial = contrastRatio(color, background);
  if (initial >= threshold) {
    return { color, contrast: initial, corrected: false, failed: false };
  }

  const base = hexToOklch(color);
  // Направление коррекции задаёт фон: на светлом цвет затемняется, на тёмном
  // осветляется. Тёмность считает `isDarkColor` — один критерий на весь файл,
  // тот же, что выбирает полюс тональной шкалы и пару чернил.
  const direction = isDarkColor(background) ? 1 : -1;

  let best = { color, contrast: initial, corrected: false, failed: true };

  for (let step = 1; step <= maxSteps; step += 1) {
    const shifted = withLightness(color, base.l + direction * 0.04 * step);
    const ratio = contrastRatio(shifted, background);
    if (ratio >= threshold) {
      return { color: shifted, contrast: ratio, corrected: true, failed: false };
    }
    if (ratio > best.contrast) {
      best = { color: shifted, contrast: ratio, corrected: true, failed: true };
    }
  }

  return best;
}
