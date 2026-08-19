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
 * Паттерны сдержанные, iOS-нативные (тайминги ~220–340мс, iOS-кривая):
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

// iOS-кривая выезда шитов и stack-переходов.
export const IOS_EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Спека выезда для шитов ВНУТРИ экрана подрядчика (шторка выбора оплаты).
 *
 * Живёт здесь, а не по месту, по той же причине, что и остальной motion:
 * движение — общий механизм, тема его не задаёт. 320 мс — то же значение,
 * что у `--k-motion-overlay` в `styles.css` (им же анимируется
 * `HandoffOverlay`), кривая — общая iOS-кривая шитов. Донорские тайминги
 * сюда НЕ переносятся: у каждого донора они свои, а движение в демо одно.
 */
export const SHEET_OVERLAY_SPEC: Transition = { duration: 0.32, ease: IOS_EASE };

function spec(type: TransitionType): Transition {
  switch (type) {
    case "sheet-up":
      return { duration: 0.34, ease: IOS_EASE };
    case "sheet-down":
      return { duration: 0.3, ease: IOS_EASE };
    case "push-forward":
    case "push-back":
      return { duration: 0.3, ease: IOS_EASE };
    case "bank-internal":
      return { duration: 0.22, ease: "easeOut" };
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
