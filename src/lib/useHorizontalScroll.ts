import { useEffect, useState, type RefObject } from "react";

/** Устройство с настоящей мышью/трекпадом: только там нужен drag и колесо. */
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * Горизонтальная прокрутка ряда карточек мышью и колесом.
 *
 * Зачем. Ряды архетипа A (`ChoiceCardRow`, `PaymentMethodList` в раскладке
 * `horizontal_cards`) обрезают третью карточку правым краем — peek обязан
 * сохраниться как признак донора. На тач-устройствах и трекпаде ряд
 * прокручивается нативно через `overflow-x: auto`. Но на десктопе с обычной
 * мышью прокрутки нет: колесо крутит страницу вертикально, а полоса скролла
 * скрыта (`.no-scrollbar`). Ряд визуально намекает на продолжение, но
 * недостижим — ровно жалоба с живого демо.
 *
 * Что делает хук, не ломая уже работающее:
 *  - Колесо мыши: вертикальный `deltaY` переводится в горизонтальную
 *    прокрутку ряда. Трекпад, дающий собственный `deltaX`, не трогаем.
 *  - Drag мышью: ряд можно тянуть. Клик по карточке подавляется ТОЛЬКО если
 *    действительно был drag, иначе выбор карточки перестал бы работать.
 *
 * На тач-устройстве хук НЕ НАВЕШИВАЕТ НИ ОДНОГО обработчика (жалоба с живого
 * iPhone: жест на карточке глушил прокрутку). Проверки `pointerType` было
 * мало: непассивные слушатели `wheel`/`pointermove` на прокручиваемом
 * элементе сами по себе переводят WebKit на медленный путь обработки жеста,
 * а `setPointerCapture` на нём же способен отнять жест у нативной прокрутки.
 * Поэтому граница проведена на входе: нет точного указателя — нет хука,
 * прокрутка полностью нативная. Проверка `pointerType === "mouse"` внутри
 * оставлена как вторая линия для гибридных устройств (тач + мышь).
 */
export function useHorizontalScroll(ref: RefObject<HTMLElement | null>): void {
  // Подписка на смену класса указателя: гибридный ноутбук может переключиться
  // между тачем и мышью без перезагрузки страницы.
  const [finePointer, setFinePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia(FINE_POINTER).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(FINE_POINTER);
    const sync = () => setFinePointer(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer) return;

    const canScroll = () => el.scrollWidth > el.clientWidth + 1;

    // ── Колесо: вертикальное намерение → горизонтальная прокрутка ──────
    // ВАЖНО (диагноз бага «вертикальный скролл пропадает»): раньше хук звал
    // `preventDefault()` на КАЖДОМ вертикальном колесе, пока ряд в принципе
    // переполнен (`scrollWidth > clientWidth`). Ряд с peek переполнен всегда,
    // поэтому, наведя курсор/трекпад на ряд, пользователь больше НЕ мог
    // вертикально листать страницу — колесо бесконечно уходило в ряд, даже
    // когда тот уже упёрся в свой край. Это ловушка вертикального скролла на
    // горизонтальных рядах архетипа A.
    //
    // Починка: переводим колесо в горизонталь, только пока ряд может ехать в
    // сторону жеста. На краю ряда (или если ряд не переполнен) НЕ гасим
    // событие — оно всплывает и страница листается вертикально как обычно.
    const onWheel = (event: WheelEvent) => {
      if (!canScroll()) return;
      // Трекпад с горизонтальной осью уже прокручивает ряд сам.
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      const delta = event.deltaY;
      const maxLeft = el.scrollWidth - el.clientWidth;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= maxLeft - 1;
      // На краю ряда в направлении жеста отдаём колесо странице: иначе ряд
      // «съедал» бы вертикальный скролл после первого же упора.
      if ((delta > 0 && atEnd) || (delta < 0 && atStart)) return;

      el.scrollLeft += delta;
      event.preventDefault();
    };

    // ── Drag мышью ────────────────────────────────────────────────────
    const DRAG_THRESHOLD = 6;
    let down = false;
    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let moved = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      down = true;
      dragging = false;
      moved = 0;
      startX = event.clientX;
      startLeft = el.scrollLeft;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!down) return;
      const dx = event.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (!dragging && Math.abs(dx) > DRAG_THRESHOLD) {
        dragging = true;
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* захват необязателен: без него drag просто прервётся у края */
        }
      }
      if (dragging) {
        el.scrollLeft = startLeft - dx;
        event.preventDefault();
      }
    };

    const endDrag = (event: PointerEvent) => {
      if (dragging && el.hasPointerCapture?.(event.pointerId)) {
        try {
          el.releasePointerCapture(event.pointerId);
        } catch {
          /* уже отпущен */
        }
      }
      down = false;
      // `dragging`/`moved` сбрасывает подавитель клика ниже.
    };

    // Клик, следующий за drag, подавляется в фазе перехвата, чтобы не
    // выбрать карточку, по которой пользователь просто протащил ряд.
    const onClickCapture = (event: MouseEvent) => {
      if (dragging || moved > DRAG_THRESHOLD) {
        event.stopPropagation();
        event.preventDefault();
      }
      dragging = false;
      moved = 0;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [ref, finePointer]);
}
