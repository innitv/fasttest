import { useEffect } from "react";

/**
 * Цвет системных зон устройства (строка статуса iOS, панель Safari).
 *
 * Жалоба с живого iPhone: сверху и снизу интерфейс обрамляли серые полосы.
 * Причина — фон `body`. На телефоне колонка занимает всю ширину, серый фон
 * «стола» за колонкой не виден нигде, кроме системных зон, которые iOS красит
 * как раз фоном страницы (и значением `<meta name="theme-color">`).
 *
 * Модуль снимает фактический цвет ВЕРХНЕЙ КРОМКИ текущего экрана прямо из
 * отрисованного DOM и раздаёт его двум потребителям: переменной
 * `--page-canvas` (её читает `body` в `styles.css`) и мета-тегу `theme-color`.
 * Цвет именно измеряется, а не перечисляется таблицей «стадия → значение»:
 * список стадий и палитры живут в токенах, дублировать их здесь значило бы
 * завести второй источник правды, который разъедется с первым. Заодно это
 * не нарушает границу темы: модуль не знает ни про `--t-*`, ни про `--bank-*`.
 */

/** Цвет фона элемента, если он непрозрачный. Градиент — по первому стопу. */
function opaqueBackgroundOf(element: Element): string | null {
  const style = getComputedStyle(element);

  const color = style.backgroundColor;
  // Прозрачный фон пропускаем: цвет даёт кто-то ниже по цепочке предков.
  if (color && !/^rgba\(.*,\s*0\)$/.test(color) && color !== "transparent") {
    return color;
  }

  // Экран успеха залит вертикальным градиентом: верхняя кромка = первый стоп.
  const image = style.backgroundImage;
  if (image && image !== "none") {
    const stop = image.match(/rgba?\([^)]*\)/);
    if (stop) return stop[0];
  }

  return null;
}

/**
 * Цвет в точке верхней кромки колонки: берём самый верхний элемент под этой
 * точкой и поднимаемся по предкам до первой непрозрачной заливки. Поиск
 * ограничен колонкой — за её пределами лежит `body`, чей фон мы как раз и
 * вычисляем (иначе получили бы замкнутый цикл).
 */
function topEdgeColor(frame: HTMLElement): string | null {
  const rect = frame.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const x = rect.left + rect.width / 2;
  const y = rect.top + 2;

  let node = document.elementFromPoint(x, y);
  while (node instanceof HTMLElement && (frame.contains(node) || node === frame)) {
    const color = opaqueBackgroundOf(node);
    if (color) return color;
    node = node.parentElement;
  }

  return opaqueBackgroundOf(frame);
}

function apply(color: string): void {
  document.documentElement.style.setProperty("--page-canvas", color);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
}

/**
 * Держит фон страницы и `theme-color` в согласии с текущим экраном.
 *
 * `stage` — ключ пересчёта: смена экрана меняет цвет кромки. Замер идёт дважды
 * — сразу после кадра и после того, как межэкранный переход отыграл: во время
 * выезда шита верхняя кромка ещё принадлежит уходящему экрану.
 */
export function usePageCanvas(frameRef: { current: HTMLElement | null }, stage: string): void {
  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const frame = frameRef.current;
      if (!frame) return;
      const color = topEdgeColor(frame);
      if (color) apply(color);
    };

    const raf = window.requestAnimationFrame(measure);
    // 380 мс — чуть дольше самого длинного межэкранного перехода (340 мс).
    const timer = window.setTimeout(measure, 380);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [frameRef, stage]);
}
