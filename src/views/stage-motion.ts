import type { Transition, Variants } from "framer-motion";

import type { DemoStage } from "./demo-flow";

/**
 * Слой межэкранного motion — ОБЩИЙ механизм, не зависящий от темы.
 *
 * Анимация живёт в переходах между стадиями сквозного сценария и одинакова
 * для обоих архетипов (Flowwow и Uchi): тема только красит экраны, движение
 * задаётся здесь. Ни один токен `--t-*` / `--bank-*` сюда не попадает —
 * граница темы не нарушается.
 *
 * Модель движения — та же, что у системы: ПРУЖИНА с воспринимаемой
 * длительностью, а не кривая с длительностью. С iOS 17 дефолт системной
 * анимации — `smooth`-пружина, и её темп задаётся параметром `duration`,
 * который Apple определяет как «перцептивную длительность, приблизительно
 * равную времени затухания» (docs `Animation.spring(duration:bounce:)`,
 * WWDC23 «Explore SwiftUI animation»). У всех трёх системных пресетов
 * (`smooth`, `snappy`, `bouncy`) он равен 0.5 с.
 *
 * В Motion тот же смысл несёт `visualDuration` — время, за которое анимация
 * ВИЗУАЛЬНО достигает цели; остаточная упругость доигрывает после. Поэтому
 * шкала ниже записана в `visualDuration`, а не в `duration` пружины.
 *
 * История: до 2026-08-22 переходы были tween'ами 220–340 мс по iOS-кривой
 * `cubic-bezier(0.32, 0.72, 0, 1)`. Кривая верная, но длительность под неё
 * занижена: демо шло в 1.5–2 раза быстрее системы (0.30–0.34 против ~0.5),
 * и владелец увидел это глазом раньше, чем показал замер. Пружина пуш-баннера
 * (ζ≈0.65, затухание ~0.5 с) была единственным местом в нативном темпе — из-за
 * чего рассинхрон и читался.
 *
 * Паттерны сдержанные, iOS-нативные:
 *  - `sheet-up`   — вход в приложение банка (push → splash): модалка снизу вверх.
 *  - `sheet-down` — возврат в магазин (банк → подрядчик): модалка уезжает вниз.
 *  - `push-*`     — stack-навигация на отдельный экран Uchi (contractor ↔ ozon_rail).
 *  - `bank-internal` — согласованные короткие переходы внутри банка (splash → оплата → успех).
 *  - `none`       — стадии, где полноэкранного перехода быть не должно: вход/выход
 *                   пуша (двигается только баннер, экран под ним статичен) и рестарт.
 *
 * `prefers-reduced-motion` обрабатывается на уровне провайдера `MotionConfig
 * reducedMotion="user"` (см. `main.tsx`): при reduce transform-анимации
 * отключаются, остаётся мгновенная смена/лёгкий fade, экраны и длительность
 * splash сохраняются.
 */
export type TransitionType =
  | "none"
  | "push-forward"
  | "push-back"
  | "sheet-up"
  | "sheet-down"
  | "bank-internal";

const BANK_STAGES: readonly DemoStage[] = ["splash", "bank_payment", "bank_success"];
const isBank = (stage: DemoStage): boolean => BANK_STAGES.includes(stage);

/**
 * Тип перехода по паре «откуда → куда».
 *
 * Первый рендер (`prev === null`) и переход в/из стадии `push` намеренно
 * без полноэкранного движения: подложка пуша — тот же самый экран, поэтому
 * его «въезд» читался бы как мигание, а сам баннер анимируется отдельно.
 */
export function transitionFor(prev: DemoStage | null, next: DemoStage): TransitionType {
  if (prev === null || prev === next) return "none";
  // Вход в пуш: под баннером остаётся прежний экран, полноэкранного перехода нет.
  if (next === "push") return "none";
  // Тап по пушу открывает банк — модальный выезд снизу вверх.
  if (prev === "push" && next === "splash") return "sheet-up";
  // Дисмисс пуша (свайп вверх): баннер уже уехал сам, экран под ним статичен.
  if (prev === "push") return "none";
  // Stack-навигация архетипа B: отдельный экран оплаты Uchi.
  if (prev === "contractor" && next === "ozon_rail") return "push-forward";
  if (prev === "ozon_rail" && next === "contractor") return "push-back";
  // Согласованные переходы внутри банка.
  if (isBank(prev) && isBank(next)) return "bank-internal";
  // Возврат из банка в магазин (успех → подрядчик, отмена оплаты → подрядчик).
  if (isBank(prev) && !isBank(next)) return "sheet-down";
  // Рестарт демо (paid → contractor) и прочее — без полноэкранного движения.
  return "none";
}

/**
 * Спека выезда для шитов ВНУТРИ экрана подрядчика (шторка выбора оплаты).
 *
 * Живёт здесь, а не по месту, по той же причине, что и остальной motion:
 * движение — общий механизм, тема его не задаёт. Тот же темп, что у
 * `--k-motion-overlay` в `styles.css` (им же анимируется `HandoffOverlay`).
 * Донорские тайминги сюда НЕ переносятся: у каждого донора они свои, а
 * движение в демо одно.
 */
export const SHEET_OVERLAY_SPEC: Transition = {
  type: "spring",
  visualDuration: 0.42,
  bounce: 0,
};

/**
 * Затемнение под шитом. Единственный tween в шкале: у прозрачности нет
 * инерции, пружинить её незачем — она лишь сопровождает лист и гаснет с ним
 * синхронно. Раньше стояла по месту (0.18 в двух экранах и спека листа в двух
 * других) — один и тот же элемент гас четырьмя разными способами.
 */
export const SHEET_SCRIM_SPEC: Transition = { duration: 0.3, ease: "easeOut" };

