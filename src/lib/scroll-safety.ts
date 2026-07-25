/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Скролл-безопасность: доводка до видимости и фокус без побочного сдвига.
 *
 *  Зачем отдельный модуль. Два браузерных API молча двигают страницу, и оба
 *  использовались в демо напрямую:
 *
 *   1. `element.scrollIntoView()` прокручивает ВСЮ цепочку прокручиваемых
 *      предков, а не ближайший контейнер, и делает это БЕЗУСЛОВНО — даже
 *      когда элемент и так виден целиком. Отсюда «страница дёрнулась и
 *      вернулась» на ровном месте.
 *   2. `element.focus()` доставляет элемент в видимую область тем же
 *      механизмом. `preventScroll` это выключает, но опция реализована не
 *      везде одинаково, а фокус на элементе, который стартует ВЫШЕ кромки
 *      экрана (пуш-баннер, `y: -170%`), — ровно тот случай, где расхождение
 *      реализаций стоит дорого.
 *
 *  Правило модуля: движение скролла допустимо только там, где оно решает
 *  задачу пользователя (элемент реально вне видимой области), и только в
 *  ближайшем прокручиваемом контейнере. Всё остальное — сдвиг, который
 *  пользователь не просил.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Ближайший ПРОКРУЧИВАЕМЫЙ предок: у него разрешён скролл по вертикали и
 * есть куда прокручивать. Контейнер с `overflow: clip` (колонка `PhoneFrame`)
 * прокручиваемым боксом не является и сюда не попадает — это намеренно.
 */
export function scrollPortOf(el: Element | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight - node.clientHeight > 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Сколько пикселей нижней кромки контейнера перекрыто панелью поверх него.
 *
 * Читается из его собственного `padding-bottom`: по контракту раскладки
 * (`STICKY_PANEL_RESERVE` архетипа A, `--k-page-bottom-reserve` архетипа B)
 * этот резерв РАВЕН высоте перекрывающей панели. Отдельного измерения самой
 * панели не нужно, и модуль не знает ни про один `data-testid`.
 */
function overlaidBottomOf(port: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(port).paddingBottom);
  return Number.isFinite(value) ? value : 0;
}

/** Виден ли элемент целиком в контейнере, с учётом перекрытой нижней кромки. */
function fullyVisibleIn(el: Element, port: HTMLElement, bottomInset: number): boolean {
  const box = el.getBoundingClientRect();
  const view = port.getBoundingClientRect();
  return box.top >= view.top - 0.5 && box.bottom <= view.bottom - bottomInset + 0.5;
}

/**
 * Довести элемент до видимости в ЕГО контейнере — и только если он там
 * действительно не помещается целиком.
 *
 * Возвращает `true`, если скролл был сдвинут. Ни один предок выше найденного
 * контейнера не трогается: страница под колонкой остаётся на месте.
 */
export function revealInScrollPort(
  el: Element | null,
  options: { behavior?: ScrollBehavior } = {},
): boolean {
  if (!el) return false;
  const port = scrollPortOf(el);
  if (!port) return false;

  const bottomInset = overlaidBottomOf(port);
  if (fullyVisibleIn(el, port, bottomInset)) return false;

  const box = el.getBoundingClientRect();
  const view = port.getBoundingClientRect();
  // Видимая высота = высота контейнера минус перекрытая панелью кромка.
  const usable = view.height - bottomInset;
  // Центрируем в видимой части, но не выше её верха: блок выше видимой
  // области (поле + слот сообщения) должен упереться в верх, а не уехать.
  const offset = Math.max(0, (usable - box.height) / 2);
  const target = port.scrollTop + (box.top - view.top) - offset;
  const max = port.scrollHeight - port.clientHeight;

  port.scrollTo({ top: Math.min(Math.max(target, 0), max), behavior: options.behavior ?? "auto" });
  return true;
}

/** Все прокручиваемые предки элемента плюс сам документ. */
function scrollAncestorsOf(el: Element): Element[] {
  const found: Element[] = [];
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY, overflowX } = getComputedStyle(node);
    const scrollable = (value: string) =>
      value === "auto" || value === "scroll" || value === "overlay";
    if (scrollable(overflowY) || scrollable(overflowX)) found.push(node);
    node = node.parentElement;
  }
  const doc = document.scrollingElement;
  if (doc && !found.includes(doc)) found.push(doc);
  return found;
}

/**
 * Поставить фокус, не сдвинув ни один скролл.
 *
 * `preventScroll` — первая линия; снимок и восстановление позиций предков —
 * вторая, на случай движка, который опцию игнорирует. Восстановление идёт
 * дважды: синхронно (мгновенный сдвиг) и на следующем кадре (плавная
 * прокрутка, запущенная браузером, отменяется присвоением `scrollTop`).
 */
export function focusWithoutScroll(el: HTMLElement | null): void {
  if (!el) return;
  const snapshot = scrollAncestorsOf(el).map(
    (node) => [node, node.scrollTop, node.scrollLeft] as const,
  );
  const restore = () => {
    for (const [node, top, left] of snapshot) {
      if (node.scrollTop !== top) node.scrollTop = top;
      if (node.scrollLeft !== left) node.scrollLeft = left;
    }
  };

  el.focus({ preventScroll: true });
  restore();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
}