/**
 * Пуш-баннер банка: въезд сверху и уход по свайпу/Escape.
 *
 * Значения выверены на живом iPhone (см. комментарий в `PushBanner.tsx`) и
 * перенесены сюда БЕЗ пересчёта: ζ≈0.65, затухание ~0.5 с — ровно системный
 * темп, к которому подтянута остальная шкала. Здесь они потому, что движение
 * задаётся общим слоем, а не компонентом.
 */
export const PUSH_BANNER_IN_SPEC: Transition = {
  y: { type: "spring", stiffness: 150, damping: 16, mass: 1 },
  opacity: { duration: 0.16, ease: "easeOut" },
};
export const PUSH_BANNER_OUT_SPEC: Transition = { duration: 0.2, ease: "easeIn" };
/** Та же длительность в мс — баннер размонтируется по её истечении. */
export const PUSH_BANNER_OUT_MS = 200;

/**
 * Длительность из CSS-шкалы `--k-motion-*` в миллисекундах.
 *
 * Нужна там, где CSS-переход надо дождаться в JS (`HandoffOverlay`). Читаем
 * фактическое значение вместо того, чтобы дублировать число в TS: дубль
 * разъезжается молча — CSS правят, таймер остаётся прежним, и оверлей
 * отчитывается «доехал» раньше, чем доехал.
 *
 * `prefers-reduced-motion` здесь не учитывается: правило в `styles.css`
 * обнуляет `transition-duration`, но не саму переменную. Место вызова решает
 * это само (проверкой `matchMedia`) — так же, как решает, ждать ли вообще.
 */
export function motionMs(name: "fast" | "medium" | "overlay"): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--k-motion-${name}`)
    .trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith("ms") || !raw.endsWith("s") ? value : value * 1000;
}

function spec(type: TransitionType): Transition {
  switch (type) {
    // Лист снизу — самый длинный ход шкалы, как модальная презентация системы.
    case "sheet-up":
    case "sheet-down":
      return { type: "spring", visualDuration: 0.44, bounce: 0 };
    // Stack-навигация: короче листа, но не мгновенно.
    case "push-forward":
    case "push-back":
      return { type: "spring", visualDuration: 0.4, bounce: 0 };
    // Внутри банка ход самый малый: экран меняется, рамка и подложка — нет.
    case "bank-internal":
      return { type: "spring", visualDuration: 0.3, bounce: 0 };
    default:
      // Мгновенно: уходящий экран снимается сразу, без дублей в DOM.
      return { duration: 0 };
  }
}

// Отъезд уходящего экрана при stack-переходе (iOS-параллакс, не полный уход).
const PARALLAX = "-24%";

/**
 * Варианты для motion.div одной стадии. `custom` = TransitionType.
 *
 * Транзишн вшит В варианты (`animate`/`exit`), а не передан пропом: у
 * `AnimatePresence` уходящий элемент резолвит `exit` по текущему `custom`, и
 * так его тайминг соответствует ТЕКУЩЕМУ переходу, а не тому, что был на
 * прошлом рендере уходящего экрана.
 */
export const stageVariants: Variants = {
  initial: (type: TransitionType) => {
    switch (type) {
      case "push-forward":
        return { x: "100%", y: 0, opacity: 1, zIndex: 2 };
      case "push-back":
        return { x: PARALLAX, y: 0, opacity: 1, zIndex: 1 };
      case "sheet-up":
        return { x: 0, y: "100%", opacity: 1, zIndex: 3 };
      case "sheet-down":
        // Магазин появляется под уезжающей модалкой без собственного движения.
        return { x: 0, y: 0, opacity: 1, zIndex: 1 };
      case "bank-internal":
        return { x: 0, y: 10, opacity: 0, zIndex: 2 };
      default:
        return { x: 0, y: 0, opacity: 1, zIndex: 1 };
    }
  },
  animate: (type: TransitionType) => ({
    x: 0,
    y: 0,
    opacity: 1,
    zIndex: enterZ(type),
    pointerEvents: "auto",
    transition: spec(type),
  }),
  exit: (type: TransitionType) => {
    switch (type) {
      // Stack-переход: уходящий экран снимается МГНОВЕННО (duration 0), а не
      // едет параллаксом. Причина — экраны подрядчика делят один testid главной
      // кнопки: при sync-наложении одновременный маунт двух экранов дал бы два
      // элемента в DOM, что ломает строгие локаторы. Фон колонки один и тот же
      // (`--t-surface-background`), поэтому визуально въезжает контент нового
      // экрана по общему фону — без параллакса, но и без залипания под reduce
      // (баг mode="wait" + reducedMotion). Въезд нового экрана (`animate`)
      // остаётся анимированным слайдом.
      case "push-forward":
      case "push-back":
        return { x: 0, y: 0, opacity: 1, zIndex: 1, pointerEvents: "none", transition: { duration: 0 } };
      case "sheet-up":
        // Подложка чуть отступает вглубь, оставаясь на месте.
        return { x: 0, y: 0, opacity: 1, scale: 0.98, zIndex: 1, pointerEvents: "none", transition: spec(type) };
      case "sheet-down":
        return { x: 0, y: "100%", opacity: 1, zIndex: 3, pointerEvents: "none", transition: spec(type) };
      case "bank-internal":
        return { x: 0, y: -6, opacity: 0, zIndex: 1, pointerEvents: "none", transition: spec(type) };
      default:
        return { x: 0, y: 0, opacity: 1, zIndex: 1, pointerEvents: "none", transition: spec(type) };
    }
  },
};

function enterZ(type: TransitionType): number {
  switch (type) {
    case "sheet-up":
      return 3;
    case "push-forward":
    case "bank-internal":
      return 2;
    default:
      return 1;
  }
}
